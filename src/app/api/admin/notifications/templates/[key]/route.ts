import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key } = await params;
  const template = await db.emailTemplate.findUnique({ where: { key } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  return NextResponse.json({ template });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key } = await params;
  const existing = await db.emailTemplate.findUnique({ where: { key } });
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { subject, body, status } = await req.json();
  if (!subject || !String(subject).trim()) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (!body || !String(body).trim()) {
    return NextResponse.json({ error: "Email body is required" }, { status: 400 });
  }
  if (status && !["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await db.emailTemplate.update({
    where: { key },
    data: {
      subject: String(subject),
      body: String(body),
      status: status ?? existing.status,
      updatedBy: session.admin.id,
    },
  });

  const statusChanged = status && status !== existing.status;
  await logAdminActivity(
    session.admin.id,
    statusChanged ? "email_template_status_changed" : "email_template_updated",
    `Template "${existing.name}"${statusChanged ? ` ${status === "active" ? "enabled" : "disabled"}` : " content updated"}`,
    getClientIp(req)
  );

  return NextResponse.json({ template: updated });
}
