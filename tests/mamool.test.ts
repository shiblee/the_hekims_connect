// Mamool-e-Matab: which regimens are suggested, and applying one never overwrites the prescription.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchRegimen, type RegimenSnapshot } from "@/lib/mamool";
import { applyRegimen, type Regimen } from "@/components/facility/views/mamool-picker";
import type { PrescriptionLine } from "@/lib/tashkhees";

const snap = (complaints: { id: string; required?: boolean }[]): RegimenSnapshot => ({
  name: "R", description: null, clinicalNotes: null, medicines: [],
  complaints: complaints.map((c) => ({ id: c.id, label: c.id.toUpperCase(), required: !!c.required })),
});

describe("matching", () => {
  it("any match by default", () => { const m = matchRegimen(snap([{ id: "a" }, { id: "b" }]), ["b", "z"]); assert.equal(m.suggested, true); assert.deepEqual(m.matched, ["B"]); });
  it("not suggested with no shared complaint", () => assert.equal(matchRegimen(snap([{ id: "a" }]), ["z"]).suggested, false));
  it("required complaints must all be present", () => {
    const s = snap([{ id: "a", required: true }, { id: "b", required: true }, { id: "c" }]);
    assert.equal(matchRegimen(s, ["a", "c"]).suggested, false);
    assert.deepEqual(matchRegimen(s, ["a", "c"]).missingRequired, ["B"]);
    assert.equal(matchRegimen(s, ["a", "b"]).suggested, true);
  });
});

const med = (tagId: string, dose = "1 tab", available = true) => ({ tagId, name: tagId, kind: "supplement", form: "Tablet", dose, timing: "Twice daily", duration: "7 days", adjuvant: "", instructions: "", available });
const regimen = (id: string, meds: ReturnType<typeof med>[]): Regimen => ({ id, code: id, version: 2, approvedByName: "A", name: `Regimen ${id}`, description: null, clinicalNotes: null, complaints: [], medicines: meds, match: { matched: [], missingRequired: [], suggested: true } });
const line = (tagId: string, dose = "1 tab"): PrescriptionLine => ({ tagId, name: tagId, form: "Tablet", dose, timing: "Twice daily", duration: "7 days", adjuvant: "", instructions: "" });

describe("applying a regimen", () => {
  it("adds each medicine as its own line with its source", () => {
    const r = applyRegimen([], regimen("A", [med("m1"), med("m2"), med("m3"), med("m4")]));
    assert.equal(r.lines.length, 4); assert.equal(r.added, 4);
    assert.equal(r.lines[0].sourceRegimenId, "A"); assert.equal(r.lines[0].sourceRegimenVersion, 2); assert.equal(r.lines[2].dose, "1 tab");
  });
  it("keeps medicines the doctor already added", () => {
    const r = applyRegimen([line("manual")], regimen("A", [med("m1")]));
    assert.deepEqual(r.lines.map((l) => l.tagId), ["manual", "m1"]); assert.equal(r.lines[0].sourceRegimenId, undefined);
  });
  it("skips an identical medicine already prescribed", () => {
    const r = applyRegimen([line("m1")], regimen("A", [med("m1"), med("m2")]));
    assert.equal(r.added, 1); assert.equal(r.skippedSame, 1); assert.equal(r.lines.length, 2);
  });
  it("adds a conflicting duplicate so the doctor can resolve it — never merged", () => {
    const r = applyRegimen([line("m1", "1 tab")], regimen("B", [med("m1", "2 tabs")]));
    assert.equal(r.lines.filter((l) => l.tagId === "m1").length, 2); assert.equal(r.lines[0].dose, "1 tab"); assert.equal(r.lines[1].dose, "2 tabs");
  });
  it("combines two regimens", () => {
    const one = applyRegimen([], regimen("A", [med("m1"), med("m2")]));
    const two = applyRegimen(one.lines, regimen("B", [med("m2"), med("m3")]));
    assert.deepEqual(two.lines.map((l) => `${l.tagId}:${l.sourceRegimenId}`), ["m1:A", "m2:A", "m3:B"]); assert.equal(two.skippedSame, 1);
  });
  it("skips medicines withdrawn from the medicine list", () => {
    const r = applyRegimen([], regimen("A", [med("m1"), med("gone", "1 tab", false)]));
    assert.equal(r.added, 1); assert.equal(r.skippedUnavailable, 1);
  });
});
