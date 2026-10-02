import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { renderTemplate, renderHtmlTemplate, SAMPLE_VARS } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key } = await params;
  const body = await req.json().catch(() => ({}));
  // Preview the currently-typed (possibly unsaved) subject/body if provided,
  // otherwise fall back to the saved template.
  let subject = body.subject as string | undefined;
  let content = body.body as string | undefined;

  if (subject === undefined || content === undefined) {
    const template = await db.emailTemplate.findUnique({ where: { key } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    subject = subject ?? template.subject;
    content = content ?? template.body;
  }

  return NextResponse.json({
    subject: renderTemplate(subject, SAMPLE_VARS),
    body: renderHtmlTemplate(content, SAMPLE_VARS),
    sampleVars: SAMPLE_VARS,
  });
}
