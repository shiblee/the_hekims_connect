import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { runSupplementAssistant } from "@/lib/supplement-assistant";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const run = await runSupplementAssistant("manual");

  await logAdminActivity(
    session.admin.id,
    "supplement_assistant_run",
    `Ran the Unani Medicine Assistant manually — ${run.status}${run.suggestionsCount ? `, ${run.suggestionsCount} new item(s)` : ""}`,
    getClientIp(req)
  );

  return NextResponse.json({ run });
}
