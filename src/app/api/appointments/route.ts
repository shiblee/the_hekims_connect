import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const where: any = {};
  if (auth.type === "hakim") where.hakimId = auth.id;
  else where.patientId = auth.id;
  if (status) where.status = status;
  if (date) where.date = date;

  const appointments = await db.appointment.findMany({
    where,
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: {
      hakim: {
        select: { id: true, name: true, specialization: true, avatarColor: true, mizaj: true },
      },
      patient: {
        select: { id: true, name: true, phone: true, avatarColor: true, mizaj: true, bloodGroup: true, gender: true, dob: true },
      },
    },
  });

  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { hakimId, patientId, date, time, type, reason } = body;

    if (!date || !time) {
      return NextResponse.json({ error: "Date and time are required" }, { status: 400 });
    }

    let finalHakimId = hakimId;
    let finalPatientId = patientId;

    if (auth.type === "patient") {
      finalPatientId = auth.id;
      if (!finalHakimId) {
        return NextResponse.json({ error: "Please select a Hekim" }, { status: 400 });
      }
    } else {
      finalHakimId = auth.id;
      if (!finalPatientId) {
        return NextResponse.json({ error: "Please select a patient" }, { status: 400 });
      }
    }

    const appointment = await db.appointment.create({
      data: {
        hakimId: finalHakimId,
        patientId: finalPatientId,
        date,
        time,
        type: type || "Consultation",
        reason: reason || "",
        status: "scheduled",
      },
      include: {
        hakim: { select: { id: true, name: true, specialization: true, avatarColor: true } },
        patient: { select: { id: true, name: true, phone: true, avatarColor: true } },
      },
    });

    return NextResponse.json({ appointment });
  } catch (e) {
    console.error("Appointment create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
