import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;

  const passwordHash = scryptSync(password, salt, 64);
  const expectedHash = Buffer.from(originalHash, "hex");

  if (passwordHash.byteLength !== expectedHash.byteLength) return false;
  return timingSafeEqual(passwordHash, expectedHash);
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}

export function createSessionToken(userId: string, secret: string, maxAgeSeconds = 60 * 60 * 12): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = `${userId}.${exp}`;
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): { userId: string; exp: number } | null {
  const [userId, expRaw, signature] = token.split(".");
  if (!userId || !expRaw || !signature) return null;

  const payload = `${userId}.${expRaw}`;
  const expectedSignature = sign(payload, secret);
  if (!safeEqualHex(signature, expectedSignature)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  return { userId, exp };
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "La contrasena debe tener al menos 10 caracteres.";
  if (!/[a-z]/.test(password)) return "La contrasena debe incluir al menos una minuscula.";
  if (!/[A-Z]/.test(password)) return "La contrasena debe incluir al menos una mayuscula.";
  if (!/[0-9]/.test(password)) return "La contrasena debe incluir al menos un numero.";
  if (!/[^A-Za-z0-9]/.test(password)) return "La contrasena debe incluir al menos un simbolo.";
  return null;
}
