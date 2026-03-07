import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  data: {
    users: Array<{
      id: string;
      email: string;
      fullName: string;
      role: "ADMIN" | "MEDICO" | "RECEPCION";
      passwordHash: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    patients: Array<{
      id: string;
      firstName: string;
      lastName: string;
      nationalId: string;
      birthDate: string;
      sex: "F" | "M" | "X";
      email: string | null;
      phone: string | null;
      address: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    problems: Array<{
      id: string;
      patientId: string;
      createdById: string | null;
      title: string;
      category: string;
      isActive: boolean;
      startedAt: string;
      createdAt: string;
      updatedAt: string;
    }>;
    appointments: Array<{
      id: string;
      patientId: string;
      clinicianId: string | null;
      agendaName: string;
      scheduledAt: string;
      status: "PENDIENTE" | "ATENDIDO" | "AUSENTE" | "CANCELADO";
      modality: string | null;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    encounters: Array<{
      id: string;
      patientId: string;
      reason: string;
      assessment: string;
      plan: string;
      occurredAt: string;
      content: string | null;
      problemId: string | null;
      authorId: string | null;
      createdAt: string;
    }>;
    auditLogs: Array<{
      id: string;
      actorId: string;
      action: string;
      entity: string;
      entityId: string;
      patientId: string | null;
      before: unknown;
      after: unknown;
      createdAt: string;
    }>;
  };
};

function toIso(value: Date) {
  return new Date(value).toISOString();
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function exportBackupPayload(): Promise<BackupPayload> {
  const [users, patients, problems, appointments, encounters, auditLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.patient.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.problem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appointment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.encounter.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      users: users.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.fullName,
        role: r.role,
        passwordHash: r.passwordHash,
        isActive: r.isActive,
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt)
      })),
      patients: patients.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        nationalId: r.nationalId,
        birthDate: toIso(r.birthDate),
        sex: r.sex,
        email: r.email,
        phone: r.phone,
        address: r.address,
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt)
      })),
      problems: problems.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        createdById: r.createdById,
        title: r.title,
        category: r.category,
        isActive: r.isActive,
        startedAt: toIso(r.startedAt),
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt)
      })),
      appointments: appointments.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        clinicianId: r.clinicianId,
        agendaName: r.agendaName,
        scheduledAt: toIso(r.scheduledAt),
        status: r.status,
        modality: r.modality,
        notes: r.notes,
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt)
      })),
      encounters: encounters.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        reason: r.reason,
        assessment: r.assessment,
        plan: r.plan,
        occurredAt: toIso(r.occurredAt),
        content: r.content,
        problemId: r.problemId,
        authorId: r.authorId,
        createdAt: toIso(r.createdAt)
      })),
      auditLogs: auditLogs.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        patientId: r.patientId,
        before: r.before,
        after: r.after,
        createdAt: toIso(r.createdAt)
      }))
    }
  };
}

function assertBackupPayload(value: unknown): asserts value is BackupPayload {
  if (!value || typeof value !== "object") throw new Error("Backup invalido");
  const root = value as Record<string, unknown>;
  if (root.version !== 1) throw new Error("Version de backup no soportada");
  const data = root.data as Record<string, unknown> | undefined;
  if (!data) throw new Error("Formato de backup invalido");
  const requiredArrays = ["users", "patients", "problems", "appointments", "encounters", "auditLogs"];
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) throw new Error(`Falta arreglo ${key}`);
  }
}

export async function importBackupPayload(value: unknown) {
  assertBackupPayload(value);
  const backup = value;

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.encounter.deleteMany();
    await tx.appointment.deleteMany();
    await tx.problem.deleteMany();
    await tx.patient.deleteMany();
    await tx.user.deleteMany();

    for (const row of backup.data.users) {
      await tx.user.create({
        data: {
          id: row.id,
          email: row.email,
          fullName: row.fullName,
          role: row.role,
          passwordHash: row.passwordHash,
          isActive: row.isActive,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt)
        }
      });
    }

    for (const row of backup.data.patients) {
      await tx.patient.create({
        data: {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          nationalId: row.nationalId,
          birthDate: new Date(row.birthDate),
          sex: row.sex,
          email: row.email,
          phone: row.phone,
          address: row.address,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt)
        }
      });
    }

    for (const row of backup.data.problems) {
      await tx.problem.create({
        data: {
          id: row.id,
          patientId: row.patientId,
          createdById: row.createdById,
          title: row.title,
          category: row.category,
          isActive: row.isActive,
          startedAt: new Date(row.startedAt),
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt)
        }
      });
    }

    for (const row of backup.data.appointments) {
      await tx.appointment.create({
        data: {
          id: row.id,
          patientId: row.patientId,
          clinicianId: row.clinicianId,
          agendaName: row.agendaName,
          scheduledAt: new Date(row.scheduledAt),
          status: row.status,
          modality: row.modality,
          notes: row.notes,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt)
        }
      });
    }

    for (const row of backup.data.encounters) {
      await tx.encounter.create({
        data: {
          id: row.id,
          patientId: row.patientId,
          reason: row.reason,
          assessment: row.assessment,
          plan: row.plan,
          occurredAt: new Date(row.occurredAt),
          content: row.content,
          problemId: row.problemId,
          authorId: row.authorId,
          createdAt: new Date(row.createdAt)
        }
      });
    }

    for (const row of backup.data.auditLogs) {
      await tx.auditLog.create({
        data: {
          id: row.id,
          actorId: row.actorId,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          patientId: row.patientId,
          before: toJsonInput(row.before),
          after: toJsonInput(row.after),
          createdAt: new Date(row.createdAt)
        }
      });
    }
  });
}
