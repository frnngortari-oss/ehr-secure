import Link from "next/link";
import { deleteEncounter } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  patient?: string;
  dateFrom?: string;
  dateTo?: string;
  day?: string;
  category?: string;
};

type Props = { searchParams: Promise<SearchParams> };

function toDate(value?: string, end?: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`);
}

export default async function EvolutionsPage({ searchParams }: Props) {
  const user = await requireRole(["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL", "RECEPCION"]);
  const params = await searchParams;
  const canDeleteEncounter = user.role === "ADMIN";
  const dayStart = params.day ? toDate(params.day) : undefined;
  const dayEnd = params.day ? toDate(params.day, true) : undefined;

  const evolutions = await prisma.encounter.findMany({
    where: {
      occurredAt: {
        gte: dayStart ?? toDate(params.dateFrom),
        lte: dayEnd ?? toDate(params.dateTo, true)
      },
      patient: params.patient
        ? {
            OR: [
              { firstName: { contains: params.patient, mode: "insensitive" } },
              { lastName: { contains: params.patient, mode: "insensitive" } },
              { nationalId: { contains: params.patient } }
            ]
          }
        : undefined,
      problem: params.category ? { category: params.category } : undefined
    },
    include: {
      patient: true,
      author: { select: { fullName: true } },
      problem: true
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 100
  });

  const categories = await prisma.problem.findMany({
    where: { isActive: true },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" }
  });

  const returnQs = new URLSearchParams();
  if (params.patient) returnQs.set("patient", params.patient);
  if (params.day) returnQs.set("day", params.day);
  if (params.dateFrom) returnQs.set("dateFrom", params.dateFrom);
  if (params.dateTo) returnQs.set("dateTo", params.dateTo);
  if (params.category) returnQs.set("category", params.category);
  const returnTo = `/evolutions${returnQs.toString() ? `?${returnQs.toString()}` : ""}`;

  return (
    <div className="split-layout">
      <aside className="card">
        <h3 style={{ marginTop: 0 }}>Evoluciones</h3>
        <form method="GET">
          <div style={{ marginBottom: 8 }}>
            <label>Paciente</label>
            <input name="patient" defaultValue={params.patient ?? ""} placeholder="Nombre o DNI" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Dia exacto</label>
            <input type="date" name="day" defaultValue={params.day ?? ""} />
            <p className="small" style={{ marginTop: 4 }}>
              Si completas este campo, ignora Desde/Hasta.
            </p>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Desde</label>
            <input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Hasta</label>
            <input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Categoria</label>
            <select name="category" defaultValue={params.category ?? ""}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </select>
          </div>
          <button type="submit">Filtrar</button>
          <a href="/evolutions" className="small" style={{ marginLeft: 10, textDecoration: "underline", color: "#0d4f91" }}>
            Limpiar
          </a>
        </form>
      </aside>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Listado cronologico ({evolutions.length})</h3>
        {evolutions.length === 0 ? <p className="small">Sin registros con ese filtro.</p> : null}
        {evolutions.map((ev) => (
          <article key={ev.id} className="card">
            <p className="small">{new Date(ev.occurredAt).toLocaleString("es-AR")}</p>
            <p>
              <strong>Paciente:</strong> {ev.patient.lastName}, {ev.patient.firstName} ({ev.patient.nationalId})
            </p>
            <p>
              <strong>Problema:</strong> {ev.problem?.title ?? "Sin asociar"} | <strong>Categoria:</strong> {ev.problem?.category ?? "-"}
            </p>
            <p><strong>Motivo:</strong> {ev.reason}</p>
            <p className="small">Profesional: {ev.author?.fullName ?? "Sin dato"}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{ev.content ?? ev.assessment}</p>
            <Link href={`/patients/${ev.patientId}`}>Ir a ficha del paciente</Link>
            {canDeleteEncounter ? (
              <details style={{ marginTop: 8 }}>
                <summary className="small" style={{ cursor: "pointer", color: "#b3261e" }}>
                  Eliminar evolucion (solo admin)
                </summary>
                <form action={deleteEncounter} style={{ marginTop: 8 }}>
                  <input type="hidden" name="encounterId" value={ev.id} />
                  <input type="hidden" name="patientId" value={ev.patientId} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label>Motivo de eliminacion (obligatorio)</label>
                  <textarea name="deleteReason" rows={2} required placeholder="Ej: Evolucion cargada al paciente incorrecto" />
                  <button style={{ marginTop: 8, background: "#b3261e" }} type="submit">Confirmar eliminacion</button>
                </form>
              </details>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
