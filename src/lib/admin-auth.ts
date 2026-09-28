import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Admin session token, intentionally separate from the hakim/patient token
 * mechanism (own header, own payload) so an admin session can never be
 * confused with a hakim/patient session or vice versa.
 *
 * Reads the token from the `x-hekim-admin-auth` header.
 * Token format: base64(`admin|${adminId}|${sessionId}`).
 */
export function getAdminAuth(req: NextRequest): { id: string; sessionId: string } | null {
  const raw = req.headers.get("x-hekim-admin-auth");
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const [type, id, sessionId] = decoded.split("|");
    if (type !== "admin" || !id || !sessionId) return null;
    return { id, sessionId };
  } catch {
    return null;
  }
}

export function makeAdminToken(id: string, sessionId: string): string {
  return Buffer.from(`admin|${id}|${sessionId}`, "utf-8").toString("base64");
}

export async function fetchAdmin(id: string) {
  return db.admin.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
      avatarImage: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Validates the admin token AND that its session is still open (not logged
 * out, not closed by a password change). Returns both the admin and the
 * session id so callers can log activity / close the session further.
 */
export async function requireAdmin(req: NextRequest) {
  const auth = getAdminAuth(req);
  if (!auth) return null;

  const session = await db.adminSession.findUnique({ where: { id: auth.sessionId } });
  if (!session || session.adminId !== auth.id || session.logoutAt) return null;

  const admin = await fetchAdmin(auth.id);
  if (!admin || !admin.active) return null;

  return { admin, sessionId: auth.sessionId };
}

export async function logAdminActivity(
  adminId: string,
  action: string,
  description?: string,
  ip?: string
) {
  await db.adminActivityLog.create({
    data: { adminId, action, description, ip },
  });
}
