import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; lang: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slug, lang } = await params;
  const page = await db.page.findUnique({ where: { slug } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const body = await req.json();
  const { title, subtitle, body: content, status } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "Body content is required" }, { status: 400 });
  if (status && !["draft", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const value = await db.pageContent.upsert({
    where: { pageId_languageCode: { pageId: page.id, languageCode: lang } },
    update: { title, subtitle: subtitle || null, body: content, status: status ?? "draft", updatedBy: session.admin.id },
    create: {
      pageId: page.id,
      languageCode: lang,
      title,
      subtitle: subtitle || null,
      body: content,
      status: status ?? "draft",
      updatedBy: session.admin.id,
    },
  });

  await logAdminActivity(
    session.admin.id,
    "page_content_updated",
    `"${page.title}" (${lang}) ${status === "published" ? "published" : "saved as draft"}`,
    getClientIp(req)
  );

  return NextResponse.json({ content: value });
}
