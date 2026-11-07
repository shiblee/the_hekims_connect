import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { actorOf, logClinicEvent } from "@/lib/clinic-audit";
import { isRequestList, LIST_POLICIES, pendingRequests, requestTerm } from "@/lib/master-requests";

// A clinician's request to add a term that isn't in a master list (chief complaints,
// allergies, current medicines). The term is usable on this clinic's visits straight
// away, marked "pending review", until an Admin reviewer decides.

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const listKey = req.nextUrl.searchParams.get("listKey") || "chief_complaint";
  if (!isRequestList(listKey)) return NextResponse.json({ error: "Unknown list" }, { status: 400 });
  return NextResponse.json({ requests: await pendingRequests(listKey, auth.id) });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const listKey = typeof body.listKey === "string" ? body.listKey : "chief_complaint";
  if (!isRequestList(listKey)) return NextResponse.json({ error: "Unknown list" }, { status: 400 });
  const term = typeof body.term === "string" ? body.term : "";

  const actor = await actorOf(auth);
  const result = await requestTerm(listKey, auth.id, auth.staffId ?? null, actor.actorName, term, body.kind);
  if (result.kind === "invalid") return NextResponse.json({ error: "Type the name first" }, { status: 400 });
  if (result.kind === "request" && result.request.status === "pending") {
    await logClinicEvent(req, auth, {
      action: "master_request.created", summary: `Asked to add ${LIST_POLICIES[listKey].label.toLowerCase()} "${result.request.term}" (pending review)`,
      entityType: "master_request", entityId: result.request.id, entityLabel: result.request.term,
    }).catch(() => {});
  }
  // Older clients read `complaint` on a match.
  return NextResponse.json(result.kind === "match" ? { ...result, complaint: result.entry } : result);
}
