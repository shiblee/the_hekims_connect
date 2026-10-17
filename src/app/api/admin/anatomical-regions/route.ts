import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ANATOMICAL_REGION_ICONS } from "@/lib/anatomical-region-icons";
import { BODY_ZONES } from "@/lib/body-zones";

const GENDERS = new Set(["all", "male", "female"]);

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const regions = await db.anatomicalRegionTag.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ regions });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, localTerms, icon, gender, bodyZone } = await req.json();
  if (!label || !String(label).trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  const existing = await db.anatomicalRegionTag.findUnique({ where: { label: String(label).trim() } });
  if (existing) return NextResponse.json({ error: "This region already exists" }, { status: 409 });

  const maxOrder = await db.anatomicalRegionTag.aggregate({ _max: { sortOrder: true } });
  const region = await db.anatomicalRegionTag.create({
    data: {
      label: String(label).trim(),
      localTerms: localTerms ? String(localTerms).trim() : null,
      icon: icon && ANATOMICAL_REGION_ICONS[icon] ? icon : "activity",
      gender: GENDERS.has(gender) ? gender : "all",
      bodyZone: bodyZone && BODY_ZONES[bodyZone] ? bodyZone : null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ region });
}
