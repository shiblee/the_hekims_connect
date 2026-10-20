// Staff permissions: every request a workflow makes must be allowed for the roles that do that work.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowed, defaultsFor, requiredPermission } from "@/lib/staff-permissions";

const can = (role: string, method: string, path: string) => allowed(defaultsFor(role), requiredPermission(path, method));
const V = "/api/facility/visits/v123";

describe("receptionist: register a patient and collect a fee", () => {
  const steps: [string, string][] = [
    ["GET", "/api/facility/metadata"], ["GET", "/api/facility/allergies"], ["GET", "/api/facility/medications"],
    ["GET", "/api/facility/screening/config"], ["GET", "/api/facility/patients/search?mobile=98"], ["GET", "/api/facility/staff?active=true"],
    ["POST", "/api/facility/patients"], ["PATCH", "/api/facility/patients/p1"], ["POST", "/api/facility/visits"], ["PATCH", V],
    ["GET", `${V}/registration`], ["POST", `${V}/intake`], ["GET", "/api/facility/fees"], ["POST", "/api/facility/payments"],
  ];
  for (const [method, path] of steps) it(`${method} ${path}`, () => assert.equal(can("Receptionist", method, path), true));
});

describe("intake rules", () => {
  it("nurses (triage) can still correct the reason for visit", () => assert.equal(can("Staff Nurse", "POST", `${V}/intake`), true));
  it("roles without registration or triage can't change it", () => assert.equal(can("Cashier / Accounts", "POST", `${V}/intake`), false));
  it("receptionists still can't record vitals", () => assert.equal(can("Receptionist", "POST", `${V}/vitals`), false));
});

describe("Stage 5 medicine safety", () => {
  it("anyone who can write dossier medicines can run the safety check", () => {
    assert.equal(can("Junior Hakim / Intern", "POST", `${V}/dossier`), true);
    assert.equal(can("Junior Hakim / Intern", "POST", "/api/facility/tashkhees/prescription-check"), true);
  });
  it("reception can't", () => assert.equal(can("Receptionist", "POST", "/api/facility/tashkhees/prescription-check"), false));
});

describe("Stage 5 senior sign-off", () => {
  it("Hakims can sign off by default", () => assert.ok(defaultsFor("Hakim").includes("diagnosis.signoff")));
  it("Junior Hakims submit for sign-off instead", () => assert.ok(!defaultsFor("Junior Hakim / Intern").includes("diagnosis.signoff")));
  it("the safety review is part of Stage 5", () => {
    assert.equal(can("Junior Hakim / Intern", "POST", `${V}/safety`), true);
    assert.equal(can("Receptionist", "POST", `${V}/safety`), false);
  });
});
