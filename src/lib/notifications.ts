import { db } from "@/lib/db";

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Renders and "sends" a templated email. No live SMTP transport is wired up yet
 * (see Notifications → Email Configuration), so this simulates delivery and
 * records it in Notification History rather than silently pretending to send
 * real mail. Swap the body of the `if` block for a real provider call once one
 * is configured.
 */
export async function sendTemplatedEmail(opts: {
  templateKey: string;
  to: string;
  vars: Record<string, string>;
  event?: string;
}): Promise<{ sent: boolean; subject: string | null; body: string | null }> {
  const template = await db.emailTemplate.findUnique({ where: { key: opts.templateKey } });

  if (!template || template.status !== "active") {
    await db.notificationLog.create({
      data: {
        recipient: opts.to,
        templateKey: opts.templateKey,
        status: "failed",
        event: opts.event,
        error: !template ? "Template not found" : "Template is inactive",
      },
    });
    return { sent: false, subject: null, body: null };
  }

  const subject = renderTemplate(template.subject, opts.vars);
  const body = renderTemplate(template.body, opts.vars);

  await db.notificationLog.create({
    data: {
      recipient: opts.to,
      templateKey: opts.templateKey,
      subject,
      status: "simulated",
      event: opts.event,
    },
  });

  return { sent: true, subject, body };
}

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    key: "hakim_otp_verification",
    name: "Hekim OTP Verification",
    type: "OTP",
    subject: "Verify your email — {{portal_name}} OTP",
    body: `Hi {{hakim_name}},

Your One-Time Password (OTP) to verify your email on {{portal_name}} is:

{{otp}}

This code is valid for {{otp_validity}} minutes. Please do not share it with anyone.

If you did not request this, you can safely ignore this email.

— {{portal_name}} Team`,
  },
  {
    key: "hakim_welcome",
    name: "Hekim Registration Success / Welcome",
    type: "Welcome",
    subject: "Welcome to {{portal_name}}, {{hakim_name}}!",
    body: `Hi {{hakim_name}},

Congratulations! Your email address {{hakim_email}} has been successfully verified and your registration on {{portal_name}} is now complete.

You registered on {{registration_date}}.

You can now log in and start using your Hekim portal:
{{login_url}}

If you have any questions, our support team is here to help.

— {{portal_name}} Team`,
  },
];

export const SAMPLE_VARS: Record<string, string> = {
  hakim_name: "Dr. Aliam Colter",
  hakim_email: "colter@hekims.connect",
  otp: "482913",
  otp_validity: "10",
  portal_name: "The Hekim's Connect",
  registration_date: new Date().toLocaleDateString(),
  login_url: "https://hekims.connect/login/hakim",
};
