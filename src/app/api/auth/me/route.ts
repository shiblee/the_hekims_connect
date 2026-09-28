import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, fetchHakim, fetchPatient } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.type === "hakim") {
    const hakim = await fetchHakim(auth.id);
    if (!hakim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: hakim, role: "hakim" });
  } else {
    const patient = await fetchPatient(auth.id);
    if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: patient, role: "patient" });
  }
}
