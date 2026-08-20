import Link from "next/link";
import type { Prisma } from "@prisma/client";
import SubmitButton from "@/components/submit-button";
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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      birthDate: true,
      _count: { select: { encounters: true } }
    },
    take: 100
  });

  return (
    <div className="patients-page">
      <section className="card patients-toolbar">
        <div>
          <p className="eyebrow">Directorio clinico</p>
          <h2>Pacientes</h2>
          <p className="small">Busca por nombre, apellido o DNI.</p>
        </div>
        <form method="GET" className="patient-search-form">
          <div>
            <label htmlFor="patient-search">Buscar paciente</label>
            <input
              id="patient-search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Ej: 30111222 o Laura Gomez"
              autoComplete="off"
            />
          </div>
          <div className="patient-search-actions">
            <SubmitButton pendingText="Buscando...">Buscar</SubmitButton>
            {(user.role === "ADMIN" || user.role === "RECEPCION" || user.role === "MEDICO" || user.role === "PSICOLOGO" || user.role === "FONOAUDIOLOGO" || user.role === "KINESIOLOGO" || user.role === "TERAPISTA_OCUPACIONAL") && (
              <Link href="/patients/new" className="button button-secondary">Nuevo paciente</Link>
            )}
          </div>
        </form>
      </section>

      <section className="card patients-results">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultados</p>
            <h3>{q ? `Coincidencias para "${q}"` : "Todos los pacientes"}</h3>
          </div>
          <span className="result-count">{patients.length}</span>
        </div>
        {patients.length === 0 ? <p className="small">Sin coincidencias.</p> : null}

        <div className="patient-card-grid">
          {patients.map((patient) => (
            <Link key={patient.id} href={`/patients/${patient.id}`} className="patient-card">
              <span className="patient-avatar" aria-hidden="true">
                {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
              </span>
              <div className="patient-card-body">
                <div className="patient-card-title">
                  <strong>{patient.lastName}, {patient.firstName}</strong>
                  <span aria-hidden="true">→</span>
                </div>
                <div className="patient-card-meta">
                  <span>DNI {patient.nationalId}</span>
                  <span>{new Date(patient.birthDate).toLocaleDateString("es-AR")}</span>
                </div>
                <span className="badge">{patient._count.encounters} evoluciones</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
