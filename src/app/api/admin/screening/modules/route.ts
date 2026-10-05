import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, triggerComplaintIds } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const baseKey = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseKey) {
    return NextResponse.json({ error: "Could not derive a key from this label" }, { status: 400 });
  }
  let key = baseKey;
  let suffix = 2;
  while (await db.screeningModule.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }

  const maxOrder = await db.screeningModule.aggregate({ _max: { sortOrder: true } });
  const ids: string[] = Array.isArray(triggerComplaintIds) ? triggerComplaintIds : [];
  const module_ = await db.screeningModule.create({
    data: {
      key, label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      triggers: { create: ids.map((chiefComplaintId: string) => ({ chiefComplaintId })) },
    },
  });
  return NextResponse.json({ module: module_ });
}
