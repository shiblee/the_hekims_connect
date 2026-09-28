import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "hakim") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hakim = await db.hakim.findUnique({ where: { id: auth.id } });
  if (!hakim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user: hakim });
}

export async function PUT(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "hakim") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { name, phone, specialization, license, experience, bio, mizaj, avatarColor } = body;
    const updated = await db.hakim.update({
      where: { id: auth.id },
      data: {
        name, phone, specialization, license,
        experience: experience !== undefined ? parseInt(experience, 10) || 0 : undefined,
        bio, mizaj, avatarColor,
      },
      select: { id: true, name: true, email: true, phone: true, specialization: true, experience: true, mizaj: true, rating: true, license: true, avatarColor: true, bio: true, verified: true },
    });
    return NextResponse.json({ user: updated });
  } catch (e) {
    console.error("Hakim update error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
