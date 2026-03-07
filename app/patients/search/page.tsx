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

export default async function PatientSearchPage({ searchParams }: Props) {
  await requireUser();
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
    take: 50
  });

  return (
    <div className="grid" style={{ gridTemplateColumns: "320px 1fr", alignItems: "start" }}>
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
          <button type="submit">Buscar</button>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Resultados</h3>
        <p className="small">Mostrando {patients.length} resultados (maximo 50).</p>
        {patients.length === 0 ? <p className="small">Sin coincidencias.</p> : null}
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <article className="card" style={{ marginBottom: 10 }}>
              <strong>{patient.lastName}, {patient.firstName}</strong>
              <p className="small">DNI: {patient.nationalId}</p>
              <p className="small">ID: {patient.id}</p>
            </article>
          </Link>
        ))}
      </section>
    </div>
  );
}
