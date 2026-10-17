import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { setJobStatus } from "@/lib/supplement-enrichment";

const ACTIONS = { pause: "paused", resume: "running", cancel: "cancelled" } as const;

/** Body { action: "pause" | "resume" | "cancel" }. Items already in progress finish; nothing is rolled back. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json().catch(() => ({}));
  const status = ACTIONS[action as keyof typeof ACTIONS];
  if (!status) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const job = await setJobStatus(id, status);
  if (!job) return NextResponse.json({ error: "This run has already finished" }, { status: 409 });
  await logAdminActivity(session.admin.id, "supplement_enrichment_job", `${action[0].toUpperCase()}${action.slice(1)}d the ${job.kind === "medication" ? "allopathic medications" : "supplements & herbs"} ${job.mode} enrichment run`, getClientIp(req));
  return NextResponse.json({ ok: true });
}
