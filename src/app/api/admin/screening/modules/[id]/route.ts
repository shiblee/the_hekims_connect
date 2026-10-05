import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    if (!String(body.label).trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });
    data.label = String(body.label).trim();
  }
  if (body.active !== undefined) data.active = !!body.active;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10);

  // Trigger complaints are replaced wholesale when provided — simplest reliable
  // way to sync a many-to-many list from a form without diffing.
  if (Array.isArray(body.triggerComplaintIds)) {
    await db.screeningModuleComplaint.deleteMany({ where: { moduleId: id } });
    if (body.triggerComplaintIds.length) {
      await db.screeningModuleComplaint.createMany({
        data: body.triggerComplaintIds.map((chiefComplaintId: string) => ({ moduleId: id, chiefComplaintId })),
      });
    }
  }

  const module_ = await db.screeningModule.update({ where: { id }, data });
  return NextResponse.json({ module: module_ });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  await db.screeningModule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
