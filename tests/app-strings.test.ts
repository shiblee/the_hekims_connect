// App texts (clinic, staff and patient apps): every language present, same placeholders, valid ICU.
// Run: bun run test

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IntlMessageFormat } from "intl-messageformat";
import { APP_STRINGS, appStringFallbacks } from "@/lib/i18n/app-strings";
import { APP_LANGS } from "@/lib/i18n/app-strings/define";

/** Simple {name} placeholders and plural / select argument names. */
const args = (s: string) => [...new Set([...s.matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]))].sort().join(",");

describe("app strings", () => {
  it("has unique keys", () => {
    const seen = new Set<string>(), dup: string[] = [];
    for (const s of APP_STRINGS) { if (seen.has(s.key)) dup.push(s.key); seen.add(s.key); }
    assert.deepEqual(dup, []);
  });

  it("has every language, the same placeholders, and valid message syntax", () => {
    const problems: string[] = [];
    for (const s of APP_STRINGS) {
      if (!s.en.trim()) problems.push(`${s.key}: empty English`);
      for (const lang of APP_LANGS) {
        const tr = s.tr[lang];
        if (!tr?.trim()) { problems.push(`${s.key}: ${lang} missing`); continue; }
        if (args(tr) !== args(s.en)) problems.push(`${s.key}: ${lang} placeholders ${args(tr)} ≠ ${args(s.en)}`);
      }
      for (const [lang, text] of [["en", s.en], ...APP_LANGS.map((l) => [l, s.tr[l]])]) {
        try { new IntlMessageFormat(text, lang); } catch (e) { problems.push(`${s.key}: ${lang} invalid — ${(e as Error).message}`); }
      }
    }
    assert.deepEqual(problems, []);
  });

  it("never uses a text's key as the start of another key (that would crash the message tree)", () => {
    const keys = new Set(APP_STRINGS.map((s) => s.key));
    const clashes = [...keys].filter((k) => { const parts = k.split("."); return parts.slice(0, -1).some((_, i) => keys.has(parts.slice(0, i + 1).join("."))); });
    assert.deepEqual(clashes, []);
  });

  it("registers every text set defined in the app-strings folder", async () => {
    const fs = await import("node:fs");
    const dir = "src/lib/i18n/app-strings";
    const registered = new Set(APP_STRINGS.map((s) => s.key));
    const missing: string[] = [];
    for (const f of fs.readdirSync(dir).filter((f: string) => f.endsWith(".ts") && !["define.ts", "index.ts", "seed.ts"].includes(f))) {
      const mod = await import(`@/lib/i18n/app-strings/${f.replace(/\.ts$/, "")}`);
      for (const [name, list] of Object.entries(mod)) {
        if (Array.isArray(list) && list[0]?.key && !registered.has(list[0].key)) missing.push(`${f}: ${name}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it("falls back to English for languages without app texts", () => {
    const en = appStringFallbacks("en"), xx = appStringFallbacks("xx");
    assert.deepEqual(xx, en);
    assert.equal(appStringFallbacks("ar").find((f) => f.key === "common.save")?.text, "حفظ");
  });
});
