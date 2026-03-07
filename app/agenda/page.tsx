import Link from "next/link";
import { updateAppointmentStatus } from "@/app/actions";
import AgendaHourlyBoard from "@/components/agenda-hourly-board";
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
  newPatientId?: string;
  newAgendaName?: string;
  newDate?: string;
  newTime?: string;
  newModality?: string;
  newNotes?: string;
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
  await requireRole(["ADMIN", "RECEPCION", "MEDICO"]);
  const params = await searchParams;
  const now = new Date();
  const dateFrom = params.dateFrom ?? formatDateInput(now);
  const dateTo = params.dateTo ?? formatDateInput(now);
  const hourFrom = params.hourFrom ?? "08:00";
  const hourTo = params.hourTo ?? "20:00";
  const calendarDate = params.calendarDate ?? dateFrom;
  const slotMinutesRaw = Number.parseInt(params.slotMinutes ?? "30", 10);
  const slotMinutes = Number.isFinite(slotMinutesRaw) ? Math.min(120, Math.max(5, slotMinutesRaw)) : 30;
  const selectedTime = params.selectedTime ?? params.newTime ?? "10:00";
  const newPatientId = params.newPatientId ?? "";
  const newAgendaName = params.newAgendaName ?? "Consulta Clinica";
  const newDate = params.newDate ?? dateFrom;
  const newTime = params.newTime ?? selectedTime;
  const newModality = params.newModality ?? "Ambulatorio";
  const newNotes = params.newNotes ?? "";

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
  const slotItems: Record<string, Array<{ id: string; time: string; patientLabel: string }>> = {};
  for (const slot of slots) {
    const items = bySlot.get(slot) ?? [];
    slotItems[slot] = items.map((appt) => ({
      id: appt.id,
      time: timeKey(appt.scheduledAt),
      patientLabel: `${appt.patient.lastName}, ${appt.patient.firstName}`
    }));
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
  const prevMonthKey = toDateKey(new Date(monthBase.getFullYear(), monthBase.getMonth() - 1, 1));
  const nextMonthKey = toDateKey(new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 1));
  const monthLabel = monthBase.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const baseQs = new URLSearchParams();
  if (params.q) baseQs.set("q", params.q);
  baseQs.set("hourFrom", hourFrom);
  baseQs.set("hourTo", hourTo);
  baseQs.set("slotMinutes", String(slotMinutes));
  baseQs.set("calendarDate", calendarDate);
  baseQs.set("dateFrom", dateFrom);
  baseQs.set("dateTo", dateTo);
  baseQs.set("selectedTime", selectedTime);
  baseQs.set("newAgendaName", newAgendaName);
  baseQs.set("newDate", newDate);
  baseQs.set("newTime", newTime);
  baseQs.set("newModality", newModality);
  if (newPatientId) baseQs.set("newPatientId", newPatientId);
  if (newNotes) baseQs.set("newNotes", newNotes);

  const prevMonthQs = new URLSearchParams(baseQs);
  prevMonthQs.set("calendarDate", prevMonthKey);
  const nextMonthQs = new URLSearchParams(baseQs);
  nextMonthQs.set("calendarDate", nextMonthKey);

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
          <input type="hidden" name="selectedTime" value={selectedTime} />
          <input type="hidden" name="newPatientId" value={newPatientId} />
          <input type="hidden" name="newAgendaName" value={newAgendaName} />
          <input type="hidden" name="newDate" value={newDate} />
          <input type="hidden" name="newTime" value={newTime} />
          <input type="hidden" name="newModality" value={newModality} />
          <input type="hidden" name="newNotes" value={newNotes} />
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
        <div className="calendar-head">
          <Link href={`/agenda?${prevMonthQs.toString()}`} className="calendar-nav" aria-label="Mes anterior">
            {"<"}
          </Link>
          <strong style={{ textTransform: "capitalize" }}>{monthLabel}</strong>
          <Link href={`/agenda?${nextMonthQs.toString()}`} className="calendar-nav" aria-label="Mes siguiente">
            {">"}
          </Link>
        </div>
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
            hrefQs.set("calendarDate", dayKey);
            hrefQs.set("newDate", dayKey);
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

        <hr style={{ margin: "14px 0" }} />
        <p className="small" style={{ marginBottom: 0 }}>
          Para cargar turno, hace click en una hora de la grilla y se abre la ventana rapida.
        </p>
      </aside>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>
          Agenda por horas ({dateFrom}) | Turnos en filtro: {appointments.length}
        </h3>
        <p className="small">Intervalo visual: {slotMinutes} minutos</p>
        <AgendaHourlyBoard
          dateFrom={dateFrom}
          slots={slots}
          bySlot={slotItems}
          patients={patients.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            nationalId: p.nationalId
          }))}
          defaults={{
            patientId: newPatientId,
            agendaName: newAgendaName,
            date: newDate,
            time: newTime,
            modality: newModality,
            notes: newNotes
          }}
          returnState={{
            dateFrom,
            dateTo,
            hourFrom,
            hourTo,
            q: params.q ?? "",
            calendarDate,
            selectedTime,
            slotMinutes: String(slotMinutes)
          }}
        />

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
