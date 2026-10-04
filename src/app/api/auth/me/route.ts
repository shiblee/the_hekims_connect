import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, fetchFacility, fetchPatient, fetchStaff } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.type === "facility") {
    const facility = await fetchFacility(auth.id);
    if (!facility) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: facility, role: "facility" });
  } else if (auth.type === "staff") {
    const staff = await fetchStaff(auth.id);
    if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: staff, role: "staff" });
  } else {
    const patient = await fetchPatient(auth.id);
    if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: patient, role: "patient" });
  }
}
