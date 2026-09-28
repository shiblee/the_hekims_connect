import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Symmetric at-rest encryption for admin-entered secrets (SMTP password / API keys)
// so they are never stored or logged in plain text. Not a substitute for a real
// secrets manager in production, but keeps the value out of the DB/API in the clear.
const APP_SECRET = process.env.SECRET_ENCRYPTION_KEY || "hekims-connect-dev-secret-do-not-use-in-prod";
const KEY = scryptSync(APP_SECRET, "hekims-connect-salt", 32);

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return dec.toString("utf-8");
  } catch {
    return null;
  }
}
