import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");

  const where: any = {};
  if (auth.type === "facility") where.facilityId = auth.id;
  if (auth.type === "patient") where.patientId = auth.id;
  if (patientId) where.patientId = patientId;

  const prescriptions = await db.prescription.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      facility: { select: { id: true, facilityName: true, avatarColor: true } },
      patient: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  const withItems = prescriptions.map((p) => ({
    ...p,
    items: JSON.parse(p.items || "[]"),
  }));

  return NextResponse.json({ prescriptions: withItems });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Only Facilities can create prescriptions" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { patientId, items, notes, therapyType, appointmentId } = body;
    if (!patientId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Patient and items are required" }, { status: 400 });
    }
    const prescription = await db.prescription.create({
      data: {
        patientId,
        facilityId: auth.id,
        appointmentId: appointmentId || null,
        items: JSON.stringify(items),
        notes: notes || "",
        therapyType: therapyType || "Ilaj-bil-Dawa",
      },
    });
    return NextResponse.json({ prescription });
  } catch (e) {
    console.error("Prescription create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
