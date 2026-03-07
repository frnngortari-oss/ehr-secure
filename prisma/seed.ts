import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/security";

const prisma = new PrismaClient();

async function seedUsers() {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["admin@ehr.local", "medico@ehr.local", "Fgortari", "Fgortariadmin"]
      }
    }
  });

  const users = [
    {
      email: "Fgortariadmin",
      fullName: "Administrador Fgortari",
      role: "ADMIN" as const,
      password: "Qwerty\"852963"
    },
    {
      email: "Fgortari",
      fullName: "Medico Fgortari",
      role: "MEDICO" as const,
      password: "Qwerty\"852963"
    },
    {
      email: "recepcion@ehr.local",
      fullName: "Recepcion Demo",
      role: "RECEPCION" as const,
      password: "Recepcion123!"
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash: hashPassword(user.password),
        isActive: true
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash: hashPassword(user.password)
      }
    });
  }
}

async function seedClinicalData() {
  const medico = await prisma.user.findUnique({ where: { email: "Fgortari" } });

  const patient = await prisma.patient.upsert({
    where: { nationalId: "30111222" },
    update: {},
    create: {
      firstName: "Laura",
      lastName: "Gomez",
      nationalId: "30111222",
      birthDate: new Date("1986-04-21"),
      sex: "F",
      email: "laura.gomez@mail.com",
      phone: "+54 11 5555-1234",
      address: "CABA"
    }
  });

  const hasEncounter = await prisma.encounter.findFirst({
    where: { patientId: patient.id }
  });

  const problemTitles = [
    "Control por cardiologia",
    "Enfermedad pulmonar obstructiva cronica",
    "Queja cognitiva"
  ];

  for (const title of problemTitles) {
    const exists = await prisma.problem.findFirst({
      where: { patientId: patient.id, title }
    });
    if (!exists) {
      await prisma.problem.create({
        data: {
          patientId: patient.id,
          createdById: medico?.id,
          title,
          category: "Problema"
        }
      });
    }
  }

  if (!hasEncounter) {
    const problem = await prisma.problem.findFirst({
      where: { patientId: patient.id, title: { contains: "pulmonar" } }
    });

    await prisma.encounter.create({
      data: {
        patientId: patient.id,
        reason: "Control anual",
        assessment: "Paciente estable. Sin signos de alarma.",
        plan: "Laboratorio anual y control en 6 meses.",
        occurredAt: new Date(),
        authorId: medico?.id,
        problemId: problem?.id,
        content: "Paciente con EPOC estable. Continúa tabaquismo activo. Se indica seguimiento por neumonologia."
      }
    });
  }

  const appointmentTimes = ["09:00", "10:20", "11:40", "13:00", "14:20"];
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  for (const time of appointmentTimes) {
    const scheduledAt = new Date(`${yyyy}-${mm}-${dd}T${time}:00`);
    const exists = await prisma.appointment.findFirst({
      where: { patientId: patient.id, scheduledAt }
    });
    if (!exists) {
      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          clinicianId: medico?.id,
          agendaName: "Consulta Neumonologia",
          scheduledAt,
          modality: "Ambulatorio",
          status: time === "10:20" || time === "14:20" ? "AUSENTE" : "ATENDIDO"
        }
      });
    }
  }
}

async function main() {
  await seedUsers();
  await seedClinicalData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
