import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

// Signed session tokens: `v2.<payload>.<signature>`, payload = base64url("type|id|sessionId|expiresAtMs").
// The signature (HMAC-SHA256) makes a token impossible to forge or edit; the session id ties it to a
// UserSession row so logout / revocation ends it at once; the expiry bounds a stolen token's lifetime.
// The secret is generated once and kept in PortalSetting (category "security" — never listed in Settings).

export type TokenType = "facility" | "patient" | "staff";
export const SESSION_HOURS: Record<TokenType, number> = { facility: 24, staff: 24, patient: 24 * 30 };

let secretCache: Buffer | null = null;
async function secret(): Promise<Buffer> {
  if (secretCache) return secretCache;
  const where = { category_key: { category: "security", key: "token_secret" } };
  let row = await db.portalSetting.findUnique({ where });
  if (!row) {
    try { row = await db.portalSetting.create({ data: { category: "security", key: "token_secret", value: randomBytes(48).toString("base64") } }); }
    catch { row = await db.portalSetting.findUnique({ where }); } // created concurrently
  }
  secretCache = Buffer.from(row!.value, "base64");
  return secretCache;
}

const sign = (payload: string, key: Buffer) => createHmac("sha256", key).update(payload).digest("base64url");

export async function makeSessionToken(type: TokenType, id: string, sessionId: string): Promise<string> {
  const exp = Date.now() + SESSION_HOURS[type] * 3600_000;
  const payload = Buffer.from(`${type}|${id}|${sessionId}|${exp}`, "utf-8").toString("base64url");
  return `v2.${payload}.${sign(payload, await secret())}`;
}

export interface TokenClaims { type: TokenType; id: string; sessionId: string; exp: number; expired: boolean }

/** Verifies the signature (no database lookups beyond the secret); `expired` tells the caller to end the session. */
export async function readSessionToken(raw: string | null): Promise<TokenClaims | null> {
  if (!raw || !raw.startsWith("v2.")) return null;
  const [, payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload, await secret()));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [type, id, sessionId, expRaw] = Buffer.from(payload, "base64url").toString("utf-8").split("|");
  const exp = Number(expRaw);
  if ((type !== "facility" && type !== "patient" && type !== "staff") || !id || !sessionId || !Number.isFinite(exp)) return null;
  return { type, id, sessionId, exp, expired: exp < Date.now() };
}
