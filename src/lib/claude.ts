// Claude (Anthropic) — the clinical reasoning assistant's model. Server-side only.
// The key is stored encrypted (Admin → Settings → AI services) and nothing is sent
// while the switch is off. Every call returns null on any failure so callers can
// fall back to the rule engines.

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-crypto";

export const CLAUDE_MODELS = { standard: "claude-sonnet-5-5", deep: "claude-opus-5-5" } as const;
export type ClaudeMode = keyof typeof CLAUDE_MODELS;
const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

export async function getClaudeKey(): Promise<string | null> {
  const row = await db.integrationConfig.findUnique({ where: { provider: "anthropic" } });
  if (!row || !row.active || !row.keyEnc) return null;
  return decryptSecret(row.keyEnc);
}
export async function claudeStatus(): Promise<"on" | "off" | "no_key"> {
  const row = await db.integrationConfig.findUnique({ where: { provider: "anthropic" } });
  if (!row?.keyEnc) return "no_key";
  return row.active ? "on" : "off";
}

export interface ClaudeResult { text: string; model: string; inputTokens: number; outputTokens: number; latencyMs: number }
export type ClaudeFailure = { error: "off" | "quota" | "unavailable" | "timeout"; detail?: string };

/** One Messages API call. */
export async function claudeMessage(opts: { system: string; user: string; mode?: ClaudeMode; maxTokens?: number; timeoutMs?: number }): Promise<ClaudeResult | ClaudeFailure> {
  const key = await getClaudeKey();
  if (!key) return { error: "off" };
  const model = CLAUDE_MODELS[opts.mode ?? "standard"];
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
  try {
    const res = await fetch(API, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": VERSION },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 4000, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Claude call error:", res.status, body.slice(0, 300));
      return { error: res.status === 429 || res.status === 402 || /credit|quota|billing/i.test(body) ? "quota" : "unavailable", detail: `${res.status}` };
    }
    const json = await res.json();
    const text = (json?.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
    return { text, model: json?.model || model, inputTokens: json?.usage?.input_tokens ?? 0, outputTokens: json?.usage?.output_tokens ?? 0, latencyMs: Date.now() - started };
  } catch (e) {
    return { error: (e as Error)?.name === "AbortError" ? "timeout" : "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls the first JSON object out of a model answer (tolerates code fences or a sentence around it). */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)) as T; } catch { return null; }
}

/** Checks a key with a tiny request. */
export async function testClaudeKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": VERSION },
      body: JSON.stringify({ model: CLAUDE_MODELS.standard, max_tokens: 5, messages: [{ role: "user", content: "Reply with OK." }] }),
    });
    if (res.ok) return { ok: true, message: `Connected — ${CLAUDE_MODELS.standard} answered.` };
    const body = await res.text().catch(() => "");
    if (res.status === 401) return { ok: false, message: "The key was refused — check it in the Anthropic Console." };
    if (res.status === 429 || /credit|billing/i.test(body)) return { ok: false, message: "The key works but the account has no credit or hit its limit." };
    return { ok: false, message: `Anthropic answered with an error (${res.status}).` };
  } catch {
    return { ok: false, message: "Couldn't reach Anthropic from the server." };
  }
}
