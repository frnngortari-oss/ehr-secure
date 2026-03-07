"use client";

import { useState } from "react";
import { createAppointment } from "@/app/actions";

type HourItem = {
  id: string;
  time: string;
  patientLabel: string;
};

type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
};

type Props = {
  dateFrom: string;
  slots: string[];
  bySlot: Record<string, HourItem[]>;
  patients: PatientOption[];
  defaults: {
    patientId: string;
    agendaName: string;
    date: string;
    time: string;
    modality: string;
    notes: string;
  };
  returnState: {
    dateFrom: string;
    dateTo: string;
    hourFrom: string;
    hourTo: string;
    q: string;
    calendarDate: string;
    selectedTime: string;
    slotMinutes: string;
  };
};

export default function AgendaHourlyBoard({ dateFrom, slots, bySlot, patients, defaults, returnState }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(returnState.selectedTime || defaults.time || slots[0] || "08:00");
  const [createNewPatient, setCreateNewPatient] = useState(!defaults.patientId);
  const [draft, setDraft] = useState({
    patientId: defaults.patientId,
    agendaName: defaults.agendaName,
    date: defaults.date,
    time: defaults.time || selectedSlot,
    modality: defaults.modality,
    notes: defaults.notes,
    newPatientFirstName: "",
    newPatientLastName: "",
    newPatientNationalId: "",
    newPatientBirthDate: "",
    newPatientSex: "F"
  });

  function openForSlot(slot: string) {
    setSelectedSlot(slot);
    setDraft((prev) => ({
      ...prev,
      date: dateFrom,
      time: slot
    }));
    setIsOpen(true);
  }

  return (
    <>
      <div className="hour-rows">
        {slots.map((slot) => {
          const items = bySlot[slot] ?? [];
          return (
            <button
              key={slot}
              type="button"
              className={slot === selectedSlot ? "hour-row active" : "hour-row"}
              onClick={() => openForSlot(slot)}
            >
              <div className="hour-row-time">{slot}</div>
              <div className="hour-row-main">
                <p className="small" style={{ margin: 0 }}>
                  Turnos: {items.length}
                </p>
                {items.length === 0 ? (
                  <p className="small" style={{ margin: "4px 0 0" }}>Disponible</p>
                ) : (
                  items.slice(0, 4).map((item) => (
                    <p key={item.id} className="small" style={{ margin: "4px 0 0" }}>
                      {item.time} - {item.patientLabel}
                    </p>
                  ))
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isOpen ? (
        <div className="agenda-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="agenda-modal card" onClick={(event) => event.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <h4 style={{ margin: 0 }}>Nuevo turno</h4>
              <button type="button" style={{ width: "auto", padding: "6px 10px" }} onClick={() => setIsOpen(false)}>
                Cerrar
              </button>
            </div>
            <p className="small" style={{ marginTop: 0 }}>
              Fecha: {draft.date} | Hora base: {selectedSlot} (puede editar minutos exactos, ej: 08:25)
            </p>

            <form action={createAppointment}>
              <input type="hidden" name="returnDateFrom" value={returnState.dateFrom} />
              <input type="hidden" name="returnDateTo" value={returnState.dateTo} />
              <input type="hidden" name="returnHourFrom" value={returnState.hourFrom} />
              <input type="hidden" name="returnHourTo" value={returnState.hourTo} />
              <input type="hidden" name="returnQ" value={returnState.q} />
              <input type="hidden" name="returnCalendarDate" value={returnState.calendarDate} />
              <input type="hidden" name="returnSelectedTime" value={selectedSlot} />
              <input type="hidden" name="returnSlotMinutes" value={returnState.slotMinutes} />

              <div style={{ marginBottom: 8 }}>
                <label>Paciente existente</label>
                <select
                  name="patientId"
                  value={draft.patientId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, patientId: event.target.value }))}
                  disabled={createNewPatient}
                  required={!createNewPatient}
                >
                  <option value="">Seleccionar</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.lastName}, {patient.firstName} ({patient.nationalId})
                    </option>
                  ))}
                </select>
              </div>

              <label className="row" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  name="createNewPatient"
                  value="1"
                  checked={createNewPatient}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setCreateNewPatient(checked);
                    if (checked) {
                      setDraft((prev) => ({ ...prev, patientId: "" }));
                    }
                  }}
                  style={{ width: "auto" }}
                />
                <span>Paciente no encontrado: crear nuevo ahora</span>
              </label>

              {createNewPatient ? (
                <div className="grid" style={{ marginBottom: 8 }}>
                  <div>
                    <label>Nombre</label>
                    <input
                      name="newPatientFirstName"
                      required
                      value={draft.newPatientFirstName}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newPatientFirstName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label>Apellido</label>
                    <input
                      name="newPatientLastName"
                      required
                      value={draft.newPatientLastName}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newPatientLastName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label>DNI</label>
                    <input
                      name="newPatientNationalId"
                      required
                      value={draft.newPatientNationalId}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newPatientNationalId: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label>Fecha nacimiento</label>
                    <input
                      type="date"
                      name="newPatientBirthDate"
                      required
                      value={draft.newPatientBirthDate}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newPatientBirthDate: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label>Sexo</label>
                    <select
                      name="newPatientSex"
                      required
                      value={draft.newPatientSex}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newPatientSex: event.target.value }))}
                    >
                      <option value="F">F</option>
                      <option value="M">M</option>
                      <option value="X">X</option>
                    </select>
                  </div>
                </div>
              ) : null}

              <div style={{ marginBottom: 8 }}>
                <label>Agenda</label>
                <input
                  name="agendaName"
                  required
                  value={draft.agendaName}
                  onChange={(event) => setDraft((prev) => ({ ...prev, agendaName: event.target.value }))}
                />
              </div>

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 8 }}>
                <div>
                  <label>Fecha</label>
                  <input
                    type="date"
                    name="date"
                    required
                    value={draft.date}
                    onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </div>
                <div>
                  <label>Hora exacta</label>
                  <input
                    type="time"
                    name="time"
                    required
                    step={60}
                    value={draft.time}
                    onChange={(event) => setDraft((prev) => ({ ...prev, time: event.target.value }))}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label>Modalidad</label>
                <input
                  name="modality"
                  value={draft.modality}
                  onChange={(event) => setDraft((prev) => ({ ...prev, modality: event.target.value }))}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label>Notas</label>
                <input
                  name="notes"
                  value={draft.notes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              <div className="row" style={{ justifyContent: "space-between" }}>
                <a href="/patients/new" className="small" style={{ color: "#0d4f91", textDecoration: "underline" }}>
                  Alta completa de paciente
                </a>
                <button type="submit" style={{ width: "auto" }}>Guardar turno</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
