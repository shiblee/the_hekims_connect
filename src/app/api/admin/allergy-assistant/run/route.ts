import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { runAllergyAssistant } from "@/lib/allergy-assistant";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const run = await runAllergyAssistant("manual");

  await logAdminActivity(
    session.admin.id,
    "allergy_assistant_run",
    `Ran the Unani Allergy Assistant manually — ${run.status}${run.suggestionsCount ? `, ${run.suggestionsCount} new allerg${run.suggestionsCount === 1 ? "y" : "ies"}` : ""}`,
    getClientIp(req)
  );

  return NextResponse.json({ run });
}
