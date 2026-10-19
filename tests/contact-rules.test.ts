// Sign-in contact rules (src/lib/contact-rules.ts) against the real database.
// Run: bun run test   — creates throwaway records and removes them afterwards.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { findClinicContactClash, clinicClashMessage } from "@/lib/contact-rules";

const tag = `rules${Date.now()}`;
const email = `${tag}@example.test`;
const staffEmail = `${tag}.staff@example.test`;
const phone = `9${String(Date.now()).slice(-9)}`;
const ids = { facility: "", staff: "", patients: [] as string[] };

before(async () => {
  const f = await db.facility.create({ data: { facilityName: `Test ${tag}`, email, phone, password: "x" } });
  ids.facility = f.id;
  const s = await db.staff.create({ data: { staffCode: `T${tag}`, facilityId: f.id, name: `Staff ${tag}`, email: staffEmail, employeeType: "Other" } });
  ids.staff = s.id;
});

after(async () => {
  await db.patient.deleteMany({ where: { id: { in: ids.patients } } });
  await db.staff.deleteMany({ where: { id: ids.staff } });
  await db.facility.deleteMany({ where: { id: ids.facility } });
  await db.$disconnect();
});

describe("clinic sign-in group (facilities + staff)", () => {
  it("rejects a facility's email for another facility or a new staff member", async () => {
    const clash = await findClinicContactClash(email);
    assert.equal(clash?.kind, "facility");
    assert.equal(clash?.field, "email");
  });

  it("matches emails case-insensitively", async () => {
    assert.equal((await findClinicContactClash(email.toUpperCase()))?.kind, "facility");
  });

  it("rejects a facility's mobile for staff too (shared login page)", async () => {
    const clash = await findClinicContactClash(phone);
    assert.equal(clash?.kind, "facility");
    assert.equal(clash?.field, "phone");
  });

  it("rejects a staff member's email for a facility or another staff member", async () => {
    assert.equal((await findClinicContactClash(staffEmail))?.kind, "staff");
  });

  it("lets a record keep its own contact when edited", async () => {
    assert.equal(await findClinicContactClash(email, { facilityId: ids.facility }), null);
    assert.equal(await findClinicContactClash(staffEmail, { staffId: ids.staff }), null);
  });

  it("allows contacts nobody in the clinic group uses", async () => {
    assert.equal(await findClinicContactClash(`${tag}.free@example.test`), null);
  });

  it("gives a message that names the kind of account, not the clinic", async () => {
    const msg = clinicClashMessage((await findClinicContactClash(email))!);
    assert.match(msg, /already used by a clinic account/);
    assert.doesNotMatch(msg, new RegExp(tag));
  });
});

describe("facility ↔ patient sharing", () => {
  it("lets a patient have the same email and mobile as a facility", async () => {
    const p = await db.patient.create({ data: { name: `Patient ${tag}`, email, phone, password: "x" } });
    ids.patients.push(p.id);
    const found = await db.patient.findUnique({ where: { id: p.id }, select: { email: true, phone: true } });
    assert.deepEqual(found, { email, phone });
  });

  it("does not count patients against the clinic group", async () => {
    const patientOnly = `${tag}.patient@example.test`;
    const p = await db.patient.create({ data: { name: `Patient2 ${tag}`, email: patientOnly, password: "x" } });
    ids.patients.push(p.id);
    assert.equal(await findClinicContactClash(patientOnly), null);
  });

  it("lets a staff member share a patient's email", async () => {
    // staffEmail is a staff contact; a patient may use it too.
    const p = await db.patient.create({ data: { name: `Patient3 ${tag}`, email: staffEmail, password: "x" } });
    ids.patients.push(p.id);
    assert.ok(p.id);
  });
});

describe("patient ↔ patient", () => {
  it("still keeps patient emails unique (database rule)", async () => {
    await assert.rejects(db.patient.create({ data: { name: `Dup ${tag}`, email, password: "x" } }));
  });
});
