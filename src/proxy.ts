import { NextRequest, NextResponse } from "next/server";
import { logClinicEventRaw } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { allowed, requiredPermission } from "@/lib/staff-permissions";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { readSessionToken } from "@/lib/session-token";

/**
 * Staff permissions, enforced on the server for every API call made with a staff session
 * (the clinic owner and patients pass straight through). Answers 403 — never 401, which
 * would sign the person out — so a blocked action just shows an error.
 */
export async function proxy(req: NextRequest) {
  // Admin panel pages: always English, left to right — the root layout reads this marker.
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    const headers = new Headers(req.headers);
    headers.set("x-hekim-area", "admin");
    return NextResponse.next({ request: { headers } });
  }
  const claims = await readSessionToken(req.headers.get("x-hekim-auth"));
  // Not a valid staff token: the route's own session check decides (401 for bad / expired tokens).
  if (!claims || claims.expired || claims.type !== "staff") return NextResponse.next();
  const id = claims.id;

  const need = requiredPermission(req.nextUrl.pathname, req.method);
  if (need === "allow") return NextResponse.next();
  const access = await loadStaffAccess(id);
  if (!access) return NextResponse.next(); // inactive — the route itself answers 401
  if (allowed(access.permissions, need)) return NextResponse.next();
  const s = await db.staff.findUnique({ where: { id }, select: { name: true, staffCode: true } });
  await logClinicEventRaw({
    facilityId: access.facilityId, actorType: "staff", actorId: id, actorName: s ? `${s.name} (${s.staffCode})` : "Staff member",
    action: "access.denied", outcome: "denied", summary: `Refused: ${req.method} ${req.nextUrl.pathname} (needs ${need === "deny" ? "clinic owner" : need.join(" or ")})`,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, sessionId: claims.sessionId,
  });
  return NextResponse.json({ error: "You don't have permission for this. Ask the clinic owner to change your permissions." }, { status: 403 });
}

export const config = { matcher: ["/api/:path*", "/admin", "/admin/:path*"] };
