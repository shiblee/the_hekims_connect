import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { sendTemplatedEmail, SAMPLE_VARS } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key } = await params;
  const { to } = await req.json();
  const recipient = to || session.admin.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return NextResponse.json({ error: "Enter a valid recipient email address" }, { status: 400 });
  }

  const result = await sendTemplatedEmail({ templateKey: key, to: recipient, vars: SAMPLE_VARS, event: "test_email" });
  if (!result.sent) {
    return NextResponse.json({ error: result.error || "Could not send — check the template is active" }, { status: 400 });
  }

  const message =
    result.delivery === "sent"
      ? `Test email sent to ${recipient}.`
      : result.delivery === "failed"
      ? `Delivery failed: ${result.error} (recorded in Notification History).`
      : `Test email simulated to ${recipient} (no active SMTP configuration — see Notifications → Email Configuration).`;

  await logAdminActivity(session.admin.id, "test_email_sent", `Test "${key}" email ${result.delivery} to ${recipient}`, getClientIp(req));

  return NextResponse.json({
    sent: true,
    simulated: result.delivery === "simulated",
    subject: result.subject,
    body: result.body,
    message,
  });
}
