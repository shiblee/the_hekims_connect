// Tashkhees engine and humour scoring: the clinical rules Step 5 relies on.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSuggestion, DEFAULT_ENGINE_CONFIG, type EngineInput } from "@/lib/tashkhees-engine";
import { computeHumorBreakdown } from "@/lib/humor-engine";

const ctx = { complaints: [], symptoms: [], regions: [], onsetPatterns: [], duration: null, vitalsFlags: [], sex: null, age: null };
const opt = (label: string, h: Partial<Record<"safra" | "dam" | "balgham" | "sauda", number>>) => ({ label, safra: 0, dam: 0, balgham: 0, sauda: 0, maddi: 0, ...h });
const answers = (framework: string, section: string, n: number, h: Partial<Record<"safra" | "dam" | "balgham" | "sauda", number>>) =>
  Array.from({ length: n }, (_, i) => ({ framework, section, question: `${section} q${i}`, weight: 1, options: [opt(`a${i}`, h)] }));
const input = (over: Partial<EngineInput>): EngineInput => ({ complaints: null, severity: null, responses: [], ctx, assessment: null, ...over });
const run = (i: EngineInput) => computeSuggestion(i, DEFAULT_ENGINE_CONFIG, []);

describe("Su-e-Mizaj", () => {
  it("opposite readings that cancel out are 'undetermined', never Mu'tadil", () => {
    const s = run(input({
      complaints: { safra: 5, dam: 85, balgham: 5, sauda: 5 },
      responses: answers("asbab", "naum", 6, { sauda: 2 }),
    })).suMizaj!;
    assert.equal(s.label, null);
    assert.ok(s.conflict && s.conflict.leans.length >= 2);
    assert.equal(s.darja, null);
    assert.equal(s.confidence, "weak");
  });

  it("disagreeing readings keep the leading quality but only as weak, with the conflict shown", () => {
    const s = run(input({
      complaints: { safra: 10, dam: 70, balgham: 10, sauda: 10 },
      responses: answers("asbab", "naum", 6, { safra: 2 }),
    })).suMizaj!;
    assert.ok(s.label);
    assert.ok(s.conflict);
    assert.equal(s.confidence, "weak");
  });

  it("without any examination the suggestion is capped at weak", () => {
    const s = run(input({ complaints: { safra: 80, dam: 10, balgham: 5, sauda: 5 }, responses: answers("asbab", "naum", 8, { safra: 2 }) })).suMizaj!;
    assert.equal(s.label, "Safrawi");
    assert.equal(s.cap, "no_exam");
    assert.equal(s.confidence, "weak");
    assert.ok((s.darja ?? 0) <= 2);
  });

  it("consistent readings with an examination are not capped", () => {
    const s = run(input({
      complaints: { safra: 80, dam: 10, balgham: 5, sauda: 5 },
      responses: [...answers("asbab", "naum", 6, { safra: 2 }), ...answers("dalail", "nabz", 6, { safra: 2 })],
    })).suMizaj!;
    assert.equal(s.label, "Safrawi");
    assert.equal(s.cap, undefined);
    assert.equal(s.conflict, undefined);
    assert.notEqual(s.confidence, "weak");
  });
});

describe("Mizaj-e-Asli", () => {
  it("needs a pulse or physique examination (or a Mizaj assessment) for more than weak", () => {
    const a = run(input({ responses: answers("asbab", "naum", 8, { balgham: 2 }) })).mizajAsli!;
    assert.equal(a.label, "Balghami");
    assert.equal(a.cap, "no_exam");
    assert.equal(a.confidence, "weak");
  });

  it("uses the Stage 3 Mizaj assessment when there is one", () => {
    const a = run(input({ assessment: { points: { safra: 20, dam: 60, balgham: 10, sauda: 10 }, date: "2026-10-01T00:00:00Z" } })).mizajAsli!;
    assert.equal(a.label, "Damawi");
    assert.ok(a.assessment);
    assert.equal(a.cap, undefined);
  });
});

describe("Humour scoring", () => {
  const rules = [{ sourceType: "factor", sourceValue: "Cold exposure", safraPoints: 0, damPoints: 0, saudaPoints: 1, balghamPoints: 2, active: true }];
  it("an aggravating factor scores its own quality", () => {
    const r = computeHumorBreakdown(rules, [{ manifestations: [], factors: ["Cold exposure"], severityScore: null, onsetPattern: null }])!;
    assert.ok(r.balghamPercent > r.safraPercent);
  });
  it("a relieving factor scores the opposite quality", () => {
    const r = computeHumorBreakdown(rules, [{ manifestations: [], factors: [], relieving: ["Cold exposure"], severityScore: null, onsetPattern: null }])!;
    assert.ok(r.safraPercent > r.balghamPercent);
    assert.ok(r.damPercent > r.saudaPercent);
  });
});
