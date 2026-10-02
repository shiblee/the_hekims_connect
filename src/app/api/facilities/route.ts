import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public: list all verified facilities for patient booking
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const facilities = await db.facility.findMany({
    where: {
      verified: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { specialization: { contains: search } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      specialization: true,
      experience: true,
      rating: true,
      avatarColor: true,
      bio: true,
    },
    orderBy: { rating: "desc" },
  });

  return NextResponse.json({ facilities });
}
