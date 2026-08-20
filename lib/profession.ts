import type { Role } from "@prisma/client";

export const professionLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  MEDICO: "Medicina",
  PSICOLOGO: "Psicologia",
  FONOAUDIOLOGO: "Fonoaudiologia",
  KINESIOLOGO: "Kinesiologia",
  TERAPISTA_OCUPACIONAL: "Terapia ocupacional",
  RECEPCION: "Recepcion"
};

export function professionLabel(role?: Role | null, medicalSpecialty?: string | null) {
  if (role === "MEDICO" && medicalSpecialty) return medicalSpecialty;
  if (!role) return "Sin especialidad";
  return professionLabels[role];
}

export function professionClassName(role?: Role | null) {
  return `profession-${(role ?? "unknown").toLowerCase().replaceAll("_", "-")}`;
}
