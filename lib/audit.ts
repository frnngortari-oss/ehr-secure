import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/auth";
import { Prisma } from "@prisma/client";

type AuditInput = {
  actorId: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  patientId?: string | null;
  before?: unknown;
  after?: unknown;
};

function toInputJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createAuditLog(input: AuditInput) {
  const before = toInputJson(input.before);
  const after = toInputJson(input.after);

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: `${input.action} (${input.actorRole})`,
      entity: input.entity,
      entityId: input.entityId,
      patientId: input.patientId ?? null,
      before,
      after
    }
  });
}
