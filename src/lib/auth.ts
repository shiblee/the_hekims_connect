import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// Simple, dependency-free password hashing using Node crypto (scrypt).
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  try {
    const verifyBuf = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(hash, "hex");
    if (verifyBuf.length !== storedBuf.length) return false;
    return timingSafeEqual(verifyBuf, storedBuf);
  } catch {
    return false;
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function isExpired(expiresAt: Date): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export function isSecurePassword(value: string): boolean {
  return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
}

export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** A signup/login "contact" field can be an email or a phone number — normalize and classify it. */
export function normalizeContact(value: string): { value: string; isEmail: boolean } {
  const trimmed = value.trim();
  const isEmail = isEmailLike(trimmed);
  return { value: isEmail ? trimmed.toLowerCase() : trimmed, isEmail };
}
