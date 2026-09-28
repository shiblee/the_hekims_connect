import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);

  const translationKey = await db.translationKey.findUnique({
    where: { key },
    include: { values: true },
  });
  if (!translationKey) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  return NextResponse.json({ key: translationKey });
}
