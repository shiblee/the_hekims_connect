import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getScreeningConfig } from "@/lib/screening";
import { frequentComplaintIds, pendingComplaintRequests } from "@/lib/master-requests";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getScreeningConfig();
  if (auth.type !== "facility") return NextResponse.json(config);
  // This clinic's quick picks and its own complaints still waiting for review.
  const [frequent, pending] = await Promise.all([frequentComplaintIds(auth.id), pendingComplaintRequests(auth.id)]);
  return NextResponse.json({ ...config, frequent, pending });
}
