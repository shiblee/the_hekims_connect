import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facility = await db.facility.findUnique({ where: { id: auth.id } });
  if (!facility) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user: facility });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { facilityName, phone, specialization, license, experience, bio, avatarColor } = body;
    const updated = await db.facility.update({
      where: { id: auth.id },
      data: {
        facilityName, phone, specialization, license,
        experience: experience !== undefined ? parseInt(experience, 10) || 0 : undefined,
        bio, avatarColor,
      },
      select: { id: true, facilityName: true, email: true, phone: true, specialization: true, experience: true, rating: true, license: true, avatarColor: true, bio: true, verified: true },
    });
    return NextResponse.json({ user: updated });
  } catch (e) {
    console.error("Facility update error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
