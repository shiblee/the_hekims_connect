import { db } from "@/lib/db";
import { sendRealEmail } from "@/lib/mailer";

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same as renderTemplate, but HTML-escapes each value first — use for HTML email bodies. */
export function renderHtmlTemplate(template: string, vars: Record<string, string>): string {
  const escaped = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, escapeHtml(v)]));
  return renderTemplate(template, escaped);
}

/** Crude HTML-to-text fallback for the plain-text part of an HTML email. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Renders and sends a templated email. If an active SMTP configuration exists
 * (Notifications → Email Configuration), this actually delivers the email via
 * `sendRealEmail`; otherwise it falls back to simulating delivery and only
 * recording it in Notification History, so the OTP/demo flow keeps working
 * without any provider configured.
 */
export async function sendTemplatedEmail(opts: {
  templateKey: string;
  to: string;
  vars: Record<string, string>;
  event?: string;
}): Promise<{ sent: boolean; delivery: "sent" | "simulated" | "failed"; subject: string | null; body: string | null; error?: string }> {
  const template = await db.emailTemplate.findUnique({ where: { key: opts.templateKey } });

  if (!template || template.status !== "active") {
    const error = !template ? "Template not found" : "Template is inactive";
    await db.notificationLog.create({
      data: { recipient: opts.to, templateKey: opts.templateKey, status: "failed", event: opts.event, error },
    });
    return { sent: false, delivery: "failed", subject: null, body: null, error };
  }

  const subject = renderTemplate(template.subject, opts.vars);
  const body = renderHtmlTemplate(template.body, opts.vars);

  const result = await sendRealEmail({ to: opts.to, subject, html: body, text: htmlToText(body) });
  const delivery = result.ok ? "sent" : result.reason === "not_configured" ? "simulated" : "failed";

  await db.notificationLog.create({
    data: {
      recipient: opts.to,
      templateKey: opts.templateKey,
      subject,
      status: delivery,
      event: opts.event,
      error: delivery === "failed" ? result.reason : undefined,
    },
  });

  return { sent: true, delivery, subject, body, error: delivery === "failed" ? result.reason : undefined };
}

const EMAIL_HEADER = `<tr>
<td style="background-color:#0f5c52; padding:28px 36px; text-align:center;">
<div style="font-family:Georgia, 'Times New Roman', serif; font-size:21px; letter-spacing:0.5px; color:#f6ead0; font-weight:700;">{{portal_name}}</div>
<div style="font-family:Georgia, serif; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:#b7d9cf; margin-top:6px;">Unani Medicine &middot; Modern Care</div>
</td>
</tr>
<tr>
<td style="padding:8px 0 0 0; text-align:center;">
<div style="color:#c7963f; font-size:14px; letter-spacing:4px; padding:14px 0 0 0;">&#10087;</div>
</td>
</tr>`;

const EMAIL_FOOTER = `<tr>
<td style="padding:28px 40px 32px 40px;">
<div style="border-top:1px solid #e3d9c0; padding-top:18px; text-align:center;">
<div style="color:#c7963f; font-size:12px; letter-spacing:3px; margin-bottom:10px;">&#10087;</div>
<p style="margin:0; font-family:Helvetica, Arial, sans-serif; font-size:12px; line-height:1.7; color:#9a9183;">
{{portal_name}} &mdash; connecting Facilities and patients for the full continuum of Unani care.<br/>
This is an automated message, please do not reply directly to this email.
</p>
</div>
</td>
</tr>`;

