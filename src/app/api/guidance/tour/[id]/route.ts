import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGuidanceSettings, viewerFrom } from "@/lib/guidance/server";
import { tourPayload, viewerLanguage, visibleTours } from "@/lib/guidance/viewer-content";

/** A published tour the user may see, in their language, with where they left off. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await viewerFrom(req);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getGuidanceSettings();
  if (!settings.enabled || !settings.toursEnabled || viewer.clinicOff) return NextResponse.json({ error: "Guided tours are switched off" }, { status: 404 });
  const { id } = await params;
  const tour = (await visibleTours(viewer)).find((t) => t.id === id);
  if (!tour) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = await db.guidanceProgress.findUnique({ where: { userKey_tourId: { userKey: viewer.userKey, tourId: id } } });
  return NextResponse.json({ tour: tourPayload(tour, await viewerLanguage(settings), settings.fallbackLanguage, viewer), progress: p ? { state: p.state, step: p.step, version: p.version } : null });
}
