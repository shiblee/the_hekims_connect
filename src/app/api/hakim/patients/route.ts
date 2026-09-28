import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "hakim") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const patients = await db.patient.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      dob: true,
      gender: true,
      bloodGroup: true,
      mizaj: true,
      avatarColor: true,
      chronicConditions: true,
      address: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Attach appointment counts per patient for this hakim
  const withCounts = await Promise.all(
    patients.map(async (p) => {
      const count = await db.appointment.count({
        where: { hakimId: auth.id, patientId: p.id },
      });
      const lastVisit = await db.appointment.findFirst({
        where: { hakimId: auth.id, patientId: p.id, status: "completed" },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      return { ...p, appointmentCount: count, lastVisit: lastVisit?.date || null };
    })
  );

  return NextResponse.json({ patients: withCounts });
}
