import { prisma } from "@/lib/prisma";

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
