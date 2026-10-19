import { NextRequest, NextResponse } from "next/server";
import { netAmount, paymentState } from "@/lib/payments";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { STAGE_SELECT, visitStage } from "@/lib/visit-stage";

const PAGE = 25;
const DAY = 86400_000;

/**
 * Reception desk — one day at a time, in the clinic's local days (`tz` minutes east of UTC).
 *  tab=visits         every visit that day (a person can appear more than once)
 *  tab=registrations  people whose FIRST visit at this clinic was that day (each person once, ever)
 * Plus a 7-day strip of counts ending at `end` (default today). Filters: q, stage, staff, page.
 * Payment status only for people allowed to see payments.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fid = auth.id;
  const sp = req.nextUrl.searchParams;
  const tz = Math.max(-840, Math.min(840, Number(sp.get("tz")) || 0));
  const access = auth.staffId ? await loadStaffAccess(auth.staffId) : null;
  const canPay = !auth.staffId || !!access?.permissions.some((k) => k === "payments" || k === "finance.view");

  const startOf = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) - tz * 60_000;
  const ymdOf = (t: number) => new Date(t + tz * 60_000).toISOString().slice(0, 10);
  const todayYmd = ymdOf(Date.now());
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= todayYmd ? v : todayYmd);
  const date = valid(sp.get("date"));
  const end = valid(sp.get("end") ?? date);
  const tab = sp.get("tab") === "registrations" ? "registrations" : "visits";

  // First visit here for every patient — defines "new" and the Registrations tab.
  const firsts = await db.visit.groupBy({ by: ["patientId"], where: { facilityId: fid }, _min: { visitDate: true } });
  const firstAt = new Map(firsts.map((f) => [f.patientId, f._min.visitDate!.getTime()]));

  // 7-day strip ending at `end`.
  const stripFrom = startOf(end) - 6 * DAY, stripTo = startOf(end) + DAY;
  const stripVisits = await db.visit.findMany({ where: { facilityId: fid, visitDate: { gte: new Date(stripFrom), lt: new Date(stripTo) } }, select: { visitDate: true } });
  const strip = Array.from({ length: 7 }, (_, i) => {
    const from = stripFrom + i * DAY, to = from + DAY;
    return {
      date: ymdOf(from),
      visits: stripVisits.filter((v) => v.visitDate.getTime() >= from && v.visitDate.getTime() < to).length,
      registrations: firsts.filter((f) => { const t = f._min.visitDate!.getTime(); return t >= from && t < to; }).length,
    };
  });

  const from = startOf(date), to = from + DAY;
  const q = sp.get("q")?.trim();
  const where: Record<string, unknown> = { facilityId: fid, visitDate: { gte: new Date(from), lt: new Date(to) } };
  if (q) where.OR = [{ visitCode: { contains: q } }, { patient: { name: { contains: q } } }, { patient: { patientCode: { contains: q } } }, { patient: { phone: { contains: q } } }];
  if (sp.get("staff")) where.registeredById = sp.get("staff") === "owner" ? null : sp.get("staff");
  if (tab === "registrations") {
    const ids = firsts.filter((f) => { const t = f._min.visitDate!.getTime(); return t >= from && t < to; }).map((f) => f.patientId);
    where.patientId = { in: ids };
  }

  const rows = await db.visit.findMany({
    where, orderBy: { visitDate: "desc" },
    select: {
      id: true, visitCode: true, visitDate: true, patientId: true, ...STAGE_SELECT,
      patient: { select: { id: true, patientCode: true, name: true, gender: true, dob: true, phone: true, photo: true } },
      registeredBy: { select: { name: true } }, doctor: { select: { name: true } },
      payments: canPay ? { select: { id: true, paymentCode: true, amount: true, status: true, refundAmount: true } } : false,
    },
  });
  // Registrations: one row per person (their first visit that day).
  const seen = new Set<string>();
  let list = rows.filter((r) => {
    if (tab !== "registrations") return true;
    if (firstAt.get(r.patientId) !== r.visitDate.getTime() || seen.has(r.patientId)) return false;
    seen.add(r.patientId);
    return true;
  })
    .map((r) => ({
      visitId: r.id, visitCode: r.visitCode, at: r.visitDate.toISOString(),
      patient: r.patient,
      isNew: firstAt.get(r.patientId) === r.visitDate.getTime(),
      stage: visitStage(r),
      registeredBy: r.registeredBy?.name ?? "Clinic owner",
      doctor: r.doctor?.name ?? null,
      payment: canPay ? (() => {
        const paid = (r.payments as { id: string; paymentCode: string; amount: number; status: string; refundAmount: number | null }[]).filter((p) => paymentState(p.status) !== "cancelled");
        return { count: paid.length, amount: Math.round(paid.reduce((a, p) => a + netAmount(p), 0) * 100) / 100, lastId: paid.at(-1)?.id ?? null, lastCode: paid.at(-1)?.paymentCode ?? null };
      })() : null,
    }));
  const stage = sp.get("stage");
  if (stage) list = list.filter((r) => (stage === "progress" ? ["waiting", "vitals", "mizaj", "asbab", "handover"].includes(r.stage) : r.stage === stage));
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const staff = await db.staff.findMany({ where: { facilityId: fid }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({
    date, today: todayYmd, tab, strip, total: list.length, page, pageSize: PAGE,
    rows: list.slice((page - 1) * PAGE, page * PAGE),
    staff, payments: canPay,
  });
}
