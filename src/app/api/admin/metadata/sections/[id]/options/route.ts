import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const section = await db.metadataSection.findUnique({ where: { id }, select: { key: true } });
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const [options, totalFacilities] = await Promise.all([
    db.metadataOption.findMany({ where: { sectionId: id }, orderBy: { sortOrder: "asc" } }),
    db.facility.count(),
  ]);

  const counted = await Promise.all(options.map(async (o) => {
    let count = 0;
    if (section.key === "facility_type") {
      count = await db.facility.count({ where: { facilityType: o.label } });
    } else if (section.key === "specialization") {
      count = await db.facility.count({ where: { specializations: { contains: `"${o.label}"` } } });
    } else if (section.key.startsWith("service_")) {
      count = await db.facility.count({ where: { services: { contains: `"${o.label}"` } } });
    }
    return { ...o, count };
  }));

  return NextResponse.json({ options: counted, totalFacilities });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { label } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const maxOrder = await db.metadataOption.aggregate({ where: { sectionId: id }, _max: { sortOrder: true } });
  const option = await db.metadataOption.create({
    data: { sectionId: id, label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ option });
}
