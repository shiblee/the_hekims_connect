import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const verified = searchParams.get("verified");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
  const sort = searchParams.get("sort") || "createdAt_desc";

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  if (status === "active") where.active = true;
  if (status === "inactive") where.active = false;
  if (verified === "true") where.verified = true;
  if (verified === "false") where.verified = false;

  const [field, dir] = sort.split("_");
  const orderBy = { [field]: dir === "asc" ? "asc" : "desc" };

  const [total, patients] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, phone: true, gender: true, dob: true,
        bloodGroup: true, mizaj: true, avatarColor: true,
        verified: true, active: true, lastLoginAt: true, createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ patients, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
