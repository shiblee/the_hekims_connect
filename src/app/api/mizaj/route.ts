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
  if (patientId) where.patientId = patientId;
  if (auth.type === "facility") where.facilityId = auth.id;
  if (auth.type === "patient") where.patientId = auth.id;

  const assessments = await db.mizajAssessment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      facility: { select: { id: true, facilityName: true, specialization: true, avatarColor: true } },
      patient: { select: { id: true, name: true, avatarColor: true, mizaj: true } },
    },
  });

  return NextResponse.json({ assessments });
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Only Facilities can create Mizaj assessments" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { patientId, dam, saffra, balgham, sauda, pulse, notes } = body;
    if (!patientId) {
      return NextResponse.json({ error: "Patient is required" }, { status: 400 });
    }

    const d = Number(dam) || 0;
    const s = Number(saffra) || 0;
    const b = Number(balgham) || 0;
    const su = Number(sauda) || 0;
    const max = Math.max(d, s, b, su);
    let dominant = "Balanced";
    if (max === d) dominant = "Damwi (Blood)";
    if (max === s) dominant = "Safrawi (Yellow Bile)";
    if (max === b) dominant = "Balghami (Phlegm)";
    if (max === su) dominant = "Saudawi (Black Bile)";
    if (d === s && s === b && b === su) dominant = "Balanced (Mizaj-e-Mutadil)";

    const result = `${dominant} — Dam ${d}%, Safra ${s}%, Balgham ${b}%, Sauda ${su}%`;

    const assessment = await db.mizajAssessment.create({
      data: {
        patientId,
        facilityId: auth.id,
        dam: d,
        saffra: s,
        balgham: b,
        sauda: su,
        result,
        pulse: pulse || null,
        notes: notes || null,
      },
    });

    // Update patient's mizaj summary
    await db.patient.update({
      where: { id: patientId },
      data: { mizaj: dominant.split(" (")[0] },
    });

    return NextResponse.json({ assessment });
  } catch (e) {
    console.error("Mizaj create error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
