import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { sendRealEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { to } = await req.json();
  const recipient = to || session.admin.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return NextResponse.json({ error: "Enter a valid recipient email address" }, { status: 400 });
  }

  const config = await db.emailConfig.findFirst();
  if (!config || !config.smtpHost || !config.fromEmail) {
    return NextResponse.json({ error: "Configure and save an SMTP host and from-email before testing" }, { status: 400 });
  }
  if (!config.active) {
    return NextResponse.json({ error: "Enable email sending (the toggle above) before testing" }, { status: 400 });
  }

  const subject = "Test email from The Hekim's Connect Admin Panel";
  const result = await sendRealEmail({
    to: recipient,
    subject,
    text: `This is a test email from The Hekim's Connect Admin Panel, confirming your SMTP configuration is working.`,
  });

  await db.notificationLog.create({
    data: {
      recipient,
      subject,
      status: result.ok ? "sent" : "failed",
      event: "test_email",
      error: result.ok ? undefined : result.reason,
    },
  });

  if (!result.ok) {
    await logAdminActivity(session.admin.id, "test_email_sent", `Test email to ${recipient} failed: ${result.reason}`, getClientIp(req));
    return NextResponse.json({ error: result.reason || "Could not send test email" }, { status: 502 });
  }

  await logAdminActivity(session.admin.id, "test_email_sent", `Test email sent to ${recipient}`, getClientIp(req));

  return NextResponse.json({
    sent: true,
    message: `Test email sent to ${recipient}.`,
  });
}
