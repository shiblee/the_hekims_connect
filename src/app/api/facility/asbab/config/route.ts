import { NextRequest, NextResponse } from "next/server";
import { getClinicActor } from "@/lib/reports-server";
import { loadAsbabConfig, toPillarCfg, frameworkOf } from "@/lib/asbab-server";

/** Active Asbab-e-Sittah pillars, questions and options for Stage 4. */
export async function GET(req: NextRequest) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ pillars: toPillarCfg(await loadAsbabConfig(true, frameworkOf(req.nextUrl.searchParams.get("framework")))) });
}
