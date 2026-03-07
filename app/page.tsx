import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await requireUser();
  const [patients, encounters] = await Promise.all([prisma.patient.count(), prisma.encounter.count()]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Resumen</h2>
      <p>Pacientes registrados: <strong>{patients}</strong></p>
      <p>Evoluciones cargadas: <strong>{encounters}</strong></p>
      <p className="small">Perfil activo: {user.fullName} ({user.role})</p>
      <div className="row" style={{ marginTop: 12 }}>
        <Link href="/patients"><button>Ver pacientes</button></Link>
        <Link href="/patients/search"><button>Buscar pacientes</button></Link>
        <Link href="/agenda"><button>Agenda del dia</button></Link>
        <Link href="/evolutions"><button>Evoluciones</button></Link>
        {(user.role === "ADMIN" || user.role === "RECEPCION" || user.role === "MEDICO") && (
          <Link href="/patients/new"><button>Alta de paciente</button></Link>
        )}
      </div>
    </div>
  );
}
