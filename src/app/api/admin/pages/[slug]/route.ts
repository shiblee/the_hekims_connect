import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slug } = await params;
  const page = await db.page.findUnique({
    where: { slug },
    include: { contents: true },
  });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  return NextResponse.json({ page });
}
