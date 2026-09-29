import Link from "next/link";
import Form from "next/form";
import { patientPage, patientSearchWhere } from "@/lib/patient-search";
import SubmitButton from "@/components/submit-button";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type SearchParams = {
  q?: string;
  page?: string;
};

type Props = { searchParams: Promise<SearchParams> };

export default async function PatientsPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = patientPage(params.page);
  const pageSize = 24;
  const rows = await prisma.patient.findMany({
    where: patientSearchWhere(q),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      birthDate: true,
      healthInsurance: true,
      _count: { select: { encounters: true } }
    },
    take: pageSize + 1,
    skip: (page - 1) * pageSize
  });
  const patients = rows.slice(0, pageSize);
  const hasNextPage = rows.length > pageSize;
  const pageHref = (value: number) => `/patients?${new URLSearchParams({ q, page: String(value) })}`;

  return (
    <div className="patients-page">
      <section className="card patients-toolbar">
        <div>
          <p className="eyebrow">Directorio clinico</p>
          <h2>Pacientes</h2>
          <p className="small">Busca por nombre, apellido o DNI.</p>
        </div>
        <Form action="/patients" scroll={false} className="patient-search-form">
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
        </Form>
      </section>

      <section className="card patients-results">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultados</p>
            <h3>{q ? `Coincidencias para "${q}"` : "Todos los pacientes"}</h3>
          </div>
          <span className="small">Pagina {page} · {patients.length} pacientes</span>
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
                  <span>{new Date(patient.birthDate).toLocaleDateString("es-AR", { timeZone: "UTC" })}</span>
                </div>
                <span className="badge">{patient._count.encounters} evoluciones</span>
                {patient.healthInsurance ? <p className="patient-insurance-label">{patient.healthInsurance}</p> : null}
              </div>
            </Link>
          ))}
        </div>
        <nav className="patient-pagination" aria-label="Paginas de pacientes">
          {page > 1 ? <Link href={pageHref(page - 1)} className="button button-secondary">Anterior</Link> : null}
          {hasNextPage ? <Link href={pageHref(page + 1)} className="button button-secondary">Siguiente</Link> : null}
        </nav>
      </section>
    </div>
  );
}
