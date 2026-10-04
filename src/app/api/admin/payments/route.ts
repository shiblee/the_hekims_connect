import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// Cash/payment reconciliation view — defaults to today, filterable by facility,
// staff (who recorded it) and mode. Returns both the raw list and a summary
// block (total, breakdown by mode, breakdown by staff) for a cashier/front-desk
// reconciliation screen, not just a flat list.
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;
  const facilityId = searchParams.get("facilityId") || undefined;
  const staffId = searchParams.get("staffId") || undefined;
  const mode = searchParams.get("mode") || undefined;

  const where: any = {
    createdAt: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) },
  };
  if (mode) where.mode = mode;
  if (facilityId) where.visit = { facilityId };
  if (staffId) where.recordedById = staffId;

  const payments = await db.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, paymentCode: true, amount: true, mode: true, status: true, createdAt: true,
      visit: {
        select: {
          id: true, visitCode: true,
          facility: { select: { id: true, facilityName: true } },
          patient: { select: { id: true, name: true } },
        },
      },
      recordedBy: { select: { id: true, name: true, staffCode: true } },
    },
  });

  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const byMode: Record<string, { total: number; count: number }> = {};
  const byStaffMap = new Map<string, { staffId: string | null; staffName: string; total: number; count: number }>();

  for (const p of payments) {
    const modeEntry = byMode[p.mode] || { total: 0, count: 0 };
    modeEntry.total += p.amount;
    modeEntry.count += 1;
    byMode[p.mode] = modeEntry;

    const key = p.recordedBy?.id || "unattributed";
    const staffEntry = byStaffMap.get(key) || { staffId: p.recordedBy?.id ?? null, staffName: p.recordedBy?.name || "Unattributed", total: 0, count: 0 };
    staffEntry.total += p.amount;
    staffEntry.count += 1;
    byStaffMap.set(key, staffEntry);
  }

  return NextResponse.json({
    payments,
    summary: {
      total,
      count: payments.length,
      byMode,
      byStaff: Array.from(byStaffMap.values()).sort((a, b) => b.total - a.total),
    },
  });
}
