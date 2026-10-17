import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getHumorConfig } from "@/lib/humor-config";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [humorConfig, complaints] = await Promise.all([
    getHumorConfig(),
    db.chiefComplaint.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, label: true, category: true, active: true },
    }),
  ]);

  return NextResponse.json({ ...humorConfig, complaints });
}
