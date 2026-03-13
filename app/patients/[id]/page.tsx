import Link from "next/link";
import { notFound } from "next/navigation";
import { createProblem, deleteEncounter, updateEncounter, updatePatient } from "@/app/actions";
import EvolutionComposeDrawer from "@/components/evolution-compose-drawer";
import FormattedEvolutionText from "@/components/formatted-evolution-text";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  section?: string;
  problemId?: string;
  evoAuthorId?: string;
  evoSpecialty?: string;
  evoProblemId?: string;
  error?: string;
};

type Params = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

function toDateInputValue(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function toDatetimeInputValue(value: Date) {
  return new Date(value).toISOString().slice(0, 16);
}

const roleLabels: Record<string, string> = {
  MEDICO: "Medico",
  PSICOLOGO: "Psicologia",
  FONOAUDIOLOGO: "Fonoaudiologia",
  KINESIOLOGO: "Kinesiologia",
  TERAPISTA_OCUPACIONAL: "Terapia ocupacional",
  RECEPCION: "Recepcion",
  ADMIN: "Administrador"
};

export default async function PatientDetailPage({ params, searchParams }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      encounters: {
        include: {
          author: { select: { fullName: true, role: true, medicalSpecialty: true } },
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
  const canWorkClinical =
    user.role === "ADMIN" ||
    user.role === "MEDICO" ||
    user.role === "PSICOLOGO" ||
    user.role === "FONOAUDIOLOGO" ||
    user.role === "KINESIOLOGO" ||
    user.role === "TERAPISTA_OCUPACIONAL";
  const canDeleteEncounter = user.role === "ADMIN";

  const selectedSection = "evolutions";
  const errorCode = query.error ?? "";
  const errorText: Record<string, string> = {
    evolution_invalid: "No se pudo guardar la evolucion. Revisa motivo y fecha.",
    evolution_edit_invalid: "No se pudo guardar la edicion. Revisa los campos obligatorios.",
    evolution_date: "La fecha/hora no es valida.",
    evolution_problem_invalid: "Si cargas un problema nuevo desde la evolucion, debe tener al menos 3 caracteres.",
    document_upload_disabled: "La carga de documentacion esta deshabilitada."
  };
  const selectedProblemCardId = query.problemId ?? "";
  const evoAuthorId = query.evoAuthorId ?? "";
  const evoSpecialty = query.evoSpecialty ?? "";
  const evoProblemId = query.evoProblemId ?? "";

  const specialtyOfEncounter = (encounter: (typeof patient.encounters)[number]) => {
    if (encounter.authorSpecialty) return encounter.authorSpecialty;
    if (encounter.author?.role === "MEDICO") return encounter.author.medicalSpecialty ?? "Medicina general";
    if (encounter.author?.role) return roleLabels[encounter.author.role] ?? encounter.author.role;
    return "Sin especialidad";
  };

  const availableSpecialties = Array.from(new Set(patient.encounters.map((encounter) => specialtyOfEncounter(encounter))));

  const authorOptions = patient.encounters
    .filter((encounter) => Boolean(encounter.authorId))
    .reduce<Array<{ id: string; label: string }>>((acc, encounter) => {
      const key = encounter.authorId as string;
      if (!acc.some((item) => item.id === key)) {
        acc.push({ id: key, label: encounter.author?.fullName ?? "Sin profesional" });
      }
      return acc;
    }, []);

  const filteredEncounters = patient.encounters.filter((encounter) => {
    if (evoAuthorId && encounter.authorId !== evoAuthorId) return false;
    if (evoSpecialty && specialtyOfEncounter(encounter) !== evoSpecialty) return false;
    if (evoProblemId === "__NONE__" && encounter.problemId) return false;
    if (evoProblemId && evoProblemId !== "__NONE__" && (encounter.problemId ?? "") !== evoProblemId) return false;
    return true;
  });

  const selectedProblem = patient.problems.find((problem) => problem.id === selectedProblemCardId) ?? null;
  const linkedEncounters = selectedProblem
    ? patient.encounters.filter((encounter) => encounter.problemId === selectedProblem.id)
    : [];

  const encounterCountByProblem = new Map<string, number>();
  for (const encounter of patient.encounters) {
    if (!encounter.problemId) continue;
    encounterCountByProblem.set(encounter.problemId, (encounterCountByProblem.get(encounter.problemId) ?? 0) + 1);
  }

  const baseParams = {
    section: selectedSection,
    problemId: selectedProblemCardId,
    evoAuthorId,
    evoSpecialty,
    evoProblemId
  };

  const buildHref = (overrides: Partial<typeof baseParams>) => {
    const merged = { ...baseParams, ...overrides };
    const qs = new URLSearchParams();
    if (merged.section) qs.set("section", merged.section);
    if (merged.problemId) qs.set("problemId", merged.problemId);
    if (merged.evoAuthorId) qs.set("evoAuthorId", merged.evoAuthorId);
    if (merged.evoSpecialty) qs.set("evoSpecialty", merged.evoSpecialty);
    if (merged.evoProblemId) qs.set("evoProblemId", merged.evoProblemId);
    return `/patients/${patient.id}${qs.toString() ? `?${qs.toString()}` : ""}`;
  };
  const currentPatientHref = buildHref({});

  return (
    <div>
      {errorCode && errorText[errorCode] ? (
        <div className="card" style={{ borderColor: "#ef4444", background: "#fff1f2" }}>
          <p style={{ margin: 0, color: "#9f1239", fontWeight: 600 }}>{errorText[errorCode]}</p>
        </div>
      ) : null}

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

      <div className="patient-layout">
        <aside className="card patient-subindex">
          <h3 style={{ marginTop: 0 }}>Subindice</h3>
          <Link
            href={buildHref({ section: "evolutions" })}
            className={selectedSection === "evolutions" ? "subindex-link active" : "subindex-link"}
          >
            Evoluciones
          </Link>

          {selectedSection === "evolutions" ? (
            <>
              <div className="subindex-group">
                <p className="small" style={{ margin: "8px 0 6px" }}>Filtrar por problema</p>
                <Link href={buildHref({ evoProblemId: "" })} className={evoProblemId === "" ? "subindex-link active" : "subindex-link"}>
                  Todos
                </Link>
                <Link href={buildHref({ evoProblemId: "__NONE__" })} className={evoProblemId === "__NONE__" ? "subindex-link active" : "subindex-link"}>
                  Sin asociar
                </Link>
                {patient.problems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={buildHref({ evoProblemId: problem.id })}
                    className={evoProblemId === problem.id ? "subindex-link active" : "subindex-link"}
                  >
                    {problem.title}
                  </Link>
                ))}
              </div>

              <div className="subindex-group">
                <p className="small" style={{ margin: "8px 0 6px" }}>Filtrar por especialidad</p>
                <Link href={buildHref({ evoSpecialty: "" })} className={evoSpecialty === "" ? "subindex-link active" : "subindex-link"}>
                  Todas
                </Link>
                {availableSpecialties.map((specialty) => (
                  <Link
                    key={specialty}
                    href={buildHref({ evoSpecialty: specialty })}
                    className={evoSpecialty === specialty ? "subindex-link active" : "subindex-link"}
                  >
                    {specialty}
                  </Link>
                ))}
              </div>
            </>
          ) : null}

        </aside>

        <section>
          <>
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Problemas activos</h3>
                {patient.problems.length === 0 ? <p className="small">Sin problemas cargados.</p> : null}
                {patient.problems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={buildHref({ problemId: problem.id })}
                    className={selectedProblemCardId === problem.id ? "problem-item active" : "problem-item"}
                  >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="badge">{problem.category}</span>
                      <span className="small">{encounterCountByProblem.get(problem.id) ?? 0} evol.</span>
                    </div>
                    <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 600 }}>{problem.title}</p>
                    <p className="small" style={{ marginTop: 4 }}>
                      Inicio: {new Date(problem.startedAt).toLocaleDateString("es-AR")}
                    </p>
                  </Link>
                ))}
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
                    <p className="small">Profesional: {encounter.author?.fullName ?? "Sin dato"} | Especialidad: {specialtyOfEncounter(encounter)}</p>
                    <p style={{ margin: "4px 0" }}><strong>Motivo:</strong> {encounter.reason}</p>
                    <p style={{ margin: "4px 0" }}><strong>Plan:</strong> {encounter.plan}</p>
                    {encounter.content ? (
                      <p style={{ marginBottom: 0 }}>
                        <FormattedEvolutionText text={encounter.content} />
                      </p>
                    ) : null}
                    {canDeleteEncounter ? (
                      <details style={{ marginTop: 8 }}>
                        <summary className="small" style={{ cursor: "pointer", color: "#b3261e" }}>
                          Eliminar evolucion (solo admin)
                        </summary>
                        <form action={deleteEncounter} style={{ marginTop: 8 }}>
                          <input type="hidden" name="encounterId" value={encounter.id} />
                          <input type="hidden" name="patientId" value={patient.id} />
                          <input type="hidden" name="returnTo" value={currentPatientHref} />
                          <label>Motivo de eliminacion (obligatorio)</label>
                          <textarea name="deleteReason" rows={2} required placeholder="Ej: Evolucion cargada al paciente incorrecto" />
                          <button style={{ marginTop: 8, background: "#b3261e" }} type="submit">Confirmar eliminacion</button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ marginTop: 0, marginBottom: 0 }}>Evoluciones</h3>
                  {canWorkClinical ? (
                    <EvolutionComposeDrawer
                      patientId={patient.id}
                      problems={patient.problems.map((problem) => ({ id: problem.id, title: problem.title }))}
                    />
                  ) : null}
                </div>
                <form method="GET" className="grid" style={{ marginBottom: 10 }}>
                  <input type="hidden" name="section" value="evolutions" />
                  <input type="hidden" name="problemId" value={selectedProblemCardId} />
                  <input type="hidden" name="evoSpecialty" value={evoSpecialty} />
                  <input type="hidden" name="evoProblemId" value={evoProblemId} />
                  <div>
                    <label>Profesional</label>
                    <select name="evoAuthorId" defaultValue={evoAuthorId}>
                      <option value="">Todos</option>
                      {authorOptions.map((author) => (
                        <option key={author.id} value={author.id}>{author.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="row" style={{ alignItems: "flex-end" }}>
                    <button type="submit">Aplicar</button>
                  </div>
                </form>

                {filteredEncounters.length === 0 ? <p className="small">Sin evoluciones para ese filtro.</p> : null}
                {filteredEncounters.map((encounter) => (
                  <article key={encounter.id} className="card" style={{ marginBottom: 10 }}>
                    <p className="small">{new Date(encounter.occurredAt).toLocaleString("es-AR")}</p>
                    <p className="small">
                      Profesional: {encounter.author?.fullName ?? "Sin dato"} | Especialidad: {specialtyOfEncounter(encounter)} | Problema: {encounter.problem?.title ?? "Sin asociar"}
                    </p>
                    <p><strong>Motivo:</strong> {encounter.reason}</p>
                    <p><strong>Plan:</strong> {encounter.plan}</p>
                    {encounter.content ? (
                      <p>
                        <FormattedEvolutionText text={encounter.content} />
                      </p>
                    ) : null}
                    {canWorkClinical ? (
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
                    {canDeleteEncounter ? (
                      <details style={{ marginTop: 8 }}>
                        <summary className="small" style={{ cursor: "pointer", color: "#b3261e" }}>
                          Eliminar evolucion (solo admin)
                        </summary>
                        <form action={deleteEncounter} style={{ marginTop: 8 }}>
                          <input type="hidden" name="encounterId" value={encounter.id} />
                          <input type="hidden" name="patientId" value={patient.id} />
                          <input type="hidden" name="returnTo" value={currentPatientHref} />
                          <label>Motivo de eliminacion (obligatorio)</label>
                          <textarea name="deleteReason" rows={2} required placeholder="Ej: Evolucion cargada al paciente incorrecto" />
                          <button style={{ marginTop: 8, background: "#b3261e" }} type="submit">Confirmar eliminacion</button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>

              {canWorkClinical ? (
                <div className="card">
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 600 }}>Agregar problema activo</summary>
                    <form action={createProblem} style={{ marginTop: 10 }}>
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
                  </details>
                </div>
              ) : null}
          </>
        </section>
      </div>
    </div>
  );
}
