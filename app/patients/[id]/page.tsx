import { notFound } from "next/navigation";
import { createEncounter, createProblem, updatePatient } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function toDateInputValue(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function toDatetimeInputValue(value: Date) {
  return new Date(value).toISOString().slice(0, 16);
}

export default async function PatientDetailPage({ params }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      encounters: {
        include: {
          author: { select: { fullName: true } },
          problem: true
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 10
      },
      problems: {
        where: { isActive: true },
        orderBy: { startedAt: "desc" }
      }
    }
  });

  if (!patient) return notFound();

  const canEditPatient = user.role === "ADMIN" || user.role === "RECEPCION";
  const canAddEncounter = user.role === "ADMIN" || user.role === "MEDICO";

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{patient.lastName}, {patient.firstName}</h2>
        <p className="small">DNI: {patient.nationalId}</p>
        <p className="small">Nacimiento: {new Date(patient.birthDate).toLocaleDateString("es-AR")}</p>
      </div>

      {canEditPatient && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Editar datos del paciente</h3>
          <form action={updatePatient}>
            <input type="hidden" name="patientId" value={patient.id} />
            <div className="grid">
              <div>
                <label>Nombre</label>
                <input name="firstName" defaultValue={patient.firstName} required />
              </div>
              <div>
                <label>Apellido</label>
                <input name="lastName" defaultValue={patient.lastName} required />
              </div>
              <div>
                <label>DNI</label>
                <input name="nationalId" defaultValue={patient.nationalId} required />
              </div>
              <div>
                <label>Fecha de nacimiento</label>
                <input type="date" name="birthDate" defaultValue={toDateInputValue(patient.birthDate)} required />
              </div>
              <div>
                <label>Sexo</label>
                <select name="sex" defaultValue={patient.sex}>
                  <option value="F">F</option>
                  <option value="M">M</option>
                  <option value="X">X</option>
                </select>
              </div>
              <div>
                <label>Email</label>
                <input type="email" name="email" defaultValue={patient.email ?? ""} />
              </div>
              <div>
                <label>Telefono</label>
                <input name="phone" defaultValue={patient.phone ?? ""} />
              </div>
              <div>
                <label>Direccion</label>
                <input name="address" defaultValue={patient.address ?? ""} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="submit">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Problemas activos</h3>
          {patient.problems.length === 0 ? <p className="small">Sin problemas cargados.</p> : null}
          {patient.problems.map((problem) => (
            <article key={problem.id} className="card">
              <span className="badge">{problem.category}</span>
              <p style={{ marginTop: 8, marginBottom: 0 }}><strong>{problem.title}</strong></p>
              <p className="small">Inicio: {new Date(problem.startedAt).toLocaleDateString("es-AR")}</p>
            </article>
          ))}

          {canAddEncounter && (
            <form action={createProblem}>
              <input type="hidden" name="patientId" value={patient.id} />
              <div style={{ marginBottom: 8 }}>
                <label>Nuevo problema</label>
                <input name="title" placeholder="Ej: EPOC descompensado" required />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>Categoria</label>
                <input name="category" defaultValue="Problema" />
              </div>
              <button type="submit">Agregar problema</button>
            </form>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Turnos recientes</h3>
          {patient.appointments.length === 0 ? <p className="small">Sin turnos cargados.</p> : null}
          {patient.appointments.map((appt) => (
            <article key={appt.id} className="card">
              <p style={{ marginBottom: 4 }}><strong>{new Date(appt.scheduledAt).toLocaleString("es-AR")}</strong></p>
              <p className="small">Agenda: {appt.agendaName}</p>
              <p className="small">Estado: {appt.status}</p>
              <p className="small">Modalidad: {appt.modality ?? "Ambulatorio"}</p>
            </article>
          ))}
        </div>
      </div>

      {canAddEncounter && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Nueva evolucion</h3>
          <form action={createEncounter}>
            <input type="hidden" name="patientId" value={patient.id} />
            <div className="grid">
              <div>
                <label>Fecha y hora</label>
                <input type="datetime-local" name="occurredAt" defaultValue={toDatetimeInputValue(new Date())} />
              </div>
              <div>
                <label>Problema asociado</label>
                <select name="problemId" defaultValue="">
                  <option value="">Sin asociar</option>
                  {patient.problems.map((problem) => (
                    <option key={problem.id} value={problem.id}>{problem.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Motivo de consulta</label>
              <input name="reason" required />
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Plan</label>
              <textarea name="plan" rows={2} required />
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Texto libre de evolucion</label>
              <textarea name="content" rows={8} placeholder="Ingrese aqui la evolucion..." />
            </div>
            <button style={{ marginTop: 10 }} type="submit">Guardar evolucion</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Evoluciones</h3>
        {patient.encounters.length === 0 ? <p className="small">Sin evoluciones todavia.</p> : null}
        {patient.encounters.map((encounter) => (
          <article key={encounter.id} className="card" style={{ marginBottom: 10 }}>
            <p className="small">{new Date(encounter.occurredAt).toLocaleString("es-AR")}</p>
            <p className="small">
              Profesional: {encounter.author?.fullName ?? "Sin dato"} | Problema: {encounter.problem?.title ?? "Sin asociar"}
            </p>
            <p><strong>Motivo:</strong> {encounter.reason}</p>
            <p><strong>Plan:</strong> {encounter.plan}</p>
            {encounter.content ? <p style={{ whiteSpace: "pre-wrap" }}>{encounter.content}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
