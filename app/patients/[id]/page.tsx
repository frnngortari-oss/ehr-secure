import Link from "next/link";
import { notFound } from "next/navigation";
import { createEncounter, createProblem, updateEncounter, updatePatient } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = { problemId?: string };
type Params = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

function toDateInputValue(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function toDatetimeInputValue(value: Date) {
  return new Date(value).toISOString().slice(0, 16);
}

export default async function PatientDetailPage({ params, searchParams }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
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
      problems: {
        where: { isActive: true },
        orderBy: { startedAt: "desc" }
      }
    }
  });

  if (!patient) return notFound();

  const canEditPatient = user.role === "ADMIN" || user.role === "RECEPCION";
  const canAddEncounter = user.role === "ADMIN" || user.role === "MEDICO";
  const selectedProblemId = query.problemId ?? "";
  const selectedProblem = patient.problems.find((problem) => problem.id === selectedProblemId) ?? null;
  const linkedEncounters = selectedProblem
    ? patient.encounters.filter((encounter) => encounter.problemId === selectedProblem.id)
    : [];
  const encounterCountByProblem = new Map<string, number>();
  for (const encounter of patient.encounters) {
    if (!encounter.problemId) continue;
    encounterCountByProblem.set(encounter.problemId, (encounterCountByProblem.get(encounter.problemId) ?? 0) + 1);
  }

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
            <Link
              key={problem.id}
              href={`/patients/${patient.id}?problemId=${problem.id}#linked-evolutions`}
              className={selectedProblemId === problem.id ? "problem-item active" : "problem-item"}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge">{problem.category}</span>
                <span className="small">
                  {encounterCountByProblem.get(problem.id) ?? 0} evol.
                </span>
              </div>
              <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 600 }}>{problem.title}</p>
              <p className="small" style={{ marginTop: 4 }}>
                Inicio: {new Date(problem.startedAt).toLocaleDateString("es-AR")}
              </p>
            </Link>
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

        <div id="linked-evolutions" className="card">
          <h3 style={{ marginTop: 0 }}>
            Evoluciones vinculadas {selectedProblem ? `- ${selectedProblem.title}` : ""}
          </h3>
          {!selectedProblem ? <p className="small">Selecciona un problema activo para ver sus evoluciones.</p> : null}
          {selectedProblem && linkedEncounters.length === 0 ? (
            <p className="small">No hay evoluciones asociadas a este problema.</p>
          ) : null}
          {linkedEncounters.map((encounter) => (
            <article key={encounter.id} className="card" style={{ marginBottom: 8, padding: 10 }}>
              <p className="small">{new Date(encounter.occurredAt).toLocaleString("es-AR")}</p>
              <p className="small">Profesional: {encounter.author?.fullName ?? "Sin dato"}</p>
              <p style={{ margin: "4px 0" }}><strong>Motivo:</strong> {encounter.reason}</p>
              <p style={{ margin: "4px 0" }}><strong>Plan:</strong> {encounter.plan}</p>
              {encounter.content ? <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{encounter.content}</p> : null}
              {canAddEncounter ? (
                <details style={{ marginTop: 8 }}>
                  <summary className="small" style={{ cursor: "pointer" }}>Editar evolucion</summary>
                  <form action={updateEncounter} style={{ marginTop: 8 }}>
                    <input type="hidden" name="encounterId" value={encounter.id} />
                    <input type="hidden" name="patientId" value={patient.id} />
                    <div className="grid">
                      <div>
                        <label>Fecha y hora</label>
                        <input type="datetime-local" name="occurredAt" defaultValue={toDatetimeInputValue(encounter.occurredAt)} required />
                      </div>
                      <div>
                        <label>Problema asociado</label>
                        <select name="problemId" defaultValue={encounter.problemId ?? ""}>
                          <option value="">Sin asociar</option>
                          {patient.problems.map((problem) => (
                            <option key={problem.id} value={problem.id}>{problem.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Motivo</label>
                      <input name="reason" defaultValue={encounter.reason} required />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Texto libre</label>
                      <textarea name="content" rows={4} defaultValue={encounter.content ?? ""} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Plan</label>
                      <textarea name="plan" rows={3} defaultValue={encounter.plan} required />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label>Motivo de la edicion (obligatorio)</label>
                      <textarea name="editReason" rows={2} required placeholder="Ej: Correccion de dato clinico" />
                    </div>
                    <button style={{ marginTop: 8 }} type="submit">Guardar edicion</button>
                  </form>
                </details>
              ) : null}
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
              <label>Texto libre de evolucion</label>
              <textarea name="content" rows={8} placeholder="Ingrese aqui la evolucion..." />
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Plan</label>
              <textarea name="plan" rows={2} required />
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
            {canAddEncounter ? (
              <details>
                <summary className="small" style={{ cursor: "pointer" }}>Editar evolucion</summary>
                <form action={updateEncounter} style={{ marginTop: 8 }}>
                  <input type="hidden" name="encounterId" value={encounter.id} />
                  <input type="hidden" name="patientId" value={patient.id} />
                  <div className="grid">
                    <div>
                      <label>Fecha y hora</label>
                      <input type="datetime-local" name="occurredAt" defaultValue={toDatetimeInputValue(encounter.occurredAt)} required />
                    </div>
                    <div>
                      <label>Problema asociado</label>
                      <select name="problemId" defaultValue={encounter.problemId ?? ""}>
                        <option value="">Sin asociar</option>
                        {patient.problems.map((problem) => (
                          <option key={problem.id} value={problem.id}>{problem.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>Motivo</label>
                    <input name="reason" defaultValue={encounter.reason} required />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>Texto libre</label>
                    <textarea name="content" rows={4} defaultValue={encounter.content ?? ""} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>Plan</label>
                    <textarea name="plan" rows={3} defaultValue={encounter.plan} required />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>Motivo de la edicion (obligatorio)</label>
                    <textarea name="editReason" rows={2} required placeholder="Ej: Correccion de dato clinico" />
                  </div>
                  <button style={{ marginTop: 8 }} type="submit">Guardar edicion</button>
                </form>
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
