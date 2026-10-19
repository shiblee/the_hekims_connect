import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { logClinicEvent } from "@/lib/clinic-audit";
import { getGuidanceSettings } from "@/lib/guidance/server";

/** Clinic owner: is guidance on for this clinic, and how far each staff member has got with the tours. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility" || auth.staffId) return NextResponse.json({ error: "Only the clinic owner can see this" }, { status: 403 });
  const [facility, staff, settings, tours] = await Promise.all([
    db.facility.findUnique({ where: { id: auth.id }, select: { guidanceEnabled: true } }),
    db.staff.findMany({ where: { facilityId: auth.id }, select: { id: true, name: true, role: true, active: true }, orderBy: { name: "asc" } }),
    getGuidanceSettings(),
    db.guidanceTour.count({ where: { status: "published", module: { app: "clinic", enabled: true } } }),
  ]);
  const progress = await db.guidanceProgress.findMany({ where: { userKey: { in: staff.map((s) => `staff:${s.id}`) } }, select: { userKey: true, state: true, updatedAt: true } });
  return NextResponse.json({
    enabled: facility?.guidanceEnabled !== false, platformOn: settings.enabled, publishedTours: tours,
    staff: staff.map((s) => {
      const mine = progress.filter((p) => p.userKey === `staff:${s.id}`);
      return {
        id: s.id, name: s.name, role: s.role, active: s.active,
        completed: mine.filter((p) => p.state === "completed").length, skipped: mine.filter((p) => p.state === "skipped").length,
        inProgress: mine.filter((p) => p.state === "in_progress").length,
        lastAt: mine.reduce<Date | null>((a, p) => (!a || p.updatedAt > a ? p.updatedAt : a), null),
      };
    }),
  });
}

/** Clinic owner switches guidance on/off for their clinic (content and the modules themselves are unaffected). */
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility" || auth.staffId) return NextResponse.json({ error: "Only the clinic owner can change this" }, { status: 403 });
  const { enabled } = await req.json();
  await db.facility.update({ where: { id: auth.id }, data: { guidanceEnabled: !!enabled } });
  await logClinicEvent(req, auth, { action: "settings.guidance", entityType: "facility", entityId: auth.id, summary: `Guided tours and tutorials switched ${enabled ? "on" : "off"} for the clinic` });
  return NextResponse.json({ enabled: !!enabled });
}
