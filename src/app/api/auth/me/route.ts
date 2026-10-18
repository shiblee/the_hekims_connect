import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, fetchFacility, fetchPatient, fetchStaff } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.staffId) {
    // Staff work inside their clinic's app — send the clinic too, and what they may do there.
    const [staff, facility, access] = await Promise.all([fetchStaff(auth.staffId), fetchFacility(auth.id), loadStaffAccess(auth.staffId)]);
    if (!staff || !facility || !access) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: staff, role: "staff", facility, permissions: access.permissions, staffRole: access.role });
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
