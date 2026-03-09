import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifySessionToken } from "@/lib/security";

export const SESSION_COOKIE = "ehr_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

export const roleValues = ["ADMIN", "MEDICO", "PSICOLOGO", "FONOAUDIOLOGO", "KINESIOLOGO", "TERAPISTA_OCUPACIONAL", "RECEPCION"] as const;
export type Role = (typeof roleValues)[number];

type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  medicalSpecialty?: string | null;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET no configurado o demasiado corto");
  }
  return secret;
}

export async function setSession(userId: string) {
  const token = createSessionToken(userId, getAuthSecret(), SESSION_MAX_AGE);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/"
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const decoded = verifySessionToken(token, getAuthSecret());
  if (!decoded) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, fullName: true, role: true, medicalSpecialty: true, isActive: true }
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    medicalSpecialty: user.medicalSpecialty
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(allowedRoles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) redirect("/forbidden");
  return user;
}
