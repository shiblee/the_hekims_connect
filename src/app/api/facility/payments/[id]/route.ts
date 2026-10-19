import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { netAmount, paymentState } from "@/lib/payments";
import { getReportBranding } from "@/lib/report-branding";

async function load(id: string, facilityId: string) {
  return db.payment.findFirst({
    where: { id, visit: { facilityId } },
    include: {
      recordedBy: { select: { name: true, staffCode: true } },
      visit: {
        select: {
          visitCode: true, visitDate: true,
          patient: { select: { name: true, patientCode: true, phone: true, gender: true } },
          facility: { select: { facilityName: true, registeredFacilityName: true, addressLine1: true, addressLine2: true, locality: true, city: true, state: true, pincode: true, phone: true, email: true, hfrNumber: true } },
        },
      },
    },
  });
}

/** One payment with everything a receipt needs. Yours, or any with "Clinic finances". */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await load(id, auth.id);
  if (!p) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (auth.staffId && p.recordedById !== auth.staffId) {
    const access = await loadStaffAccess(auth.staffId);
    if (!access?.permissions.includes("finance.view")) return NextResponse.json({ error: "You can only open receipts you collected." }, { status: 403 });
  }
  const names = await db.staff.findMany({ where: { id: { in: [p.cancelledById, p.refundedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = (sid: string | null, at: Date | null) => (at ? names.find((n) => n.id === sid)?.name ?? "Clinic owner" : null);
  const { idempotencyKey: _k, ...rest } = p;
  return NextResponse.json({
    branding: await getReportBranding(),
    payment: { ...rest, state: paymentState(p.status), net: netAmount(p), collectedBy: p.recordedBy ? `${p.recordedBy.name} (${p.recordedBy.staffCode})` : "Clinic owner", cancelledBy: nameOf(p.cancelledById, p.cancelledAt), refundedBy: nameOf(p.refundedById, p.refundedAt) },
  });
}

/**
 * Body { action: "cancel", reason } — the whole payment is void (e.g. recorded by mistake);
 * or { action: "refund", amount, reason } — money returned, full or part. Never deletes; needs "Cancel / refund payments".
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await load(id, auth.id);
  if (!p) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const reason = String(b.reason || "").trim();
  if (reason.length < 3) return NextResponse.json({ error: "Give a reason (at least a few words)" }, { status: 400 });
  const state = paymentState(p.status);
  const label = `${p.paymentCode} · ${p.visit.patient.name}`;

  if (b.action === "cancel") {
    if (state !== "paid") return NextResponse.json({ error: `This payment is already ${state.replace("_", " ")}` }, { status: 409 });
    await db.payment.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date(), cancelledById: auth.staffId ?? null, cancelReason: reason.slice(0, 300) } });
    await logClinicEvent(req, auth, { action: "payment.cancelled", summary: `Cancelled receipt ${p.paymentCode} (₹${p.amount}) — ${reason}`, entityType: "payment", entityId: id, entityLabel: label, details: { amount: p.amount } });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "refund") {
    if (state === "cancelled" || state === "refunded") return NextResponse.json({ error: `This payment is already ${state}` }, { status: 409 });
    const already = p.refundAmount ?? 0;
    const amount = Math.round(parseFloat(b.amount) * 100) / 100;
    const left = Math.round((p.amount - already) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > left) return NextResponse.json({ error: `Refund between ₹0.01 and ₹${left}` }, { status: 400 });
    const total = Math.round((already + amount) * 100) / 100;
    await db.payment.update({ where: { id }, data: { refundAmount: total, refundedAt: new Date(), refundedById: auth.staffId ?? null, refundReason: reason.slice(0, 300), status: total >= p.amount ? "refunded" : "partially_refunded" } });
    await logClinicEvent(req, auth, { action: "payment.refunded", summary: `Refunded ₹${amount} of receipt ${p.paymentCode} (₹${p.amount}${already ? `, ₹${already} refunded before` : ""}) — ${reason}`, entityType: "payment", entityId: id, entityLabel: label, details: { amount, total } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
