"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearSession, getCurrentUser, requireRole, setSession } from "@/lib/auth";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/security";
import { createAuditLog } from "@/lib/audit";
import { clearLoginAttempts, getLoginBlockRemainingMs, registerFailedLogin } from "@/lib/rate-limit";

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6)
});

const patientSchema = z.object({
  patientId: z.string().uuid().optional(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  nationalId: z.string().min(6),
  birthDate: z.string().min(1),
  sex: z.enum(["F", "M", "X"]),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional()
});

const problemSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().min(3),
  category: z.string().optional()
});

const encounterSchema = z.object({
  patientId: z.string().uuid(),
  reason: z.string().optional().or(z.literal("")),
  assessment: z.string().optional(),
  plan: z.string().optional().or(z.literal("")),
  occurredAt: z.string().optional(),
  content: z.string().optional(),
  problemId: z.string().uuid().optional().or(z.literal("")),
  createNewProblem: z.string().optional(),
  newProblemTitle: z.string().optional(),
  newProblemCategory: z.string().optional()
});

const encounterUpdateSchema = z.object({
  encounterId: z.string().uuid(),
  patientId: z.string().uuid(),
  reason: z.string().trim().min(1),
  plan: z.string().optional().or(z.literal("")),
  content: z.string().optional(),
  occurredAt: z.string().min(1),
  problemId: z.string().uuid().optional().or(z.literal("")),
  editReason: z.string().trim().min(1)
});

const uploadDocumentSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().min(2),
  category: z.string().optional()
});

const appointmentSchema = z.object({
  patientId: z.string().uuid().optional().or(z.literal("")),
  agendaName: z.string().min(3),
  date: z.string().min(1),
  time: z.string().min(1),
  modality: z.string().optional(),
  notes: z.string().optional(),
  clinicianId: z.string().uuid().optional().nullable().or(z.literal("")),
  createNewPatient: z.string().optional(),
  newPatientFirstName: z.string().optional(),
  newPatientLastName: z.string().optional(),
  newPatientNationalId: z.string().optional(),
  newPatientBirthDate: z.string().optional(),
  newPatientSex: z.enum(["F", "M", "X"]).optional()
});

const quickPatientSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  nationalId: z.string().min(6),
  birthDate: z.string().min(1),
  sex: z.enum(["F", "M", "X"])
});

const appointmentStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["PENDIENTE", "ATENDIDO", "AUSENTE", "CANCELADO"])
});

const adminUserCreateSchema = z.object({
  email: z.string().min(3),
  fullName: z.string().min(3),
  role: z.enum(["MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL", "RECEPCION"]),
  medicalSpecialty: z.string().optional(),
  password: z.string().min(10)
}).superRefine((value, ctx) => {
  if (value.role === "MEDICO" && (!value.medicalSpecialty || value.medicalSpecialty.trim().length < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["medicalSpecialty"],
      message: "La especialidad es obligatoria para medicos"
    });
  }

  const passwordValidationError = validatePasswordStrength(value.password);
  if (passwordValidationError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: passwordValidationError
    });
  }
});

async function getClientIdentifier() {
  const h = await headers();
  const xForwardedFor = h.get("x-forwarded-for");
  if (xForwardedFor) {
    const ip = xForwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown-client";
}

export async function login(formData: FormData) {
  const usernameInput = (formData.get("username") ?? "").toString().trim();
  const clientId = await getClientIdentifier();
  const remainingMs = getLoginBlockRemainingMs(clientId, usernameInput);
  if (remainingMs > 0) {
    const waitMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    redirect(`/login?error=locked&wait=${waitMinutes}`);
  }

  const parsed = loginSchema.safeParse({
    username: usernameInput,
    password: formData.get("password")
  });
  if (!parsed.success) {
    registerFailedLogin(clientId, usernameInput);
    redirect("/login?error=cred");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.username }
  });
  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    registerFailedLogin(clientId, parsed.data.username);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        entity: "Session",
        entityId: user.id,
        after: { email: user.email }
      });
    }
    redirect("/login?error=cred");
  }

  clearLoginAttempts(clientId, parsed.data.username);

  await createAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: "LOGIN",
    entity: "Session",
    entityId: user.id,
    after: { email: user.email }
  });

  await setSession(user.id);
  redirect("/");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    await createAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: "LOGOUT",
      entity: "Session",
      entityId: user.id
    });
  }
  await clearSession();
  redirect("/login");
}

