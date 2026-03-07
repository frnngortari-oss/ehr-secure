import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function PatientsPage() {
  const user = await requireUser();
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { encounters: true } } }
  });

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Pacientes</h2>
        <div className="row">
          <Link href="/patients/search"><button style={{ width: "auto" }}>Buscar</button></Link>
          {(user.role === "ADMIN" || user.role === "RECEPCION" || user.role === "MEDICO") && (
            <Link href="/patients/new"><button style={{ width: "auto" }}>Nuevo</button></Link>
          )}
        </div>
      </div>

      {patients.length === 0 ? <p className="small">No hay pacientes cargados.</p> : null}

      {patients.map((patient) => (
        <Link key={patient.id} href={`/patients/${patient.id}`}>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{patient.lastName}, {patient.firstName}</strong>
              <span className="badge">{patient._count.encounters} evoluciones</span>
            </div>
            <p className="small" style={{ marginBottom: 0 }}>DNI: {patient.nationalId}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
