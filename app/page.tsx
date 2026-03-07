import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function monthRange(base: Date) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export default async function HomePage() {
  const user = await requireUser();
  const month = monthRange(new Date());

  const [patients, encounters, appointmentsMonth, problemsActive] = await Promise.all([
    prisma.patient.count(),
    prisma.encounter.count(),
    prisma.appointment.count({ where: { scheduledAt: { gte: month.start, lte: month.end } } }),
    prisma.problem.count({ where: { isActive: true } })
  ]);

  return (
    <div>
      <section className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">Pacientes</p>
          <p className="kpi-value">{patients}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Turnos del mes</p>
          <p className="kpi-value">{appointmentsMonth}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Evoluciones totales</p>
          <p className="kpi-value">{encounters}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Problemas activos</p>
          <p className="kpi-value">{problemsActive}</p>
        </article>
      </section>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Panel rapido</h2>
        <p className="small">Perfil activo: {user.fullName} ({user.role})</p>
        <div className="row" style={{ marginTop: 10 }}>
          <Link href="/kpi"><button style={{ width: "auto" }}>Ver KPIs</button></Link>
          <Link href="/agenda"><button style={{ width: "auto" }}>Agenda del dia</button></Link>
          <Link href="/patients"><button style={{ width: "auto" }}>Buscar pacientes</button></Link>
          <Link href="/evolutions"><button style={{ width: "auto" }}>Evoluciones</button></Link>
        </div>
      </div>
    </div>
  );
}
