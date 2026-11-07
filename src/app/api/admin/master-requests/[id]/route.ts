import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { reviewRequest, type ReviewAction } from "@/lib/master-requests";

// Approve as a new entry (complaint, allergy or medicine), merge into an existing one (becomes a synonym), or reject.
// The same term from other clinics is resolved too, and visits that used it are re-linked.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  let input: ReviewAction;
  if (b.action === "approve") input = { action: "approve", label: String(b.label ?? ""), labelLocal: b.labelLocal ?? null, category: String(b.category ?? ""), kind: typeof b.kind === "string" ? b.kind : undefined, synonyms: Array.isArray(b.synonyms) ? b.synonyms.map(String) : [] };
  else if (b.action === "merge") input = { action: "merge", targetId: String(b.targetId ?? "") };
  else if (b.action === "reject") input = { action: "reject", note: String(b.note ?? "") };
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const result = await reviewRequest(id, session.admin.name, input);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  await logAdminActivity(session.admin.id, `master_request.${input.action}`,
    input.action === "reject" ? `Rejected a master-data request: ${input.note}` : `Master-data request ${input.action === "merge" ? "merged into" : "approved as"} "${result.entry?.label}" (${result.resolved} clinic request(s), ${result.visits} visit(s) re-linked)`).catch(() => {});
  return NextResponse.json(result);
}
