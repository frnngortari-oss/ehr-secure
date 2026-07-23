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

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}

export type SessionTokenPayload = {
  userId: string;
  email?: string;
  fullName?: string;
  role?: string;
  medicalSpecialty?: string | null;
};

export function createSessionToken(payloadInput: string | SessionTokenPayload, secret: string, maxAgeSeconds = 60 * 60 * 12): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  if (typeof payloadInput === "string") {
    const payload = `${payloadInput}.${exp}`;
    const signature = sign(payload, secret);
    return `${payload}.${signature}`;
  }

  const encoded = base64UrlEncode(JSON.stringify({ ...payloadInput, exp, v: 2 }));
  const payload = `v2.${encoded}`;
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): (SessionTokenPayload & { exp: number; v?: number }) | null {
  const parts = token.split(".");

  if (parts[0] === "v2") {
    const [version, encoded, signature] = parts;
    if (!version || !encoded || !signature) return null;

    const payload = `${version}.${encoded}`;
    const expectedSignature = sign(payload, secret);
    if (!safeEqualHex(signature, expectedSignature)) return null;

    try {
      const decoded = JSON.parse(base64UrlDecode(encoded)) as SessionTokenPayload & { exp?: number; v?: number };
      if (!decoded.userId || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
      return { ...decoded, exp: decoded.exp };
    } catch {
      return null;
    }
  }

  const [userId, expRaw, signature] = parts;
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
