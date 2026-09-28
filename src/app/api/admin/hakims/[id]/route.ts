import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const hakim = await db.hakim.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, license: true, specialization: true,
      experience: true, mizaj: true, rating: true, bio: true, avatarColor: true,
      verified: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      _count: { select: { appointments: true, prescriptions: true, mizajAssessments: true } },
    },
  });
  if (!hakim) return NextResponse.json({ error: "Hekim not found" }, { status: 404 });

  return NextResponse.json({ hakim });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { active } = await req.json();
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const hakim = await db.hakim.update({ where: { id }, data: { active }, select: { id: true, name: true, active: true } });
  await logAdminActivity(
    session.admin.id,
    "hakim_account_status_changed",
    `Hekim "${hakim.name}" ${active ? "activated" : "suspended"}`,
    getClientIp(req)
  );

  return NextResponse.json({ hakim });
}
