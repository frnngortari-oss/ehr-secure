import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function monthRange(base: Date, offset = 0) {
  const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const end = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0, 23, 59, 59);
  return { start, end };
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

export default async function KpiPage() {
  await requireRole(["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL", "RECEPCION"]);
  const now = new Date();
  const current = monthRange(now, 0);
  const previous = monthRange(now, -1);
  const sixMonthsStart = monthRange(now, -5).start;

  const [appointmentsCurrent, appointmentsPrevious, problems, encountersCurrent, encountersSixMonths, appointmentsSixMonths] =
    await Promise.all([
      prisma.appointment.findMany({ where: { scheduledAt: { gte: current.start, lte: current.end } } }),
      prisma.appointment.findMany({ where: { scheduledAt: { gte: previous.start, lte: previous.end } } }),
      prisma.problem.findMany(),
      prisma.encounter.findMany({ where: { occurredAt: { gte: current.start, lte: current.end } } }),
      prisma.encounter.findMany({ where: { occurredAt: { gte: sixMonthsStart } } }),
      prisma.appointment.findMany({ where: { scheduledAt: { gte: sixMonthsStart } } })
    ]);

  const totalTurnosMes = appointmentsCurrent.length;
  const atendidosMes = appointmentsCurrent.filter((a) => a.status === "ATENDIDO").length;
  const ausentesMes = appointmentsCurrent.filter((a) => a.status === "AUSENTE").length;
  const canceladosMes = appointmentsCurrent.filter((a) => a.status === "CANCELADO").length;
  const pendientesMes = appointmentsCurrent.filter((a) => a.status === "PENDIENTE").length;

  const activeProblems = problems.filter((p) => p.isActive).length;
  const totalProblems = problems.length;

  const reasonCount = new Map<string, number>();
  for (const enc of encountersCurrent) {
    const key = enc.reason.trim() || "Sin motivo";
    reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
  }
  const topReasons = [...reasonCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const monthMapAppointments = new Map<string, number>();
  const monthMapEncounters = new Map<string, number>();
  const months: string[] = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(key);
    monthMapAppointments.set(key, 0);
    monthMapEncounters.set(key, 0);
  }

  for (const appt of appointmentsSixMonths) {
    const key = `${appt.scheduledAt.getFullYear()}-${String(appt.scheduledAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthMapAppointments.has(key)) {
      monthMapAppointments.set(key, (monthMapAppointments.get(key) ?? 0) + 1);
    }
  }
  for (const enc of encountersSixMonths) {
    const key = `${enc.occurredAt.getFullYear()}-${String(enc.occurredAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthMapEncounters.has(key)) {
      monthMapEncounters.set(key, (monthMapEncounters.get(key) ?? 0) + 1);
    }
  }

  const bars = months.map((key) => {
    const [y, m] = key.split("-").map(Number);
    return {
      label: monthLabel(new Date(y, m - 1, 1)),
      turnos: monthMapAppointments.get(key) ?? 0,
      evoluciones: monthMapEncounters.get(key) ?? 0
    };
  });

  const maxBar = Math.max(1, ...bars.flatMap((b) => [b.turnos, b.evoluciones]));
  const deltaTurnos = pctDelta(totalTurnosMes, appointmentsPrevious.length);
  const deltaEvoluciones = pctDelta(encountersCurrent.length, appointmentsPrevious.length);

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>KPIs principales</h2>
        <p className="small">
          Periodo: {current.start.toLocaleDateString("es-AR")} a {current.end.toLocaleDateString("es-AR")} | Comparativo:
          {" "}
          {previous.start.toLocaleDateString("es-AR")} a {previous.end.toLocaleDateString("es-AR")}
        </p>
      </div>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">Turnos del mes</p>
          <p className="kpi-value">{totalTurnosMes}</p>
          <p className={deltaTurnos >= 0 ? "kpi-delta up" : "kpi-delta down"}>
            Variacion: {deltaTurnos.toFixed(1)}%
          </p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Atendidos del mes</p>
          <p className="kpi-value">{atendidosMes}</p>
          <p className="small">Pendientes: {pendientesMes}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Ausentes / cancelados</p>
          <p className="kpi-value">{ausentesMes + canceladosMes}</p>
          <p className="small">Ausentes: {ausentesMes} | Cancelados: {canceladosMes}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Problemas activos</p>
          <p className="kpi-value">{activeProblems}</p>
          <p className="small">Total problemas: {totalProblems}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Evoluciones del mes</p>
          <p className="kpi-value">{encountersCurrent.length}</p>
          <p className={deltaEvoluciones >= 0 ? "kpi-delta up" : "kpi-delta down"}>
            Variacion: {deltaEvoluciones.toFixed(1)}%
          </p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Motivos de consulta</p>
          {topReasons.length === 0 ? <p className="small">Sin registros del periodo.</p> : null}
          <ol className="list-tight">
            {topReasons.map(([reason, count]) => (
              <li key={reason}>
                <span>{reason}</span> <span className="small">({count})</span>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Turnos y evoluciones por mes (ultimos 6 meses)</h3>
        <div className="bars">
          {bars.map((b) => (
            <div className="bar-wrap" key={b.label}>
              <div className="bar" style={{ height: `${Math.max(8, (b.turnos / maxBar) * 70)}px` }} />
              <div className="bar" style={{ height: `${Math.max(8, (b.evoluciones / maxBar) * 70)}px`, marginTop: 3, background: "linear-gradient(180deg,#3fa88a,#237b63)" }} />
              <div className="bar-label">{b.label}</div>
            </div>
          ))}
        </div>
        <p className="small">Barra azul: turnos | Barra verde: evoluciones</p>
      </div>
    </div>
  );
}
