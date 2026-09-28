import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-crypto";

interface SendResult {
  ok: boolean;
  /** Present only when ok is false, or when ok is true but no config is active (nothing was actually sent). */
  reason?: string;
}

/**
 * Sends a real email via the SMTP settings stored in EmailConfig, if configured
 * and enabled. Returns { ok: false, reason: "not_configured" } rather than
 * throwing when there's nothing to send with, so callers can fall back to
 * simulated/logged-only behavior.
 */
export async function sendRealEmail(opts: { to: string; subject: string; text: string }): Promise<SendResult> {
  const config = await db.emailConfig.findFirst();
  if (!config || !config.active || !config.smtpHost || !config.smtpPort || !config.fromEmail) {
    return { ok: false, reason: "not_configured" };
  }

  const password = config.secretEnc ? decryptSecret(config.secretEnc) : null;

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.encryption === "ssl",
      requireTLS: config.encryption === "tls",
      auth: config.username ? { user: config.username, pass: password ?? undefined } : undefined,
    });

    await transporter.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
      to: opts.to,
      replyTo: config.replyTo || undefined,
      subject: opts.subject,
      text: opts.text,
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "SMTP send failed" };
  }
}
