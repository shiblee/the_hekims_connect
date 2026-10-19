// User guidance: content safety, translation status/fallback, access rules and publishing.
// Run: bun run test — creates a throwaway tour and removes it.

import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { cleanDoc, cleanText, cleanTour, emptyTour, formatBlocks, pickLang, translationState } from "@/lib/guidance/content";
import { audienceMatches, canOpenModule, publishGuidance, type Viewer } from "@/lib/guidance/server";
import { moduleDef, syncGuidanceModules } from "@/lib/guidance/registry";

const created: string[] = [];
after(async () => {
  await db.guidanceVersion.deleteMany({ where: { entityId: { in: created } } });
  await db.guidanceTour.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("content safety", () => {
  it("strips scripts, tags and javascript: links from admin text", () => {
    const out = cleanText('Hi <script>alert(1)</script><b onclick="x()">there</b> [x](javascript:alert(1))');
    assert.doesNotMatch(out, /<|script|onclick|javascript:/i);
    assert.match(out, /Hi .*there/);
  });
  it("keeps only safe internal links in formatted text", () => {
    const blocks = formatBlocks("Open [Fees](/facility/profile/fees) or [bad](https://evil.example)");
    const parts = blocks[0].kind === "p" ? blocks[0].parts : [];
    assert.equal(parts.filter((p) => p.href).length, 1);
    assert.equal(parts.find((p) => p.href)?.href, "/facility/profile/fees");
  });
  it("drops unknown fields, bad ids and bad routes from saved content", () => {
    const tour = cleanTour({ title: { en: "T", xx: "?" }, steps: [{ id: "<bad>", title: { en: "S" }, body: { en: "B" }, route: "javascript:x", target: "a b" }], evil: 1 });
    assert.deepEqual(Object.keys(tour.title), ["en"]);
    assert.equal(tour.steps[0].id, "step-1");
    assert.equal(tour.steps[0].route, undefined);
    assert.equal(tour.steps[0].target, undefined);
    assert.deepEqual(Object.keys(cleanDoc({ sections: { overview: { en: "x" }, hack: { en: "y" } } }).sections), ["overview"]);
  });
});

describe("translations", () => {
  const tour = cleanTour({ title: { en: "Welcome", hi: "स्वागत" }, steps: [{ title: { en: "One", hi: "एक" }, body: { en: "Text", hi: "पाठ" } }], reviewed: {} });
  it("reports missing, partial, awaiting review and complete", () => {
    assert.equal(translationState(tour, "en"), "complete");
    assert.equal(translationState(tour, "hi"), "review");
    assert.equal(translationState(tour, "ar"), "missing");
    assert.equal(translationState(cleanTour({ ...tour, title: { en: "Welcome" } }), "hi"), "partial");
    assert.equal(translationState(cleanTour({ ...tour, reviewed: { hi: true } }), "hi"), "complete");
  });
  it("never treats an unreviewed or missing language as usable — falls back", () => {
    assert.deepEqual(pickLang(tour, "hi", "en"), { lang: "en", isFallback: true });
    assert.deepEqual(pickLang(cleanTour({ ...tour, reviewed: { hi: true } }), "hi", "en"), { lang: "hi", isFallback: false });
    assert.deepEqual(pickLang(tour, "ar", "en"), { lang: "en", isFallback: true });
  });
});

describe("access", () => {
  const owner: Viewer = { app: "clinic", userKey: "facility:x", permissions: null, isOwner: true, staffRole: null, facilityId: "x", clinicOff: false };
  const receptionist: Viewer = { ...owner, userKey: "staff:y", isOwner: false, staffRole: "Receptionist", permissions: ["patients.view", "patients.register", "payments"] };
  const admin: Viewer = { ...owner, app: "admin", userKey: "admin:z", isOwner: false };
  it("follows the clinic permissions for each module", () => {
    assert.equal(canOpenModule(receptionist, moduleDef("clinic.reception")!), true);
    assert.equal(canOpenModule(receptionist, moduleDef("clinic.staff")!), false);
    assert.equal(canOpenModule(receptionist, moduleDef("clinic.profile-setup")!), false);
    assert.equal(canOpenModule(owner, moduleDef("clinic.staff")!), true);
  });
  it("keeps clinic users and admins to their own app", () => {
    assert.equal(canOpenModule(owner, moduleDef("admin.facilities")!), false);
    assert.equal(canOpenModule(admin, moduleDef("clinic.reception")!), false);
    assert.equal(canOpenModule(admin, moduleDef("admin.facilities")!), true);
  });
  it("matches the tour audience", () => {
    assert.equal(audienceMatches(receptionist, "[]"), true);
    assert.equal(audienceMatches(receptionist, '["role:Receptionist"]'), true);
    assert.equal(audienceMatches(receptionist, '["owner"]'), false);
    assert.equal(audienceMatches(owner, '["owner"]'), true);
    assert.equal(audienceMatches(receptionist, '["staff"]'), true);
  });
});

describe("publishing", () => {
  it("users keep the published copy until the next publish; every publish is kept in history", async () => {
    await syncGuidanceModules(db);
    const one = cleanTour({ title: { en: "Test tour" }, steps: [{ title: { en: "Step" }, body: { en: "First" } }] });
    const tour = await db.guidanceTour.create({ data: { moduleKey: "clinic.reception", name: "test", draft: JSON.stringify(one) } });
    created.push(tour.id);
    assert.equal(await publishGuidance("tour", tour.id, "test"), 1);
    // Edit the draft: the published copy must not change.
    const two = cleanTour({ ...one, steps: [{ title: { en: "Step" }, body: { en: "Second" } }] });
    await db.guidanceTour.update({ where: { id: tour.id }, data: { draft: JSON.stringify(two), dirty: true } });
    let row = await db.guidanceTour.findUniqueOrThrow({ where: { id: tour.id } });
    assert.equal(JSON.parse(row.published!).steps[0].body.en, "First");
    assert.equal(await publishGuidance("tour", tour.id, "test"), 2);
    row = await db.guidanceTour.findUniqueOrThrow({ where: { id: tour.id } });
    assert.equal(JSON.parse(row.published!).steps[0].body.en, "Second");
    assert.equal(row.dirty, false);
    assert.equal(await db.guidanceVersion.count({ where: { entityId: tour.id } }), 2);
  });
  it("an empty tour has no complete English and can't be published", () => {
    assert.notEqual(translationState(emptyTour("x"), "en"), "complete");
  });
});
