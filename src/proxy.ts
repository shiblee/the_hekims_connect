import { NextRequest, NextResponse } from "next/server";
import { allowed, requiredPermission } from "@/lib/staff-permissions";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { readSessionToken } from "@/lib/session-token";

/**
 * Staff permissions, enforced on the server for every API call made with a staff session
 * (the clinic owner and patients pass straight through). Answers 403 — never 401, which
 * would sign the person out — so a blocked action just shows an error.
 */
export async function proxy(req: NextRequest) {
  const claims = await readSessionToken(req.headers.get("x-hekim-auth"));
  // Not a valid staff token: the route's own session check decides (401 for bad / expired tokens).
  if (!claims || claims.expired || claims.type !== "staff") return NextResponse.next();
  const id = claims.id;

  const need = requiredPermission(req.nextUrl.pathname, req.method);
  if (need === "allow") return NextResponse.next();
  const access = await loadStaffAccess(id);
  if (!access) return NextResponse.next(); // inactive — the route itself answers 401
  if (allowed(access.permissions, need)) return NextResponse.next();
  return NextResponse.json({ error: "You don't have permission for this. Ask the clinic owner to change your permissions." }, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
