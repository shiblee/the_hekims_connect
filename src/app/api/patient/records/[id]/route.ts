import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "patient") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const record = await db.record.findUnique({ where: { id } });
  if (!record || record.patientId !== auth.id) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  await db.record.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
