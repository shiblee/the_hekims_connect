import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getVitalsRangeConfig } from "@/lib/vitals-ranges-server";

// Readable by facility/staff (the capture form) and by admin (the
// admin-side vitals panel, which reuses the same component/validation).
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  const isFacilityOrStaff = !!auth && (auth.type === "facility" || auth.type === "staff");
  if (!isFacilityOrStaff && !(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getVitalsRangeConfig());
}
