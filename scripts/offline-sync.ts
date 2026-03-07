import { Prisma, PrismaClient } from "@prisma/client";

function getUrls() {
  const remoteUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const localUrl = process.env.LOCAL_DATABASE_URL;

  if (!remoteUrl) {
    throw new Error("Falta DIRECT_URL o DATABASE_URL para origen remoto");
  }
  if (!localUrl) {
    throw new Error("Falta LOCAL_DATABASE_URL para destino local");
  }
  if (remoteUrl === localUrl) {
    throw new Error("Origen y destino no pueden ser iguales");
  }

  return { remoteUrl, localUrl };
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

async function main() {
  const { remoteUrl, localUrl } = getUrls();
  const remote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });
  const local = new PrismaClient({ datasources: { db: { url: localUrl } } });

  try {
    const [users, patients, problems, appointments, encounters, auditLogs] = await Promise.all([
      remote.user.findMany({ orderBy: { createdAt: "asc" } }),
      remote.patient.findMany({ orderBy: { createdAt: "asc" } }),
      remote.problem.findMany({ orderBy: { createdAt: "asc" } }),
      remote.appointment.findMany({ orderBy: { createdAt: "asc" } }),
      remote.encounter.findMany({ orderBy: { createdAt: "asc" } }),
      remote.auditLog.findMany({ orderBy: { createdAt: "asc" } })
    ]);

    await local.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.encounter.deleteMany();
      await tx.appointment.deleteMany();
      await tx.problem.deleteMany();
      await tx.patient.deleteMany();
      await tx.user.deleteMany();

      for (const row of users) {
        await tx.user.create({ data: row });
      }
      for (const row of patients) {
        await tx.patient.create({ data: row });
      }
      for (const row of problems) {
        await tx.problem.create({ data: row });
      }
      for (const row of appointments) {
        await tx.appointment.create({ data: row });
      }
      for (const row of encounters) {
        await tx.encounter.create({ data: row });
      }
      for (const row of auditLogs) {
        await tx.auditLog.create({
          data: {
            ...row,
            before: toJsonInput(row.before),
            after: toJsonInput(row.after)
          }
        });
      }
    });

    console.log(
      `Sync OK: users=${users.length}, patients=${patients.length}, problems=${problems.length}, appointments=${appointments.length}, encounters=${encounters.length}, auditLogs=${auditLogs.length}`
    );
  } finally {
    await remote.$disconnect();
    await local.$disconnect();
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
