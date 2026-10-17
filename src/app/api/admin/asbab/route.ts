import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { loadAsbabConfig, frameworkOf } from "@/lib/asbab-server";

/** Full configuration of one framework (?framework=asbab|dalail), including disabled sections/questions/options. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ pillars: await loadAsbabConfig(false, frameworkOf(req.nextUrl.searchParams.get("framework"))) });
}
