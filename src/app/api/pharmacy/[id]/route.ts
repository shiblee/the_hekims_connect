import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.category !== undefined) data.category = body.category;
    if (body.form !== undefined) data.form = body.form;
    if (body.quantity !== undefined) {
      data.quantity = Number(body.quantity) || 0;
      data.inStock = data.quantity > 0;
    }
    if (body.unit !== undefined) data.unit = body.unit;
    if (body.reorderLevel !== undefined) data.reorderLevel = Number(body.reorderLevel) || 0;
    if (body.price !== undefined) data.price = Number(body.price) || 0;
    if (body.expiryDate !== undefined) data.expiryDate = body.expiryDate;
    if (body.description !== undefined) data.description = body.description;

    const item = await db.pharmacyItem.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("Pharmacy update error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.pharmacyItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
