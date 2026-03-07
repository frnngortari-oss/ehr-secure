import Link from "next/link";
import { createAppointment, updateAppointmentStatus } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  dateFrom?: string;
  dateTo?: string;
  hourFrom?: string;
  hourTo?: string;
  q?: string;
  calendarDate?: string;
  selectedTime?: string;
  slotMinutes?: string;
};

type Props = { searchParams: Promise<SearchParams> };

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusColor(status: string) {
  if (status === "ATENDIDO") return "#198754";
  if (status === "AUSENTE") return "#d9822b";
  if (status === "CANCELADO") return "#b3261e";
  return "#425466";
}

function monthBounds(dateValue: string) {
  const base = new Date(`${dateValue}T00:00:00`);
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTimeLabel(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function buildSlots(hourFrom: string, hourTo: string, step = 20) {
  const from = toMinutes(hourFrom);
  const to = toMinutes(hourTo);
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const slots: string[] = [];
  for (let min = start; min <= end; min += step) {
    slots.push(toTimeLabel(min));
  }
  return slots;
}

function timeKey(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function slotForTime(time: string, hourFrom: string, hourTo: string, step: number) {
  const min = toMinutes(time);
  const from = Math.min(toMinutes(hourFrom), toMinutes(hourTo));
  const to = Math.max(toMinutes(hourFrom), toMinutes(hourTo));
  if (min < from || min > to) return null;
  const offset = Math.floor((min - from) / step) * step;
  return toTimeLabel(from + offset);
}

export default async function AgendaPage({ searchParams }: Props) {
  const user = await requireRole(["ADMIN", "RECEPCION", "MEDICO"]);
  const params = await searchParams;
  const now = new Date();
  const dateFrom = params.dateFrom ?? formatDateInput(now);
  const dateTo = params.dateTo ?? formatDateInput(now);
  const hourFrom = params.hourFrom ?? "08:00";
  const hourTo = params.hourTo ?? "20:00";
  const calendarDate = params.calendarDate ?? dateFrom;
  const slotMinutesRaw = Number.parseInt(params.slotMinutes ?? "30", 10);
  const slotMinutes = Number.isFinite(slotMinutesRaw) ? Math.min(120, Math.max(5, slotMinutesRaw)) : 30;
  const selectedTime = params.selectedTime ?? "10:00";

  const start = new Date(`${dateFrom}T${hourFrom}:00`);
  const end = new Date(`${dateTo}T${hourTo}:59`);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lte: end },
      patient: params.q
        ? {
            OR: [
              { firstName: { contains: params.q, mode: "insensitive" } },
              { lastName: { contains: params.q, mode: "insensitive" } },
              { nationalId: { contains: params.q } }
            ]
          }
        : undefined
    },
    include: {
      patient: true,
      clinician: { select: { fullName: true } }
    },
    orderBy: [{ scheduledAt: "asc" }]
  });

  const month = monthBounds(calendarDate);
  const monthAppointments = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: month.start, lte: month.end } },
    select: { scheduledAt: true }
  });

  const byDay = new Map<string, number>();
  for (const appt of monthAppointments) {
    const key = toDateKey(appt.scheduledAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const selectedDayStart = new Date(`${dateFrom}T00:00:00`);
  const selectedDayEnd = new Date(`${dateFrom}T23:59:59`);
  const appointmentsOfDay = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: selectedDayStart, lte: selectedDayEnd },
      patient: params.q
        ? {
            OR: [
              { firstName: { contains: params.q, mode: "insensitive" } },
              { lastName: { contains: params.q, mode: "insensitive" } },
              { nationalId: { contains: params.q } }
            ]
          }
        : undefined
    },
    include: { patient: true },
    orderBy: { scheduledAt: "asc" }
  });

  const slots = buildSlots(hourFrom, hourTo, slotMinutes);
  const bySlot = new Map<string, typeof appointmentsOfDay>();
  for (const appt of appointmentsOfDay) {
    const key = slotForTime(timeKey(appt.scheduledAt), hourFrom, hourTo, slotMinutes);
    if (!key) continue;
    const prev = bySlot.get(key) ?? [];
    prev.push(appt);
    bySlot.set(key, prev);
  }

  const patientsOfDayMap = new Map<string, { id: string; fullName: string; nationalId: string; count: number }>();
  for (const appt of appointmentsOfDay) {
    const id = appt.patient.id;
    const current = patientsOfDayMap.get(id);
    if (current) {
      current.count += 1;
    } else {
      patientsOfDayMap.set(id, {
        id,
        fullName: `${appt.patient.lastName}, ${appt.patient.firstName}`,
        nationalId: appt.patient.nationalId,
        count: 1
      });
    }
  }
  const patientsOfDay = [...patientsOfDayMap.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const monthBase = new Date(`${calendarDate}T00:00:00`);
  const firstWeekDay = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1).getDay();
  const daysInMonth = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate();

  const baseQs = new URLSearchParams();
  if (params.q) baseQs.set("q", params.q);
  baseQs.set("hourFrom", hourFrom);
  baseQs.set("hourTo", hourTo);
  baseQs.set("slotMinutes", String(slotMinutes));
  baseQs.set("calendarDate", calendarDate);
  baseQs.set("dateFrom", dateFrom);
  baseQs.set("dateTo", dateTo);

  const patients = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100
  });

  return (
    <div className="split-layout">
      <aside className="card">
        <h3 style={{ marginTop: 0 }}>Agenda del dia</h3>
        <form method="GET">
          <input type="hidden" name="calendarDate" value={calendarDate} />
          <label>Desde</label>
          <input type="date" name="dateFrom" defaultValue={dateFrom} />
          <label>Hasta</label>
          <input type="date" name="dateTo" defaultValue={dateTo} />
          <label>Hora desde</label>
          <input type="time" name="hourFrom" defaultValue={hourFrom} />
          <label>Hora hasta</label>
          <input type="time" name="hourTo" defaultValue={hourTo} />
          <label>Intervalo grilla (min)</label>
          <input type="number" name="slotMinutes" min={5} max={120} step={5} defaultValue={slotMinutes} />
          <label>Buscar paciente</label>
          <input name="q" defaultValue={params.q ?? ""} placeholder="Nombre, apellido o DNI" />
          <div className="row" style={{ marginTop: 10 }}>
            <button type="submit">Aplicar</button>
          </div>
        </form>

        <hr style={{ margin: "14px 0" }} />
        <h4 style={{ marginTop: 0 }}>Calendario mensual</h4>
        <div className="calendar-grid">
          {Array.from({ length: firstWeekDay }).map((_, idx) => (
            <span key={`empty-${idx}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1;
            const dayKey = toDateKey(new Date(monthBase.getFullYear(), monthBase.getMonth(), day));
            const dayCount = byDay.get(dayKey) ?? 0;
            const hrefQs = new URLSearchParams(baseQs);
            hrefQs.set("dateFrom", dayKey);
            hrefQs.set("dateTo", dayKey);
            return (
              <Link
                key={dayKey}
                className={dayKey === dateFrom && dayKey === dateTo ? "calendar-day active" : "calendar-day"}
                href={`/agenda?${hrefQs.toString()}`}
              >
                <span>{day}</span>
                <small>{dayCount}</small>
              </Link>
            );
          })}
        </div>

        {(user.role === "ADMIN" || user.role === "RECEPCION" || user.role === "MEDICO") && (
          <>
            <hr style={{ margin: "14px 0" }} />
            <h4 style={{ margin: 0 }}>Nuevo turno</h4>
            <form action={createAppointment}>
              <div style={{ marginTop: 8 }}>
                <label>Paciente</label>
                <select name="patientId" required>
                  <option value="">Seleccionar</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} ({p.nationalId})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Agenda</label>
                <input name="agendaName" defaultValue="Consulta Clinica" required />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 8 }}>
                <div>
                  <label>Fecha</label>
                  <input type="date" name="date" defaultValue={dateFrom} required />
                </div>
                <div>
                  <label>Hora</label>
                  <input type="time" name="time" defaultValue={selectedTime} required />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Modalidad</label>
                <input name="modality" defaultValue="Ambulatorio" />
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Notas</label>
                <input name="notes" />
              </div>
              <button style={{ marginTop: 10 }} type="submit">Guardar turno</button>
            </form>
          </>
        )}
      </aside>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>
          Agenda por horas ({dateFrom}) | Turnos en filtro: {appointments.length}
        </h3>
        <p className="small">Intervalo visual: {slotMinutes} minutos</p>
        <div className="hour-grid">
          {slots.map((slot) => {
            const items = bySlot.get(slot) ?? [];
            const hrefQs = new URLSearchParams(baseQs);
            hrefQs.set("dateFrom", dateFrom);
            hrefQs.set("dateTo", dateTo);
            hrefQs.set("selectedTime", slot);
            return (
              <Link key={slot} href={`/agenda?${hrefQs.toString()}`} className={slot === selectedTime ? "slot-card active" : "slot-card"}>
                <div className="slot-time">{slot}</div>
                <p className="small" style={{ margin: "4px 0 0" }}>Turnos: {items.length}</p>
                {items.slice(0, 3).map((item) => (
                  <p key={item.id} className="small" style={{ margin: "2px 0 0" }}>
                    {timeKey(item.scheduledAt)} - {item.patient.lastName}, {item.patient.firstName}
                  </p>
                ))}
              </Link>
            );
          })}
        </div>

        <hr style={{ margin: "14px 0" }} />
        <h3 style={{ marginTop: 0 }}>Pacientes del dia</h3>
        {patientsOfDay.length === 0 ? <p className="small">Sin pacientes para el dia seleccionado.</p> : null}
        {patientsOfDay.map((p) => (
          <Link key={p.id} href={`/patients/${p.id}`}>
            <article className="card">
              <strong>{p.fullName}</strong>
              <p className="small">DNI: {p.nationalId} | Turnos: {p.count}</p>
            </article>
          </Link>
        ))}

        <hr style={{ margin: "14px 0" }} />
        <h3 style={{ marginTop: 0 }}>Listado detallado</h3>
        {appointments.length === 0 ? <p className="small">Sin turnos en el filtro seleccionado.</p> : null}
        {appointments.map((appt) => (
          <article key={appt.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{new Date(appt.scheduledAt).toLocaleString("es-AR")} - {appt.agendaName}</strong>
              <span className="badge" style={{ background: "#f1f5f9", color: statusColor(appt.status) }}>{appt.status}</span>
            </div>
            <p style={{ marginBottom: 6 }}>
              <strong>Paciente:</strong>{" "}
              <Link href={`/patients/${appt.patient.id}`} style={{ color: "#0d4f91", textDecoration: "underline" }}>
                {appt.patient.lastName}, {appt.patient.firstName} ({appt.patient.nationalId})
              </Link>
            </p>
            <p className="small">Modalidad: {appt.modality ?? "Ambulatorio"} | Profesional: {appt.clinician?.fullName ?? "Sin asignar"}</p>
            <div className="row">
              <form action={updateAppointmentStatus}>
                <input type="hidden" name="appointmentId" value={appt.id} />
                <input type="hidden" name="status" value="ATENDIDO" />
                <button type="submit">Atendido</button>
              </form>
              <form action={updateAppointmentStatus}>
                <input type="hidden" name="appointmentId" value={appt.id} />
                <input type="hidden" name="status" value="AUSENTE" />
                <button type="submit">Ausente</button>
              </form>
              <form action={updateAppointmentStatus}>
                <input type="hidden" name="appointmentId" value={appt.id} />
                <input type="hidden" name="status" value="CANCELADO" />
                <button type="submit">Cancelar</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
