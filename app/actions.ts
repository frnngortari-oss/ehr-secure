"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearSession, requireRole, setSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/security";
import { createAuditLog } from "@/lib/audit";

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
  reason: z.string().min(3),
  assessment: z.string().optional(),
  plan: z.string().min(3),
  occurredAt: z.string().optional(),
  content: z.string().optional(),
  problemId: z.string().uuid().optional().or(z.literal(""))
});

const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  agendaName: z.string().min(3),
  date: z.string().min(1),
  time: z.string().min(1),
  modality: z.string().optional(),
  notes: z.string().optional(),
  clinicianId: z.string().uuid().optional().nullable().or(z.literal(""))
});

const appointmentStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["PENDIENTE", "ATENDIDO", "AUSENTE", "CANCELADO"])
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password")
  });
  if (!parsed.success) throw new Error("Credenciales invalidas");

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.username }
  });
  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    throw new Error("Usuario o contrasena incorrectos");
  }

  await setSession(user.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function createPatient(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION", "MEDICO"]);
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
  const actor = await requireRole(["ADMIN", "MEDICO"]);
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
  const actor = await requireRole(["ADMIN", "MEDICO"]);
  const parsed = encounterSchema.safeParse({
    patientId: formData.get("patientId"),
    reason: formData.get("reason"),
    assessment: formData.get("assessment"),
    plan: formData.get("plan"),
    occurredAt: formData.get("occurredAt"),
    content: formData.get("content"),
    problemId: formData.get("problemId")
  });
  if (!parsed.success) throw new Error("Datos de evolucion invalidos");

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();
  const assessment = parsed.data.assessment?.trim() || "Sin evaluacion";
  const content = parsed.data.content?.trim() || `Motivo: ${parsed.data.reason}\n\nPlan: ${parsed.data.plan}`;

  const encounter = await prisma.encounter.create({
    data: {
      patientId: parsed.data.patientId,
      reason: parsed.data.reason,
      assessment,
      plan: parsed.data.plan,
      occurredAt,
      content,
      problemId: parsed.data.problemId || null,
      authorId: actor.id
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
  redirect(`/patients/${parsed.data.patientId}`);
}

export async function createAppointment(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION", "MEDICO"]);
  const parsed = appointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    agendaName: formData.get("agendaName"),
    date: formData.get("date"),
    time: formData.get("time"),
    modality: formData.get("modality"),
    notes: formData.get("notes"),
    clinicianId: formData.get("clinicianId") ?? ""
  });
  if (!parsed.success) throw new Error("Datos de turno invalidos");

  const scheduledAt = new Date(`${parsed.data.date}T${parsed.data.time}:00`);
  const created = await prisma.appointment.create({
    data: {
      patientId: parsed.data.patientId,
      agendaName: parsed.data.agendaName,
      scheduledAt,
      modality: parsed.data.modality || "Ambulatorio",
      notes: parsed.data.notes || null,
      clinicianId: parsed.data.clinicianId || null
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
  redirect("/agenda");
}

export async function updateAppointmentStatus(formData: FormData) {
  const actor = await requireRole(["ADMIN", "RECEPCION", "MEDICO"]);
  const parsed = appointmentStatusSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status")
  });
  if (!parsed.success) throw new Error("Estado de turno invalido");

  const previous = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId }
  });
  if (!previous) throw new Error("Turno no encontrado");

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
}
