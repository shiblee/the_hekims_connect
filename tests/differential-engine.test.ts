// Stage 5 differential engine: candidates come from recorded findings, evidence is explained,
// unrecorded findings are "missing" (never "absent"), and certainty is never "confirmed".
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDifferentials, matchSign, mizajFit, factsOf, type CatalogueEntry } from "@/lib/differential-engine";
import type { CaseContext } from "@/lib/case-context";

const ctx = (over: { complaints?: { label: string; key: string; aggravating?: string[]; relieving?: string[] }[]; exam?: { key: string; answers: { question: string; answer: string }[] }[]; vitals?: string[] }): CaseContext => ({
  patient: { id: "p", age: 40, sex: "female", pregnancyStatus: null, historyReliability: null },
  visit: { id: "v", code: "V1", date: "", ageDays: 0, followUp: false },
  presenting: {
    complaints: (over.complaints || []).map((c, i) => ({ label: c.label, key: c.key, category: null, primary: i === 0, severity: null, duration: null, pattern: null, character: null, aggravating: c.aggravating || [], relieving: c.relieving || [], associated: [], notes: null })),
    symptoms: [], regions: [], onsetPatterns: [], duration: null, narrative: null,
  },
  vitals: over.vitals ? { bp: null, pulse: null, spo2: null, tempF: null, bmi: null, flags: over.vitals, at: "" } : null,
  warning: null, lifestyle: { answered: 0, sections: 0, totalSections: 6, items: [] },
  examination: { answered: (over.exam || []).length, sections: (over.exam || []).map((s) => ({ key: s.key, label: s.key, answers: s.answers })) },
  history: { conditions: [], conditionKeys: [], medicalHistory: null, surgicalHistory: null, familyHistory: null, allergies: [], allergiesRecorded: true, medicines: [], medicinesRecorded: true },
  reports: [], previousVisits: [], mizajAssessment: null, readiness: [], alerts: [],
});
const entry = (o: Partial<CatalogueEntry> & { key: string }): CatalogueEntry => ({
  id: o.key, label: o.key, localName: null, category: null, icd: null, organs: [], mizaj: [], suMizajType: null, sabab: [],
  appliesTo: {}, signs: [], against: [], dontMiss: [], investigations: [], reviewStatus: "draft", ...o,
});
const none = { suMizaj: null, organs: [], from: "none" as const };

describe("differential engine", () => {
  const humuzat = entry({
    key: "humuzat", mizaj: ["Safrawi", "Haar"], appliesTo: { complaints: ["acidity"] },
    signs: [
      { text: "Burning", weight: 3, match: { complaints: ["acidity"] } },
      { text: "Better with cold", match: { better: ["cold"] } },
      { text: "Yellow tongue", match: { exam: [{ s: "lisan", o: "Yellow fur" }] } },
    ],
    against: [{ text: "Thick white coat", match: { exam: [{ s: "lisan", o: "Thick white coat" }] } }],
    dontMiss: [{ label: "Heart attack", why: "chest pain" }],
  });
  const joints = entry({ key: "joints", appliesTo: { complaints: ["joint_pain"] }, signs: [{ text: "Worse with cold", weight: 3, match: { worse: ["cold"] } }, { text: "Better with warmth", weight: 3, match: { better: ["warm"] } }] });

  it("suggests diseases linked to the recorded complaints, with the complaint as evidence", () => {
    const r = computeDifferentials(ctx({ complaints: [{ label: "Acidity", key: "acidity", relieving: ["Cold milk"] }] }), [humuzat, joints], none);
    assert.equal(r.differentials[0].key, "humuzat");
    assert.equal(r.differentials[0].for[0], "Complaint: Acidity");
    assert.ok(r.differentials[0].for.includes("Better with cold"));
    assert.ok(!r.differentials.some((d) => d.key === "joints"));
  });

  it("an unexamined sign is missing, not absent", () => {
    const r = computeDifferentials(ctx({ complaints: [{ label: "Acidity", key: "acidity" }] }), [humuzat], none);
    assert.ok(r.differentials[0].missing.includes("Yellow tongue"));
    assert.equal(r.differentials[0].against.length, 0);
  });

  it("findings against count against, and block 'probable'", () => {
    const c = ctx({ complaints: [{ label: "Acidity", key: "acidity", relieving: ["cold"] }], exam: [{ key: "lisan", answers: [{ question: "Coating", answer: "Thick white coat" }] }] });
    const d = computeDifferentials(c, [humuzat], none).differentials[0];
    assert.deepEqual(d.against, ["Thick white coat"]);
    assert.equal(d.certainty, "suspected");
  });

  it("modality signs alone (worse with cold) can't make a disease a candidate", () => {
    const r = computeDifferentials(ctx({ complaints: [{ label: "Headache", key: "headache", aggravating: ["cold"], relieving: ["warmth"] }] }), [joints], none);
    assert.equal(r.differentials.length, 0);
  });

  it("certainty is never 'confirmed'", () => {
    const c = ctx({ complaints: [{ label: "Acidity", key: "acidity", relieving: ["cold"] }], exam: [{ key: "lisan", answers: [{ question: "Coating", answer: "Yellow fur" }] }] });
    const d = computeDifferentials(c, [humuzat], none).differentials[0];
    assert.equal(d.certainty, "probable");
  });

  it("collects serious alternatives not to miss", () => {
    const r = computeDifferentials(ctx({ complaints: [{ label: "Acidity", key: "acidity" }] }), [humuzat], none);
    assert.equal(r.dontMiss[0].label, "Heart attack");
  });

  it("temperament fit", () => {
    assert.equal(mizajFit(["Safrawi", "Haar"], "Safrawi"), "fits");
    assert.equal(mizajFit(["Safrawi"], "Damawi"), "partly");
    assert.equal(mizajFit(["Safrawi"], "Balghami"), "against");
    assert.equal(mizajFit(["Safrawi"], null), null);
  });

  it("vital-sign criteria only count when vitals were recorded", () => {
    const f = factsOf(ctx({}));
    assert.deepEqual(matchSign({ vitals: ["fever"] }, f), { matched: false, assessed: false, specific: false });
    const g = factsOf(ctx({ vitals: ["fever"] }));
    assert.equal(matchSign({ vitals: ["fever"] }, g).matched, true);
  });
});
