import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { currentPassword, newPassword, confirmPassword } = await req.json();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: "New password must contain both letters and numbers" }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "New password and confirmation do not match" }, { status: 400 });
  }

  const admin = await db.admin.findUnique({ where: { id: session.admin.id } });
  if (!admin || !verifyPassword(currentPassword, admin.password)) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }
  if (verifyPassword(newPassword, admin.password)) {
    return NextResponse.json({ error: "New password must be different from the current password" }, { status: 400 });
  }

  await db.admin.update({
    where: { id: admin.id },
    data: { password: hashPassword(newPassword) },
  });

  // Revoke the session that made this change — the admin must sign in again.
  await db.adminSession.update({
    where: { id: session.sessionId },
    data: { logoutAt: new Date(), logoutType: "password_change" },
  });

  await logAdminActivity(admin.id, "password_changed", "Password changed; session revoked", getClientIp(req));

  return NextResponse.json({ success: true });
}
