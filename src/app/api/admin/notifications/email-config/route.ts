import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { encryptSecret } from "@/lib/secret-crypto";

async function getConfig() {
  const existing = await db.emailConfig.findFirst();
  if (existing) return existing;
  return db.emailConfig.create({ data: {} });
}

function serialize(config: Awaited<ReturnType<typeof getConfig>>) {
  const { secretEnc, ...rest } = config;
  return { ...rest, hasSecret: !!secretEnc };
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const config = await getConfig();
  return NextResponse.json({ config: serialize(config) });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { provider, smtpHost, smtpPort, encryption, username, secret, fromEmail, fromName, replyTo, active } = body;

  if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    return NextResponse.json({ error: "Enter a valid \"from\" email address" }, { status: 400 });
  }

  const existing = await getConfig();
  const data: any = {
    provider: provider ?? existing.provider,
    smtpHost: smtpHost ?? existing.smtpHost,
    smtpPort: smtpPort !== undefined ? (smtpPort === "" ? null : parseInt(smtpPort, 10)) : existing.smtpPort,
    encryption: encryption ?? existing.encryption,
    username: username ?? existing.username,
    fromEmail: fromEmail ?? existing.fromEmail,
    fromName: fromName ?? existing.fromName,
    replyTo: replyTo ?? existing.replyTo,
    active: typeof active === "boolean" ? active : existing.active,
    updatedBy: session.admin.id,
  };
  if (secret) {
    data.secretEnc = encryptSecret(secret);
  }

  const updated = await db.emailConfig.update({ where: { id: existing.id }, data });

  await logAdminActivity(session.admin.id, "email_config_updated", `Email configuration updated (${data.provider})`, getClientIp(req));

  return NextResponse.json({ config: serialize(updated) });
}
