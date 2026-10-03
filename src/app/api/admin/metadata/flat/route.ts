import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sectionRows = await db.metadataSection.findMany({
    orderBy: { sortOrder: "asc" },
    include: { options: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });

  const sections: Record<string, { label: string; options: string[] }> = {};
  for (const s of sectionRows) {
    sections[s.key] = { label: s.label, options: s.options.map((o) => o.label) };
  }

  return NextResponse.json({ sections });
}
