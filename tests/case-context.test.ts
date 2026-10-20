// Stage 5 case readiness: vital-sign alerts use fixed, tested cut-offs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { vitalFlags } from "@/lib/case-context";

const v = (o: Partial<Parameters<typeof vitalFlags>[0]>) => vitalFlags({ bpSystolic: null, bpDiastolic: null, pulse: null, spo2: null, temperatureF: null, ...o });
const keys = (o: Partial<Parameters<typeof vitalFlags>[0]>) => v(o).map((f) => `${f.key}:${f.level}`);

describe("vital-sign alerts", () => {
  it("normal readings raise nothing", () => assert.deepEqual(keys({ bpSystolic: 120, bpDiastolic: 80, pulse: 76, spo2: 98, temperatureF: 98.4 }), []));
  it("missing readings raise nothing (unrecorded is not abnormal)", () => assert.deepEqual(keys({}), []));
  it("fever bands", () => {
    assert.deepEqual(keys({ temperatureF: 100.4 }), ["fever:caution"]);
    assert.deepEqual(keys({ temperatureF: 103 }), ["fever_high:high"]);
  });
  it("oxygen bands", () => {
    assert.deepEqual(keys({ spo2: 94 }), ["spo2_borderline:caution"]);
    assert.deepEqual(keys({ spo2: 91 }), ["spo2_low:high"]);
  });
  it("blood pressure bands", () => {
    assert.deepEqual(keys({ bpSystolic: 140, bpDiastolic: 90 }), ["bp_high:caution"]);
    assert.deepEqual(keys({ bpSystolic: 180, bpDiastolic: 110 }), ["bp_very_high:high"]);
    assert.deepEqual(keys({ bpSystolic: 85, bpDiastolic: 50 }), ["bp_low:high"]);
  });
  it("pulse bands", () => {
    assert.deepEqual(keys({ pulse: 105 }), ["pulse_fast:caution"]);
    assert.deepEqual(keys({ pulse: 125 }), ["pulse_very_fast:high"]);
    assert.deepEqual(keys({ pulse: 45 }), ["pulse_slow:caution"]);
  });
});
