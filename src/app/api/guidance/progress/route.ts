import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { viewerFrom } from "@/lib/guidance/server";
import { visibleTours } from "@/lib/guidance/viewer-content";

const STATES = ["in_progress", "completed", "skipped"];

/**
 * Body { tourId, state, step } — records where the user is in a tour, or { reset: true, tourId? }
 * to restart one (or all) tours. Only touches tour progress, never any other record.
 */
export async function POST(req: NextRequest) {
  const viewer = await viewerFrom(req);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.reset) {
    const where = { userKey: viewer.userKey, ...(typeof body.tourId === "string" ? { tourId: body.tourId } : {}) };
    const { count } = await db.guidanceProgress.deleteMany({ where });
    return NextResponse.json({ reset: count });
  }

  const tour = (await visibleTours(viewer)).find((t) => t.id === body.tourId);
  if (!tour) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!STATES.includes(body.state)) return NextResponse.json({ error: "Bad state" }, { status: 400 });
  const step = Math.max(0, Math.min(100, parseInt(body.step, 10) || 0));
  const done = body.state !== "in_progress";
  await db.guidanceProgress.upsert({
    where: { userKey_tourId: { userKey: viewer.userKey, tourId: tour.id } },
    create: { userKey: viewer.userKey, tourId: tour.id, version: tour.version, state: body.state, step, completedAt: done ? new Date() : null },
    update: { version: tour.version, state: body.state, step, completedAt: done ? new Date() : null },
  });
  return NextResponse.json({ ok: true });
}
