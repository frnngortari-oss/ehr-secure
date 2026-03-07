import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  patient?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
};

type Props = { searchParams: Promise<SearchParams> };

function toDate(value?: string, end?: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`);
}

export default async function EvolutionsPage({ searchParams }: Props) {
  await requireRole(["ADMIN", "MEDICO", "RECEPCION"]);
  const params = await searchParams;

  const evolutions = await prisma.encounter.findMany({
    where: {
      occurredAt: {
        gte: toDate(params.dateFrom),
        lte: toDate(params.dateTo, true)
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

  return (
    <div className="grid" style={{ gridTemplateColumns: "300px 1fr", alignItems: "start" }}>
      <aside className="card">
        <h3 style={{ marginTop: 0 }}>Evoluciones</h3>
        <form method="GET">
          <div style={{ marginBottom: 8 }}>
            <label>Paciente</label>
            <input name="patient" defaultValue={params.patient ?? ""} placeholder="Nombre o DNI" />
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
          </article>
        ))}
      </section>
    </div>
  );
}
