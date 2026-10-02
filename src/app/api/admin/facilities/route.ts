import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status"); // "active" | "inactive"
  const verified = searchParams.get("verified"); // "true" | "false"
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
  const sort = searchParams.get("sort") || "createdAt_desc";

  const where: any = {};
  if (q) {
    where.OR = [
      { facilityName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { specialization: { contains: q } },
    ];
  }
  if (status === "active") where.active = true;
  if (status === "inactive") where.active = false;
  if (verified === "true") where.verified = true;
  if (verified === "false") where.verified = false;

  const [field, dir] = sort.split("_");
  const orderBy = { [field]: dir === "asc" ? "asc" : "desc" };

  const [total, facilities] = await Promise.all([
    db.facility.count({ where }),
    db.facility.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, facilityName: true, email: true, phone: true, specialization: true,
        experience: true, rating: true, avatarColor: true,
        verified: true, active: true, lastLoginAt: true, createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ facilities, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