export async function createPatient(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const parsed = patientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    nationalId: formData.get("nationalId"),
    birthDate: formData.get("birthDate"),
    sex: formData.get("sex"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address")
  });
  if (!parsed.success) throw new Error("Datos de paciente invalidos");

  const alreadyExists = await prisma.patient.findUnique({
    where: { nationalId: parsed.data.nationalId }
  });
  if (alreadyExists) redirect("/patients/new?error=dni");

  const created = await prisma.patient.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      nationalId: parsed.data.nationalId,
      birthDate: new Date(parsed.data.birthDate),
      sex: parsed.data.sex,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "CREATE_PATIENT",
    entity: "Patient",
    entityId: created.id,
    patientId: created.id,
    after: created
  });

  revalidatePath("/patients");
  redirect("/patients");
}

export async function updatePatient(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION"]);
  const parsed = patientSchema.safeParse({
    patientId: formData.get("patientId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    nationalId: formData.get("nationalId"),
    birthDate: formData.get("birthDate"),
    sex: formData.get("sex"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address")
  });
  if (!parsed.success || !parsed.data.patientId) throw new Error("Datos de paciente invalidos");

  const previous = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
  if (!previous) throw new Error("Paciente no encontrado");

  const updated = await prisma.patient.update({
    where: { id: parsed.data.patientId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      nationalId: parsed.data.nationalId,
      birthDate: new Date(parsed.data.birthDate),
      sex: parsed.data.sex,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "UPDATE_PATIENT",
    entity: "Patient",
    entityId: updated.id,
    patientId: updated.id,
    before: previous,
    after: updated
  });

  revalidatePath(`/patients/${updated.id}`);
  revalidatePath("/patients");
  revalidatePath("/patients/search");
  redirect(`/patients/${updated.id}`);
}

export async function createProblem(formData: FormData) {
  const actor = await requireRole(["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const parsed = problemSchema.safeParse({
    patientId: formData.get("patientId"),
    title: formData.get("title"),
    category: formData.get("category")
  });
  if (!parsed.success) throw new Error("Datos de problema invalidos");

  const created = await prisma.problem.create({
    data: {
      patientId: parsed.data.patientId,
      title: parsed.data.title,
      category: parsed.data.category || "Problema",
      createdById: actor.id
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "CREATE_PROBLEM",
    entity: "Problem",
    entityId: created.id,
    patientId: created.patientId,
    after: created
  });

  revalidatePath(`/patients/${created.patientId}`);
  revalidatePath("/evolutions");
  redirect(`/patients/${created.patientId}`);
}

export async function createEncounter(formData: FormData) {
  const actor = await requireRole(["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const patientIdInput = (formData.get("patientId") ?? "").toString();
  const reasonInput = (formData.get("reason") ?? "").toString();
  const assessmentInput = (formData.get("assessment") ?? "").toString();
  const planInput = (formData.get("plan") ?? "").toString();
  const occurredAtInput = (formData.get("occurredAt") ?? "").toString();
  const contentInput = (formData.get("content") ?? "").toString();
  const problemIdInput = (formData.get("problemId") ?? "").toString();
  const createNewProblemInput = (formData.get("createNewProblem") ?? "").toString();
  const newProblemTitleInput = (formData.get("newProblemTitle") ?? "").toString();
  const newProblemCategoryInput = (formData.get("newProblemCategory") ?? "").toString();
  const parsed = encounterSchema.safeParse({
    patientId: patientIdInput,
    reason: reasonInput,
    assessment: assessmentInput,
    plan: planInput,
    occurredAt: occurredAtInput,
    content: contentInput,
    problemId: problemIdInput,
    createNewProblem: createNewProblemInput,
    newProblemTitle: newProblemTitleInput,
    newProblemCategory: newProblemCategoryInput
  });
  if (!parsed.success) {
    console.error("createEncounter validation failed", parsed.error.flatten());
    if (patientIdInput) redirect(`/patients/${patientIdInput}?error=evolution_invalid`);
    throw new Error("Datos de evolucion invalidos");
  }

  const occurredAt = new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    redirect(`/patients/${parsed.data.patientId}?error=evolution_date`);
  }
  const reason = parsed.data.reason?.trim() || "Evolucion clinica";
  const plan = parsed.data.plan?.trim() || "Sin plan consignado";
  const assessment = parsed.data.assessment?.trim() || "Sin evaluacion";
  const content = parsed.data.content?.trim() || `Motivo: ${reason}\n\nPlan: ${plan}`;
  const shouldCreateProblem =
    parsed.data.createNewProblem === "1" || (!parsed.data.problemId && Boolean(parsed.data.newProblemTitle?.trim()));
  let problemId = parsed.data.problemId || null;

  if (shouldCreateProblem) {
    const problemTitle = parsed.data.newProblemTitle?.trim() || "";
    if (problemTitle.length < 3) {
      redirect(`/patients/${parsed.data.patientId}?error=evolution_problem_invalid`);
    }
    const createdProblem = await prisma.problem.create({
      data: {
        patientId: parsed.data.patientId,
        title: problemTitle,
        category: parsed.data.newProblemCategory?.trim() || "Problema",
        createdById: actor.id
      }
    });
    problemId = createdProblem.id;

    await createAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "CREATE_PROBLEM",
      entity: "Problem",
      entityId: createdProblem.id,
      patientId: createdProblem.patientId,
      after: createdProblem
    });
  }

  const encounter = await prisma.encounter.create({
    data: {
      patientId: parsed.data.patientId,
      reason,
      assessment,
      plan,
      occurredAt,
      content,
      problemId,
      authorId: actor.id,
      authorRole: actor.role,
      authorSpecialty: actor.role === "MEDICO" ? (actor.medicalSpecialty ?? null) : actor.role
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "CREATE_ENCOUNTER",
    entity: "Encounter",
    entityId: encounter.id,
    patientId: parsed.data.patientId,
    after: encounter
  });

  revalidatePath(`/patients/${parsed.data.patientId}`);
  revalidatePath("/evolutions");
  revalidatePath("/audit");
  redirect(`/patients/${parsed.data.patientId}`);
}

export async function updateEncounter(formData: FormData) {
  const actor = await requireRole(["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const patientIdInput = (formData.get("patientId") ?? "").toString();
  const parsed = encounterUpdateSchema.safeParse({
    encounterId: formData.get("encounterId"),
    patientId: patientIdInput,
    reason: formData.get("reason"),
    plan: formData.get("plan"),
    content: formData.get("content"),
    occurredAt: formData.get("occurredAt"),
    problemId: formData.get("problemId"),
    editReason: formData.get("editReason")
  });
  if (!parsed.success) {
    console.error("updateEncounter validation failed", parsed.error.flatten());
    if (patientIdInput) redirect(`/patients/${patientIdInput}?error=evolution_edit_invalid`);
    throw new Error("Datos de edicion de evolucion invalidos");
  }

  const previous = await prisma.encounter.findUnique({
    where: { id: parsed.data.encounterId }
  });
  if (!previous) throw new Error("Evolucion no encontrada");

  const occurredAt = new Date(parsed.data.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    redirect(`/patients/${parsed.data.patientId}?error=evolution_date`);
  }
  const reason = parsed.data.reason.trim();
  const plan = parsed.data.plan?.trim() || "Sin plan consignado";

  const updated = await prisma.encounter.update({
    where: { id: parsed.data.encounterId },
    data: {
      reason,
      plan,
      content: parsed.data.content?.trim() || null,
      occurredAt,
      problemId: parsed.data.problemId || null
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "UPDATE_ENCOUNTER",
    entity: "Encounter",
    entityId: updated.id,
    patientId: parsed.data.patientId,
    before: previous,
    after: { ...updated, editReason: parsed.data.editReason }
  });

  revalidatePath(`/patients/${parsed.data.patientId}`);
  revalidatePath("/evolutions");
  revalidatePath("/audit");
  redirect(`/patients/${parsed.data.patientId}`);
}

export async function createAppointment(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const patientIdInput = (formData.get("patientId") ?? "").toString();
  const agendaNameInput = (formData.get("agendaName") ?? "").toString();
  const dateInput = (formData.get("date") ?? "").toString();
  const timeInput = (formData.get("time") ?? "").toString();
  const modalityInput = (formData.get("modality") ?? "").toString();
  const notesInput = (formData.get("notes") ?? "").toString();
  const clinicianIdInput = (formData.get("clinicianId") ?? "").toString();
  const createNewPatientInput = (formData.get("createNewPatient") ?? "").toString();
  const newPatientFirstNameInput = (formData.get("newPatientFirstName") ?? "").toString();
  const newPatientLastNameInput = (formData.get("newPatientLastName") ?? "").toString();
  const newPatientNationalIdInput = (formData.get("newPatientNationalId") ?? "").toString();
  const newPatientBirthDateInput = (formData.get("newPatientBirthDate") ?? "").toString();
  const newPatientSexInput = (formData.get("newPatientSex") ?? "").toString();

  const parsed = appointmentSchema.safeParse({
    patientId: patientIdInput,
    agendaName: agendaNameInput,
    date: dateInput,
    time: timeInput,
    modality: modalityInput,
    notes: notesInput,
    clinicianId: clinicianIdInput,
    createNewPatient: createNewPatientInput || undefined,
    newPatientFirstName: newPatientFirstNameInput || undefined,
    newPatientLastName: newPatientLastNameInput || undefined,
    newPatientNationalId: newPatientNationalIdInput || undefined,
    newPatientBirthDate: newPatientBirthDateInput || undefined,
    newPatientSex: newPatientSexInput ? (newPatientSexInput as "F" | "M" | "X") : undefined
  });
  if (!parsed.success) throw new Error("Datos de turno invalidos");

  const shouldCreatePatient = parsed.data.createNewPatient === "1";
  let patientId = parsed.data.patientId || "";

  if (shouldCreatePatient) {
    const quickParsed = quickPatientSchema.safeParse({
      firstName: parsed.data.newPatientFirstName,
      lastName: parsed.data.newPatientLastName,
      nationalId: parsed.data.newPatientNationalId,
      birthDate: parsed.data.newPatientBirthDate,
      sex: parsed.data.newPatientSex
    });
    if (!quickParsed.success) throw new Error("Datos de nuevo paciente invalidos");

    const existingPatient = await prisma.patient.findUnique({
      where: { nationalId: quickParsed.data.nationalId }
    });

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const createdPatient = await prisma.patient.create({
        data: {
          firstName: quickParsed.data.firstName,
          lastName: quickParsed.data.lastName,
          nationalId: quickParsed.data.nationalId,
          birthDate: new Date(quickParsed.data.birthDate),
          sex: quickParsed.data.sex
        }
      });
      patientId = createdPatient.id;

      await createAuditLog({
        actorId: actor.id,
        actorRole: actor.role,
        action: "CREATE_PATIENT",
        entity: "Patient",
        entityId: createdPatient.id,
        patientId: createdPatient.id,
        after: createdPatient
      });

      revalidatePath("/patients");
    }
  }

  if (!patientId) throw new Error("Debe seleccionar un paciente o activar crear nuevo paciente");

  const scheduledAt = new Date(`${parsed.data.date}T${parsed.data.time}:00`);
  const created = await prisma.appointment.create({
    data: {
      patientId,
      agendaName: parsed.data.agendaName,
      scheduledAt,
      modality: parsed.data.modality || "Ambulatorio",
      notes: parsed.data.notes || null,
      clinicianId: actor.id
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "CREATE_APPOINTMENT",
    entity: "Appointment",
    entityId: created.id,
    patientId: created.patientId,
    after: created
  });

  revalidatePath("/agenda");
  revalidatePath(`/patients/${created.patientId}`);
  revalidatePath("/audit");

  const returnDateFrom = (formData.get("returnDateFrom") ?? "").toString();
  const returnDateTo = (formData.get("returnDateTo") ?? "").toString();
  const returnHourFrom = (formData.get("returnHourFrom") ?? "").toString();
  const returnHourTo = (formData.get("returnHourTo") ?? "").toString();
  const returnQ = (formData.get("returnQ") ?? "").toString();
  const returnCalendarDate = (formData.get("returnCalendarDate") ?? "").toString();
  const returnSelectedTime = (formData.get("returnSelectedTime") ?? "").toString();
  const returnSlotMinutes = (formData.get("returnSlotMinutes") ?? "").toString();

  const qs = new URLSearchParams();
  if (returnDateFrom) qs.set("dateFrom", returnDateFrom);
  if (returnDateTo) qs.set("dateTo", returnDateTo);
  if (returnHourFrom) qs.set("hourFrom", returnHourFrom);
  if (returnHourTo) qs.set("hourTo", returnHourTo);
  if (returnQ) qs.set("q", returnQ);
  if (returnCalendarDate) qs.set("calendarDate", returnCalendarDate);
  if (returnSelectedTime) qs.set("selectedTime", returnSelectedTime);
  if (returnSlotMinutes) qs.set("slotMinutes", returnSlotMinutes);

  qs.set("newPatientId", patientId);
  qs.set("newAgendaName", parsed.data.agendaName);
  qs.set("newDate", parsed.data.date);
  qs.set("newTime", parsed.data.time);
  if (parsed.data.modality?.trim()) qs.set("newModality", parsed.data.modality);
  if (parsed.data.notes?.trim()) qs.set("newNotes", parsed.data.notes);

  redirect(`/agenda${qs.toString() ? `?${qs.toString()}` : ""}#agenda-main`);
}

export async function updateAppointmentStatus(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const parsed = appointmentStatusSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status")
  });
  if (!parsed.success) throw new Error("Estado de turno invalido");

  const previous = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId }
  });
  if (!previous) throw new Error("Turno no encontrado");
  if (previous.clinicianId !== actor.id) {
    throw new Error("No autorizado para modificar turnos de otro usuario");
  }

  const updated = await prisma.appointment.update({
    where: { id: parsed.data.appointmentId },
    data: { status: parsed.data.status }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "UPDATE_APPOINTMENT_STATUS",
    entity: "Appointment",
    entityId: updated.id,
    patientId: updated.patientId,
    before: previous,
    after: updated
  });

  revalidatePath("/agenda");
  revalidatePath("/audit");
}

export async function createUserByAdmin(formData: FormData) {
  const actor = await requireRole(["ADMIN"]);
  const parsed = adminUserCreateSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    medicalSpecialty: formData.get("medicalSpecialty"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    const hasWeakPassword = parsed.error.issues.some((issue) => issue.path.includes("password"));
    if (hasWeakPassword) redirect("/admin/users?error=weakpass");
    redirect("/admin/users?error=invalid");
  }

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });
  if (exists) redirect("/admin/users?error=exists");

  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      medicalSpecialty: parsed.data.role === "MEDICO" ? parsed.data.medicalSpecialty?.trim() || null : null,
      passwordHash: hashPassword(parsed.data.password),
      isActive: true
    }
  });

  await createAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "CREATE_USER",
    entity: "User",
    entityId: created.id,
    after: {
      email: created.email,
      fullName: created.fullName,
      role: created.role,
      medicalSpecialty: created.medicalSpecialty,
      isActive: created.isActive
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/audit");
  redirect("/admin/users?ok=1");
}

export async function uploadPatientDocument(formData: FormData) {
  await requireRole(["ADMIN", "RECEPCION", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL"]);
  const patientId = (formData.get("patientId") ?? "").toString();
  if (patientId) {
    redirect(`/patients/${patientId}?error=document_upload_disabled`);
  }
  redirect("/patients?error=document_upload_disabled");
}
