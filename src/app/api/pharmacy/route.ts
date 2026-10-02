import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category");

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { category: { contains: search } },
      { description: { contains: search } },
    ];
  }
  if (category) where.category = category;

  const items = await db.pharmacyItem.findMany({
    where,
    orderBy: { name: "asc" },
  });

  const lowStock = items.filter((i) => i.quantity <= i.reorderLevel).length;
  const totalValue = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return NextResponse.json({ items, lowStock, totalValue });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const item = await db.pharmacyItem.create({
      data: {
        name: body.name,
        category: body.category || "General",
        form: body.form || "Powder",
        quantity: Number(body.quantity) || 0,
        unit: body.unit || "g",
        reorderLevel: Number(body.reorderLevel) || 10,
        price: Number(body.price) || 0,
        expiryDate: body.expiryDate || null,
        description: body.description || "",
        inStock: (Number(body.quantity) || 0) > 0,
      },
    });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("Pharmacy create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