function emailShell(innerRows: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0; padding:0; background-color:#f3ede0; font-family:Georgia, 'Times New Roman', serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3ede0; padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#fffdf8; border:1px solid #e3d9c0; border-radius:10px; overflow:hidden;">
${EMAIL_HEADER}
${innerRows}
${EMAIL_FOOTER}
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    key: "facility_otp_verification",
    name: "Facility OTP Verification",
    type: "OTP",
    subject: "Verify your email — {{portal_name}} OTP",
    body: emailShell(`<tr>
<td style="padding:20px 40px 8px 40px; font-family:Georgia, 'Times New Roman', serif;">
<p style="margin:0 0 18px 0; font-size:17px; color:#2b2420;">Dear {{facility_name}},</p>
<p style="margin:0 0 22px 0; font-size:15px; line-height:1.7; color:#4a4238; font-family:Helvetica, Arial, sans-serif;">
Please use the verification code below to confirm your email on <strong>{{portal_name}}</strong> &mdash; your home for Unani practice, Mizaj assessment and patient care.
</p>
</td>
</tr>
<tr>
<td style="padding:0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf3e1; border:1px dashed #c7963f; border-radius:8px;">
<tr>
<td style="padding:22px 20px; text-align:center;">
<div style="font-family:'Courier New', monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#0f5c52;">{{otp}}</div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:18px 40px 4px 40px; font-family:Helvetica, Arial, sans-serif;">
<p style="margin:0 0 10px 0; font-size:13.5px; line-height:1.6; color:#6b6155;">
This code is valid for <strong>{{otp_validity}} minutes</strong> and can only be used once. Please do not share it with anyone &mdash; our team will never ask you for it.
</p>
<p style="margin:0; font-size:13.5px; line-height:1.6; color:#6b6155;">
If you did not request this code, you can safely ignore this email.
</p>
</td>
</tr>`),
  },
  {
    key: "facility_welcome",
    name: "Facility Registration Success / Welcome",
    type: "Welcome",
    subject: "Welcome to {{portal_name}}, {{facility_name}}!",
    body: emailShell(`<tr>
<td style="padding:22px 40px 6px 40px; text-align:center; font-family:Georgia, 'Times New Roman', serif;">
<div style="font-size:23px; color:#0f5c52; font-weight:700;">Welcome, {{facility_name}}</div>
<p style="margin:10px 0 0 0; font-size:14.5px; line-height:1.7; color:#6b6155; font-family:Helvetica, Arial, sans-serif;">
Your registration on {{portal_name}} is complete, and your facility is ready to begin taking patients.
</p>
</td>
</tr>
<tr>
<td style="padding:22px 40px 4px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf3e1; border:1px solid #e3d9c0; border-radius:8px;">
<tr>
<td style="padding:18px 22px; font-family:Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183; width:140px;">Registered email</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{facility_email}}</td>
</tr>
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183;">Registration date</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{registration_date}}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:22px 40px 10px 40px; font-family:Helvetica, Arial, sans-serif;">
<p style="margin:0; font-size:14px; line-height:1.75; color:#4a4238;">
You now join a network of facilities carrying forward the classical tradition of Mizaj assessment and personalised Ilaj, supported by modern tools for consultations, prescriptions and patient records &mdash; all under one secure, OTP-protected account.
</p>
</td>
</tr>
<tr>
<td style="padding:14px 40px 30px 40px; text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr>
<td style="background-color:#c7963f; border-radius:6px;">
<a href="{{login_url}}" style="display:inline-block; padding:13px 34px; font-family:Helvetica, Arial, sans-serif; font-size:14.5px; font-weight:700; color:#fffdf8; text-decoration:none; letter-spacing:0.3px;">Enter Your Portal</a>
</td>
</tr>
</table>
</td>
</tr>`),
  },
  {
    key: "facility_profile_completed",
    name: "Facility Profile Completed",
    type: "Welcome",
    subject: "Your facility profile is complete — {{portal_name}}",
    body: emailShell(`<tr>
<td style="padding:22px 40px 6px 40px; text-align:center; font-family:Georgia, 'Times New Roman', serif;">
<div style="font-size:23px; color:#0f5c52; font-weight:700;">You're all set, {{facility_name}}</div>
<p style="margin:10px 0 0 0; font-size:14.5px; line-height:1.7; color:#6b6155; font-family:Helvetica, Arial, sans-serif;">
Your facility profile has been successfully completed on {{portal_name}}.
</p>
</td>
</tr>
<tr>
<td style="padding:22px 40px 4px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf3e1; border:1px solid #e3d9c0; border-radius:8px;">
<tr>
<td style="padding:18px 22px; font-family:Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183; width:140px;">Facility Type</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{facility_type}}</td>
</tr>
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183;">HFR Number</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{hfr_number}}</td>
</tr>
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183;">Address</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{address}}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:22px 40px 0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf3e1; border:1px dashed #c7963f; border-radius:8px;">
<tr>
<td style="padding:20px 22px; text-align:center; font-family:Helvetica, Arial, sans-serif;">
<div style="font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#c7963f; font-weight:700; margin-bottom:6px;">Current Plan</div>
<div style="font-size:22px; font-weight:700; color:#0f5c52;">FREE &mdash; {{trial_months}} Months</div>
<div style="font-size:13px; color:#6b6155; margin-top:10px;">Started {{start_date}} &middot; Valid until {{end_date}}</div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:18px 40px 10px 40px; font-family:Helvetica, Arial, sans-serif;">
<p style="margin:0; font-size:13.5px; line-height:1.75; color:#4a4238;">
You currently have full access to the free service package. After {{end_date}}, you can renew or upgrade to the paid plan at {{currency}} {{paid_price}} per month.
</p>
</td>
</tr>
<tr>
<td style="padding:14px 40px 30px 40px; text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr>
<td style="background-color:#c7963f; border-radius:6px;">
<a href="{{login_url}}" style="display:inline-block; padding:13px 34px; font-family:Helvetica, Arial, sans-serif; font-size:14.5px; font-weight:700; color:#fffdf8; text-decoration:none; letter-spacing:0.3px;">Go to Your Dashboard</a>
</td>
</tr>
</table>
</td>
</tr>`),
  },
  {
    key: "patient_otp_verification",
    name: "Patient OTP Verification",
    type: "OTP",
    subject: "Verify your email — {{portal_name}} OTP",
    body: emailShell(`<tr>
<td style="padding:20px 40px 8px 40px; font-family:Georgia, 'Times New Roman', serif;">
<p style="margin:0 0 18px 0; font-size:17px; color:#2b2420;">Dear {{patient_name}},</p>
<p style="margin:0 0 22px 0; font-size:15px; line-height:1.7; color:#4a4238; font-family:Helvetica, Arial, sans-serif;">
Please use the verification code below to confirm your email on <strong>{{portal_name}}</strong> &mdash; your home for consultations, Mizaj assessment and personalised Unani care.
</p>
</td>
</tr>
<tr>
<td style="padding:0 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf3e1; border:1px dashed #c7963f; border-radius:8px;">
<tr>
<td style="padding:22px 20px; text-align:center;">
<div style="font-family:'Courier New', monospace; font-size:34px; font-weight:700; letter-spacing:10px; color:#0f5c52;">{{otp}}</div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:18px 40px 4px 40px; font-family:Helvetica, Arial, sans-serif;">
<p style="margin:0 0 10px 0; font-size:13.5px; line-height:1.6; color:#6b6155;">
This code is valid for <strong>{{otp_validity}} minutes</strong> and can only be used once. Please do not share it with anyone &mdash; our team will never ask you for it.
</p>
<p style="margin:0; font-size:13.5px; line-height:1.6; color:#6b6155;">
If you did not request this code, you can safely ignore this email.
</p>
</td>
</tr>`),
  },
  {
    key: "patient_welcome",
    name: "Patient Registration Success / Welcome",
    type: "Welcome",
    subject: "Welcome to {{portal_name}}, {{patient_name}}!",
    body: emailShell(`<tr>
<td style="padding:22px 40px 6px 40px; text-align:center; font-family:Georgia, 'Times New Roman', serif;">
<div style="font-size:23px; color:#0f5c52; font-weight:700;">Welcome, {{patient_name}}</div>
<p style="margin:10px 0 0 0; font-size:14.5px; line-height:1.7; color:#6b6155; font-family:Helvetica, Arial, sans-serif;">
Your registration on {{portal_name}} is complete, and your care journey is ready to begin.
</p>
</td>
</tr>
<tr>
<td style="padding:22px 40px 4px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf3e1; border:1px solid #e3d9c0; border-radius:8px;">
<tr>
<td style="padding:18px 22px; font-family:Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183; width:140px;">Registered email</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{patient_email}}</td>
</tr>
<tr>
<td style="padding:5px 0; font-size:13px; color:#9a9183;">Registration date</td>
<td style="padding:5px 0; font-size:13.5px; color:#2b2420; font-weight:600;">{{registration_date}}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:22px 40px 10px 40px; font-family:Helvetica, Arial, sans-serif;">
<p style="margin:0; font-size:14px; line-height:1.75; color:#4a4238;">
You can now book consultations with verified Facilities, receive a personalised Mizaj assessment, and keep your prescriptions and records all in one secure, OTP-protected account.
</p>
</td>
</tr>
<tr>
<td style="padding:14px 40px 30px 40px; text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr>
<td style="background-color:#c7963f; border-radius:6px;">
<a href="{{login_url}}" style="display:inline-block; padding:13px 34px; font-family:Helvetica, Arial, sans-serif; font-size:14.5px; font-weight:700; color:#fffdf8; text-decoration:none; letter-spacing:0.3px;">Enter Your Portal</a>
</td>
</tr>
</table>
</td>
</tr>`),
  },
];

export const SAMPLE_VARS: Record<string, string> = {
  facility_name: "City Unani Clinic",
  facility_email: "contact@cityunani.example.com",
  patient_name: "Sarah Ahmed",
  patient_email: "sarah.ahmed@example.com",
  otp: "482913",
  otp_validity: "10",
  portal_name: "The Hekim's Connect",
  registration_date: new Date().toLocaleDateString(),
  login_url: "https://hekims.connect/login/facility",
  facility_type: "Clinic",
  hfr_number: "HFR-2026-00042",
  address: "123 Wellness Street, Bandra West, Mumbai, Maharashtra, 400050",
  trial_months: "3",
  start_date: new Date().toLocaleDateString(),
  end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString(),
  paid_price: "999",
  currency: "INR",
};
