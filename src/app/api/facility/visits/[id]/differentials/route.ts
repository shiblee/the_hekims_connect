import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { buildCaseContext } from "@/lib/case-context";
import { computeDifferentials } from "@/lib/differential-engine";
import { loadCatalogue, loadDalailQuestions } from "@/lib/amraz";
import { runTashkheesEngine } from "@/lib/tashkhees-engine";

const parse = <T,>(raw: string | null | undefined, fb: T): T => { try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; } };

/** Differential diagnosis for the visit from the Amraz catalogue — rules only, with the evidence behind each. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ctx = await buildCaseContext(id, actor.facilityId);
  if (!ctx) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const [catalogue, bank, dossier] = await Promise.all([
    loadCatalogue(), loadDalailQuestions(),
    db.tashkheesDossier.findUnique({ where: { visitId: id }, select: { suMizajQuality: true, organs: true } }),
  ]);
  // Fit against the Hakim's own Su-e-Mizaj and organs when recorded, else the Tashkhees engine's.
  let basis: { suMizaj: string | null; organs: string[]; from: "hakim" | "engine" | "none" } = { suMizaj: null, organs: [], from: "none" };
  const organs = parse<string[]>(dossier?.organs, []);
  if (dossier?.suMizajQuality || organs.length) basis = { suMizaj: dossier?.suMizajQuality ?? null, organs, from: "hakim" };
  else {
    const eng = await runTashkheesEngine(id, actor.facilityId).catch(() => null);
    if (eng) basis = { suMizaj: eng.suggestion.suMizaj?.label ?? null, organs: eng.suggestion.organs.map((o) => o.label), from: "engine" };
  }
  const result = computeDifferentials(ctx, catalogue, basis, bank);
  return NextResponse.json({ ...result, catalogueSize: catalogue.length });
}
