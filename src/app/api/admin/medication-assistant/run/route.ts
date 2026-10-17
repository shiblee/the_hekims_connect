import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { runMedicationAssistant } from "@/lib/medication-assistant";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const run = await runMedicationAssistant("manual");

  await logAdminActivity(
    session.admin.id,
    "medication_assistant_run",
    `Ran the Allopathic Medication Assistant manually — ${run.status}${run.suggestionsCount ? `, ${run.suggestionsCount} new medicine(s)` : ""}`,
    getClientIp(req)
  );

  return NextResponse.json({ run });
}
