import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type SearchParams = {
  q?: string;
};

type Props = { searchParams: Promise<SearchParams> };

export default async function PatientsPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const numericQ = q.replace(/\D/g, "");

  let where: Prisma.PatientWhereInput = {};
  if (q.length > 0) {
    const orFilters: Prisma.PatientWhereInput[] = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } }
    ];

    if (numericQ.length > 0) {
      orFilters.push({ nationalId: { contains: numericQ } });
    }

    if (terms.length > 1) {
      orFilters.push({
        AND: terms.map((term) => ({
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } }
          ]
        }))
      });
    }

    where = { OR: orFilters };
  }

  const patients = await prisma.patient.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { _count: { select: { encounters: true } } },
    take: 100
  });

  return (
    <div className="split-layout">
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Busqueda de pacientes</h3>
        <form method="GET">
          <div style={{ marginBottom: 8 }}>
            <label>Buscar por DNI o nombre</label>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Ej: 30111222 o Laura Gomez"
            />
          </div>
          <div className="row">
            <button type="submit">Buscar</button>
            {(user.role === "ADMIN" || user.role === "RECEPCION" || user.role === "MEDICO" || user.role === "PSICOLOGO" || user.role === "FONOAUDIOLOGO" || user.role === "KINESIOLOGO" || user.role === "TERAPISTA_OCUPACIONAL") && (
              <Link href="/patients/new"><button type="button">Nuevo</button></Link>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Pacientes ({patients.length})</h3>
        {patients.length === 0 ? <p className="small">Sin coincidencias.</p> : null}

        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <article className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{patient.lastName}, {patient.firstName}</strong>
                <span className="badge">{patient._count.encounters} evoluciones</span>
              </div>
              <p className="small" style={{ marginBottom: 0 }}>DNI: {patient.nationalId}</p>
              <p className="small" style={{ marginBottom: 0 }}>ID: {patient.id}</p>
            </article>
          </Link>
        ))}
      </section>
    </div>
  );
}
