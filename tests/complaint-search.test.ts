// Chief-complaint search: classical names, typos, synonyms and ranking.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchEntries, normalizeTerm, isSameTerm, matchedAlias } from "@/lib/complaint-search";

const list = [
  { id: "headache", label: "Headache (Suda'a)", labelLocal: "सरदर्द", synonyms: '["sar dard","migraine"]', category: "Neurological & Mental Health" },
  { id: "fever", label: "Fever (Humma)", labelLocal: "बुखार", synonyms: '["bukhar"]', category: "General / Constitutional" },
  { id: "indigestion", label: "Indigestion (Su'-e-Hazm)", labelLocal: "अपच", synonyms: "[]", category: "Digestive" },
  { id: "abdominal", label: "Abdominal Pain (Waja-ul-Batn)", labelLocal: "पेट दर्द", synonyms: "[]", category: "Digestive" },
  { id: "joint", label: "Joint Pain (Waja-ul-Mafasil)", labelLocal: "जोड़ों का दर्द", synonyms: "[]", category: "Musculoskeletal" },
  { id: "cough", label: "Cough / Breathing Difficulty (Su'aal)", labelLocal: null, synonyms: "[]", category: "Respiratory" },
];
const top = (q: string) => searchEntries(list, q)[0]?.id;

describe("complaint search", () => {
  it("finds by English name", () => assert.equal(top("head"), "headache"));
  it("finds by classical Unani name", () => assert.equal(top("humma"), "fever"));
  it("ignores apostrophes and hyphens", () => { assert.equal(top("suaal"), "cough"); assert.equal(top("su e hazm"), "indigestion"); });
  it("finds by synonym", () => { assert.equal(top("sar dard"), "headache"); assert.equal(top("bukhar"), "fever"); });
  it("finds by local script", () => assert.equal(top("बुखार"), "fever"));
  it("tolerates typos", () => { assert.equal(top("headche"), "headache"); assert.equal(top("fevr"), "fever"); });
  it("matches every word, any order", () => assert.equal(top("pain joint"), "joint"));
  it("ranks the closer match first", () => assert.deepEqual(searchEntries(list, "waja").map((e) => e.id).sort(), ["abdominal", "joint"]));
  it("returns nothing for unrelated text", () => assert.equal(searchEntries(list, "xyzzy").length, 0));
  it("normalizes", () => assert.equal(normalizeTerm("  Su'-e-Hazm  "), "su e hazm"));
  it("detects the same term", () => { assert.equal(isSameTerm("sar-dard", list[0]), true); assert.equal(isSameTerm("suda'a", list[0]), true); assert.equal(isSameTerm("chakkar", list[0]), false); });
  it("explains a synonym match", () => { assert.equal(matchedAlias(list[0], "migraine"), "migraine"); assert.equal(matchedAlias(list[0], "head"), null); });
});
