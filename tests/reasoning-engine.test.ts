// Stage 5 reasoning assistant: the model's answer is checked independently before a Hakim sees it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deidentify, supported, validateReasoning } from "@/lib/reasoning-engine";
import type { CatalogueEntry } from "@/lib/differential-engine";

const cat: CatalogueEntry[] = [{ id: "m1", key: "qabz", label: "Qabz (Constipation)", localName: null, category: null, icd: null, organs: ["Ama"], mizaj: ["Yabis"], suMizajType: null, sabab: [], appliesTo: {}, signs: [], against: [], dontMiss: [], investigations: [], reviewStatus: "draft" }];
const input: any = {
  presenting: { complaints: [{ complaint: "Constipation (Qabz)", worseWith: ["dry food"], betterWith: ["warm water"] }] },
  examinationDalail: [{ section: "Baraz", answers: [{ question: "Qiwam", answer: "Hard / dry pellets" }] }],
  catalogue: [], allowedTemperaments: ["Yabis", "Saudawi", "Balghami"], allowedOrgans: ["Ama", "Meda"],
};

describe("reasoning validation", () => {
  it("drops diseases that aren't in the catalogue", () => {
    const { output, removed } = validateReasoning({ differentials: [{ key: "made_up", certainty: "probable" }, { key: "qabz", certainty: "suspected", for: ["hard dry pellets"] }] }, input, cat);
    assert.deepEqual(output.differentials.map((d) => d.key), ["qabz"]);
    assert.ok(removed.some((r) => r.what === "differential" && r.text === "made_up"));
    assert.equal(output.differentials[0].unverified, true);
  });
  it("removes evidence that isn't in the recorded case", () => {
    const { output, removed } = validateReasoning({ differentials: [{ key: "qabz", for: ["hard dry pellets", "blood in stool on colonoscopy"] }] }, input, cat);
    assert.deepEqual(output.differentials[0].for, ["hard dry pellets"]);
    assert.ok(removed.some((r) => r.text === "blood in stool on colonoscopy"));
  });
  it("lowers 'probable' without two supported findings, and never allows 'confirmed'", () => {
    const { output } = validateReasoning({ differentials: [{ key: "qabz", certainty: "probable", for: ["hard pellets"] }] }, input, cat);
    assert.equal(output.differentials[0].certainty, "suspected");
    const c = validateReasoning({ differentials: [{ key: "qabz", certainty: "confirmed", for: ["hard pellets", "constipation"] }] }, input, cat);
    assert.equal(c.output.differentials[0].certainty, "suspected");
  });
  it("keeps temperaments and organs to the platform's own lists", () => {
    const { output, removed } = validateReasoning({ unani: { mizajAsli: "Yabis", suMizaj: "Choleric", organs: ["Ama", "Pancreas"] } }, input, cat);
    assert.equal(output.unani.mizajAsli, "Yabis");
    assert.equal(output.unani.suMizaj, "");
    assert.deepEqual(output.unani.organs, ["Ama"]);
    assert.ok(removed.some((r) => r.text === "Pancreas"));
  });
});

describe("de-identification", () => {
  it("removes phone numbers, emails and record codes", () => {
    const t = deidentify("Call 98765 43210 or a.b@x.com about PT1234, visit V97")!;
    assert.ok(!/98765|a\.b@x|PT1234|V97/.test(t));
  });
  it("evidence matching works on shared words", () => {
    assert.equal(supported("Hard pellets on stool exam", '"hard / dry pellets"'), true);
    assert.equal(supported("Jaundice", '"hard / dry pellets"'), false);
  });
});
