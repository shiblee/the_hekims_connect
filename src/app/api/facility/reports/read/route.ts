import { NextRequest, NextResponse } from "next/server";
import { getClinicActor } from "@/lib/reports-server";
import { readClinicalReport, GeminiQuotaError } from "@/lib/gemini";
import { REPORT_CATEGORIES, REPORT_FILE_TYPES, REPORT_MAX_FILE_BYTES, REPORT_MAX_FILES } from "@/lib/reports";

/**
 * Hakeem Insight reading of report files before they're saved — returns
 * suggested form fields and transcribed values. Nothing is stored here.
 */
export async function POST(req: NextRequest) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") || []).filter((f): f is File => typeof f !== "string");
  if (!files.length) return NextResponse.json({ error: "Attach the report first" }, { status: 400 });
  if (files.length > REPORT_MAX_FILES) return NextResponse.json({ error: `At most ${REPORT_MAX_FILES} files` }, { status: 400 });
  for (const f of files) {
    if (!REPORT_FILE_TYPES.includes(f.type) || f.size > REPORT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${f.name}: only JPG, PNG, WEBP or PDF up to 8 MB` }, { status: 400 });
    }
  }
  let reading;
  try {
    reading = await readClinicalReport(
      await Promise.all(files.map(async (f) => ({ mimeType: f.type, base64: Buffer.from(await f.arrayBuffer()).toString("base64") }))),
      REPORT_CATEGORIES.map((c) => c.value),
    );
  } catch (e) {
    if (e instanceof GeminiQuotaError) return NextResponse.json({ error: e.message }, { status: 503 });
    throw e;
  }
  if (!reading) return NextResponse.json({ error: "Hakeem Insight couldn't read this report — fill the details in by hand." }, { status: 502 });
  return NextResponse.json({ reading });
}
