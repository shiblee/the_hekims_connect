// Server error sentences are translated on the client by their exact English text.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { API_ERRORS, API_ERROR_PATTERNS } from "@/lib/i18n/app-strings/api-errors";
import { apiErrorKey } from "@/lib/i18n/api-error-key";

const byKey = new Map(API_ERRORS.map((s) => [s.key.replace(/^common\.api\./, ""), s]));
const toRegex = (en: string) => new RegExp(`^${en.split(/(\{\w+\})/).map((p) => (/^\{\w+\}$/.test(p) ? "(.+?)" : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("")}$`);

describe("api error translations", () => {
  it("finds a fixed sentence by its English text", () => {
    const s = byKey.get(apiErrorKey("Patient not found"));
    assert.equal(s?.tr.ar, "لم يُعثر على المريض");
  });

  it("matches sentences with blanks the way the server fills them in", () => {
    const samples: [string, string][] = [
      ["Please wait 42s before requesting another code", "p_wait_code"],
      ["Too many failed attempts. Try again in 1 minute.", "p_locked_min"],
      ["The fee is ₹500. Give a reason for charging ₹300.", "p_fee_reason"],
      ["scan.pdf is larger than 8 MB", "p_file_big"],
    ];
    for (const [msg, key] of samples) {
      const hit = API_ERROR_PATTERNS.find(([, en]) => toRegex(en).test(msg));
      assert.equal(hit?.[0], key, msg);
    }
  });

  it("gives every pattern a translation", () => {
    for (const [key] of API_ERROR_PATTERNS) assert.ok(byKey.has(key), key);
  });
});
