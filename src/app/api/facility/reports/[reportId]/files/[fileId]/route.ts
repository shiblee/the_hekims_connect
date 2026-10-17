import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";

/** Streams one report file. Fetched with the auth header and shown via a blob URL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ reportId: string; fileId: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { reportId, fileId } = await params;
  const file = await db.patientReportFile.findFirst({
    where: { id: fileId, reportId, report: { facilityId: actor.facilityId } },
    select: { data: true, mimeType: true, fileName: true },
  });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
