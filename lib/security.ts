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
  if (signature !== expectedSignature) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  return { userId, exp };
}
