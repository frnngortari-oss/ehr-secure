import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type SearchParams = {
  lastName?: string;
  firstName?: string;
  nationalId?: string;
  birthDate?: string;
  patientId?: string;
};

type Props = { searchParams: Promise<SearchParams> };

export default async function PatientsPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;

  const where = {
    lastName: params.lastName ? { contains: params.lastName, mode: "insensitive" as const } : undefined,
    firstName: params.firstName ? { contains: params.firstName, mode: "insensitive" as const } : undefined,
    nationalId: params.nationalId ? { contains: params.nationalId } : undefined,
    id: params.patientId ? { contains: params.patientId } : undefined,
    birthDate: params.birthDate
      ? {
          gte: new Date(`${params.birthDate}T00:00:00`),
          lt: new Date(`${params.birthDate}T23:59:59`)
        }
      : undefined
  };

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
            <label>Apellido</label>
            <input name="lastName" defaultValue={params.lastName ?? ""} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Nombres</label>
            <input name="firstName" defaultValue={params.firstName ?? ""} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Nro documento</label>
            <input name="nationalId" defaultValue={params.nationalId ?? ""} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Fecha de nacimiento</label>
            <input type="date" name="birthDate" defaultValue={params.birthDate ?? ""} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Nro de ID</label>
            <input name="patientId" defaultValue={params.patientId ?? ""} />
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
