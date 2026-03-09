import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  analysis?: string;
};

type Props = {
  searchParams: Promise<SearchParams>;
};

const analysisKeys = ["turnos", "evoluciones", "problemas", "motivos", "ausentismo", "rendimiento"] as const;
type AnalysisKey = (typeof analysisKeys)[number];

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

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function sparklinePoints(values: number[], width = 170, height = 46, pad = 4) {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);

  return values
    .map((value, idx) => {
      const x = pad + (idx * (width - pad * 2)) / Math.max(values.length - 1, 1);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

export default async function KpiPage({ searchParams }: Props) {
  await requireRole(["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL", "RECEPCION"]);
  const params = await searchParams;
  const selectedAnalysis: AnalysisKey = analysisKeys.includes((params.analysis ?? "") as AnalysisKey)
    ? (params.analysis as AnalysisKey)
    : "turnos";

  const now = new Date();
  const current = monthRange(now, 0);
  const previous = monthRange(now, -1);
  const sixMonthsStart = monthRange(now, -5).start;

  const [
    appointmentsCurrent,
    appointmentsPrevious,
    appointmentsSixMonths,
    encountersCurrent,
    encountersPrevious,
    encountersSixMonths,
    problemsAll,
    activeProblemsRecent
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: current.start, lte: current.end } },
      select: { id: true, status: true, scheduledAt: true, agendaName: true }
    }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: previous.start, lte: previous.end } },
      select: { id: true }
    }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: sixMonthsStart } },
      select: { id: true, status: true, scheduledAt: true, agendaName: true }
    }),
    prisma.encounter.findMany({
      where: { occurredAt: { gte: current.start, lte: current.end } },
      select: {
        id: true,
        reason: true,
        occurredAt: true,
        authorRole: true,
        authorSpecialty: true
      }
    }),
    prisma.encounter.findMany({
      where: { occurredAt: { gte: previous.start, lte: previous.end } },
      select: { id: true }
    }),
    prisma.encounter.findMany({
      where: { occurredAt: { gte: sixMonthsStart } },
      select: { id: true, occurredAt: true }
    }),
    prisma.problem.findMany({
      select: { id: true, isActive: true, category: true }
    }),
    prisma.problem.findMany({
      where: { isActive: true },
      include: {
        patient: { select: { firstName: true, lastName: true, nationalId: true } }
      },
      orderBy: { startedAt: "desc" },
      take: 20
    })
  ]);

  const monthStats = new Map<
    string,
    {
      key: string;
      label: string;
      turnos: number;
      evoluciones: number;
      atendidos: number;
      ausentes: number;
      cancelados: number;
      pendientes: number;
    }
  >();

  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthStats.set(key, {
      key,
      label: monthLabel(d),
      turnos: 0,
      evoluciones: 0,
      atendidos: 0,
      ausentes: 0,
      cancelados: 0,
      pendientes: 0
    });
  }

  for (const appt of appointmentsSixMonths) {
    const key = `${appt.scheduledAt.getFullYear()}-${String(appt.scheduledAt.getMonth() + 1).padStart(2, "0")}`;
    const slot = monthStats.get(key);
    if (!slot) continue;
    slot.turnos += 1;
    if (appt.status === "ATENDIDO") slot.atendidos += 1;
    if (appt.status === "AUSENTE") slot.ausentes += 1;
    if (appt.status === "CANCELADO") slot.cancelados += 1;
    if (appt.status === "PENDIENTE") slot.pendientes += 1;
  }

  for (const enc of encountersSixMonths) {
    const key = `${enc.occurredAt.getFullYear()}-${String(enc.occurredAt.getMonth() + 1).padStart(2, "0")}`;
    const slot = monthStats.get(key);
    if (!slot) continue;
    slot.evoluciones += 1;
  }

  const monthRows = [...monthStats.values()];
  const totalTurnosMes = appointmentsCurrent.length;
  const turnosMesPrevio = appointmentsPrevious.length;
  const totalEvolucionesMes = encountersCurrent.length;
  const evolucionesMesPrevio = encountersPrevious.length;

  const atendidosMes = appointmentsCurrent.filter((a) => a.status === "ATENDIDO").length;
  const ausentesMes = appointmentsCurrent.filter((a) => a.status === "AUSENTE").length;
  const canceladosMes = appointmentsCurrent.filter((a) => a.status === "CANCELADO").length;
  const pendientesMes = appointmentsCurrent.filter((a) => a.status === "PENDIENTE").length;

  const totalProblems = problemsAll.length;
  const activeProblems = problemsAll.filter((p) => p.isActive).length;

  const reasonCount = new Map<string, number>();
  for (const enc of encountersCurrent) {
    const key = enc.reason.trim() || "Sin motivo";
    reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
  }
  const topReasons = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]);

  const problemsByCategory = new Map<string, number>();
  for (const problem of problemsAll) {
    const key = problem.category.trim() || "Sin categoria";
    problemsByCategory.set(key, (problemsByCategory.get(key) ?? 0) + 1);
  }
  const sortedProblemCategories = [...problemsByCategory.entries()].sort((a, b) => b[1] - a[1]);

  const specialties = new Map<string, number>();
  for (const enc of encountersCurrent) {
    const key = enc.authorSpecialty || enc.authorRole || "Sin especialidad";
    specialties.set(key, (specialties.get(key) ?? 0) + 1);
  }
  const topSpecialties = [...specialties.entries()].sort((a, b) => b[1] - a[1]);

  const agendas = new Map<string, number>();
  for (const appt of appointmentsCurrent) {
    const key = appt.agendaName.trim() || "Sin agenda";
    agendas.set(key, (agendas.get(key) ?? 0) + 1);
  }
  const topAgendas = [...agendas.entries()].sort((a, b) => b[1] - a[1]);

  const byHour = new Map<number, number>();
  for (const appt of appointmentsCurrent) {
    const hour = appt.scheduledAt.getHours();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const byHourRows = [...byHour.entries()].sort((a, b) => a[0] - b[0]);

  const deltaTurnos = pctDelta(totalTurnosMes, turnosMesPrevio);
  const deltaEvoluciones = pctDelta(totalEvolucionesMes, evolucionesMesPrevio);
  const ausentismoMes = totalTurnosMes === 0 ? 0 : ((ausentesMes + canceladosMes) / totalTurnosMes) * 100;
  const tasaAtencionMes = totalTurnosMes === 0 ? 0 : (atendidosMes / totalTurnosMes) * 100;
  const activeProblemRatio = totalProblems === 0 ? 0 : (activeProblems / totalProblems) * 100;

  const turnosSeries = monthRows.map((m) => m.turnos);
  const evolucionesSeries = monthRows.map((m) => m.evoluciones);
  const ausentismoSeries = monthRows.map((m) => {
    if (m.turnos === 0) return 0;
    return ((m.ausentes + m.cancelados) / m.turnos) * 100;
  });

  const maxTurnosSeries = Math.max(1, ...turnosSeries);
  const maxAgenda = Math.max(1, ...topAgendas.map((x) => x[1]));
  const maxByHour = Math.max(1, ...byHourRows.map((x) => x[1]));

  const turnosPoints = sparklinePoints(turnosSeries);
  const evolucionesPoints = sparklinePoints(evolucionesSeries);
  const ausentismoPoints = sparklinePoints(ausentismoSeries);

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

      <section className="kpi-grid kpi-grid-fancy">
        <Link href="/kpi?analysis=turnos" className={selectedAnalysis === "turnos" ? "kpi-card-link active" : "kpi-card-link"}>
          <article className="kpi-card">
            <p className="kpi-label">Turnos mes</p>
            <p className="kpi-value">{totalTurnosMes}</p>
            <p className={deltaTurnos >= 0 ? "kpi-delta up" : "kpi-delta down"}>Variacion: {formatPct(deltaTurnos)}</p>
            <div className="kpi-mini-bars">
              {turnosSeries.map((value, idx) => (
                <span key={`turnos-bar-${idx}`} style={{ height: `${Math.max(10, (value / maxTurnosSeries) * 38)}px` }} />
              ))}
            </div>
          </article>
        </Link>

        <Link href="/kpi?analysis=evoluciones" className={selectedAnalysis === "evoluciones" ? "kpi-card-link active" : "kpi-card-link"}>
          <article className="kpi-card">
            <p className="kpi-label">Evoluciones mes</p>
            <p className="kpi-value">{totalEvolucionesMes}</p>
            <p className={deltaEvoluciones >= 0 ? "kpi-delta up" : "kpi-delta down"}>Variacion: {formatPct(deltaEvoluciones)}</p>
            <svg className="kpi-spark" viewBox="0 0 170 46" preserveAspectRatio="none">
              <polyline points={evolucionesPoints} />
            </svg>
          </article>
        </Link>

        <Link href="/kpi?analysis=problemas" className={selectedAnalysis === "problemas" ? "kpi-card-link active" : "kpi-card-link"}>
          <article className="kpi-card">
            <p className="kpi-label">Problemas activos</p>
            <p className="kpi-value">{activeProblems}</p>
            <p className="small">Total: {totalProblems}</p>
            <div className="kpi-progress-track">
              <div className="kpi-progress-fill" style={{ width: `${Math.min(100, activeProblemRatio)}%` }} />
            </div>
            <p className="small" style={{ marginTop: 6 }}>{formatPct(activeProblemRatio)} activos</p>
          </article>
        </Link>

        <Link href="/kpi?analysis=motivos" className={selectedAnalysis === "motivos" ? "kpi-card-link active" : "kpi-card-link"}>
          <article className="kpi-card">
            <p className="kpi-label">Motivos consulta</p>
            <p className="kpi-value">{topReasons.length}</p>
            <p className="small">Categorias del mes</p>
            <div className="kpi-chip-row">
              {topReasons.slice(0, 3).map(([reason, count]) => (
                <span key={reason} className="kpi-chip">{reason} ({count})</span>
              ))}
            </div>
          </article>
        </Link>

        <Link href="/kpi?analysis=ausentismo" className={selectedAnalysis === "ausentismo" ? "kpi-card-link active" : "kpi-card-link"}>
          <article className="kpi-card">
            <p className="kpi-label">Ausentismo</p>
            <p className="kpi-value">{formatPct(ausentismoMes)}</p>
            <p className="small">Ausentes + cancelados</p>
            <svg className="kpi-spark warning" viewBox="0 0 170 46" preserveAspectRatio="none">
              <polyline points={ausentismoPoints} />
            </svg>
          </article>
        </Link>

        <Link href="/kpi?analysis=rendimiento" className={selectedAnalysis === "rendimiento" ? "kpi-card-link active" : "kpi-card-link"}>
          <article className="kpi-card">
            <p className="kpi-label">Rendimiento</p>
            <p className="kpi-value">{formatPct(tasaAtencionMes)}</p>
            <p className="small">Tasa de atencion</p>
            <div className="kpi-progress-track">
              <div className="kpi-progress-fill success" style={{ width: `${Math.min(100, tasaAtencionMes)}%` }} />
            </div>
          </article>
        </Link>
      </section>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Detalle del analisis</h3>
          <div className="kpi-filter-row">
            {analysisKeys.map((key) => (
              <Link key={key} href={`/kpi?analysis=${key}`} className={selectedAnalysis === key ? "kpi-filter active" : "kpi-filter"}>
                {key}
              </Link>
            ))}
          </div>
        </div>

        {selectedAnalysis === "turnos" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Turnos por mes (ultimos 6 meses)</h4>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Turnos</th>
                  <th>Atendidos</th>
                  <th>Pendientes</th>
                  <th>Ausentes</th>
                  <th>Cancelados</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.turnos}</td>
                    <td>{row.atendidos}</td>
                    <td>{row.pendientes}</td>
                    <td>{row.ausentes}</td>
                    <td>{row.cancelados}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: 14 }}>Agendas mas usadas (mes actual)</h4>
            {topAgendas.length === 0 ? <p className="small">Sin turnos en este periodo.</p> : null}
            <div className="kpi-detail-bars">
              {topAgendas.slice(0, 8).map(([agenda, count]) => (
                <div key={agenda} className="kpi-detail-bar-row">
                  <span>{agenda}</span>
                  <div>
                    <div className="kpi-detail-fill" style={{ width: `${(count / maxAgenda) * 100}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedAnalysis === "evoluciones" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Evoluciones por mes</h4>
            <svg className="kpi-spark big" viewBox="0 0 170 46" preserveAspectRatio="none">
              <polyline points={evolucionesPoints} />
            </svg>
            <table className="audit-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Evoluciones</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.evoluciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: 14 }}>Distribucion por especialidad (mes actual)</h4>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Especialidad / rol</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {topSpecialties.length === 0 ? (
                  <tr>
                    <td colSpan={2}>Sin evoluciones en este periodo.</td>
                  </tr>
                ) : (
                  topSpecialties.map(([specialty, count]) => (
                    <tr key={specialty}>
                      <td>{specialty}</td>
                      <td>{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedAnalysis === "problemas" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Problemas por categoria</h4>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {sortedProblemCategories.map(([category, count]) => (
                  <tr key={category}>
                    <td>{category}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: 14 }}>Problemas activos recientes</h4>
            {activeProblemsRecent.length === 0 ? <p className="small">Sin problemas activos.</p> : null}
            {activeProblemsRecent.map((problem) => (
              <article key={problem.id} className="card" style={{ marginBottom: 8, padding: 10 }}>
                <p style={{ margin: 0 }}><strong>{problem.title}</strong> <span className="badge">{problem.category}</span></p>
                <p className="small" style={{ marginBottom: 0 }}>
                  Paciente: {problem.patient.lastName}, {problem.patient.firstName} ({problem.patient.nationalId})
                </p>
              </article>
            ))}
          </div>
        ) : null}

        {selectedAnalysis === "motivos" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Motivos de consulta (mes actual)</h4>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Motivo</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {topReasons.length === 0 ? (
                  <tr>
                    <td colSpan={2}>Sin evoluciones en este periodo.</td>
                  </tr>
                ) : (
                  topReasons.map(([reason, count]) => (
                    <tr key={reason}>
                      <td>{reason}</td>
                      <td>{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedAnalysis === "ausentismo" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Ausentismo por mes</h4>
            <svg className="kpi-spark big warning" viewBox="0 0 170 46" preserveAspectRatio="none">
              <polyline points={ausentismoPoints} />
            </svg>
            <table className="audit-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Turnos</th>
                  <th>Ausentes + cancelados</th>
                  <th>Tasa</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row) => {
                  const missed = row.ausentes + row.cancelados;
                  const rate = row.turnos === 0 ? 0 : (missed / row.turnos) * 100;
                  return (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.turnos}</td>
                      <td>{missed}</td>
                      <td>{formatPct(rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedAnalysis === "rendimiento" ? (
          <div style={{ marginTop: 12 }}>
            <h4>Rendimiento del mes</h4>
            <div className="kpi-detail-counters">
              <article className="kpi-mini-counter">
                <p className="kpi-label">Atendidos</p>
                <p className="kpi-value">{atendidosMes}</p>
              </article>
              <article className="kpi-mini-counter">
                <p className="kpi-label">Pendientes</p>
                <p className="kpi-value">{pendientesMes}</p>
              </article>
              <article className="kpi-mini-counter">
                <p className="kpi-label">No concretados</p>
                <p className="kpi-value">{ausentesMes + canceladosMes}</p>
              </article>
            </div>

            <h4 style={{ marginTop: 14 }}>Turnos por hora (mes actual)</h4>
            {byHourRows.length === 0 ? <p className="small">Sin turnos en este periodo.</p> : null}
            <div className="kpi-detail-bars">
              {byHourRows.map(([hour, count]) => (
                <div key={hour} className="kpi-detail-bar-row">
                  <span>{String(hour).padStart(2, "0")}:00</span>
                  <div>
                    <div className="kpi-detail-fill success" style={{ width: `${(count / maxByHour) * 100}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vista comparativa 6 meses</h3>
        <div className="bars">
          {monthRows.map((row) => (
            <div className="bar-wrap" key={row.key}>
              <div className="bar" style={{ height: `${Math.max(8, (row.turnos / maxTurnosSeries) * 70)}px` }} />
              <div className="bar" style={{ height: `${Math.max(8, (row.evoluciones / maxTurnosSeries) * 70)}px`, marginTop: 3, background: "linear-gradient(180deg,#3fa88a,#237b63)" }} />
              <div className="bar-label">{row.label}</div>
            </div>
          ))}
        </div>
        <p className="small">Barra azul: turnos | Barra verde: evoluciones</p>
      </div>
    </div>
  );
}
