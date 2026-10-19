import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { netAmount, paymentState } from "@/lib/payments";

/** Same numbering as src/lib/codes.ts, but inside the payment's transaction (SQLite would otherwise wait on itself). */
async function nextPaymentCode(tx: Pick<typeof db, "payment">) {
  for (let i = 0; i < 5; i++) {
    const code = `PAY${(await tx.payment.count()) + 1 + i}`;
    if (!(await tx.payment.findUnique({ where: { paymentCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not generate a unique payment code");
}

async function who(auth: { staffId?: string }) {
  const access = auth.staffId ? await loadStaffAccess(auth.staffId) : null;
  const has = (k: string) => !auth.staffId || !!access?.permissions.includes(k as never);
  return { has };
}

const PAGE = 50;

/**
 * Payments list. With "Clinic finances" (or as the owner) you see every payment, otherwise only
 * the ones you collected. Query: from, to (ISO instants), scope=mine|all, status, q, page.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { has } = await who(auth);
  const sp = req.nextUrl.searchParams;
  const all = has("finance.view") && sp.get("scope") !== "mine";
  const where: Record<string, unknown> = { visit: { facilityId: auth.id } };
  if (!all) where.recordedById = auth.staffId ?? null;
  const valid = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
  const fromAt = valid(sp.get("from")), toAt = valid(sp.get("to"));
  if (fromAt || toAt) where.createdAt = { ...(fromAt ? { gte: fromAt } : {}), ...(toAt ? { lte: toAt } : {}) };
  const status = sp.get("status");
  if (status === "paid") where.status = { in: ["paid", "Paid"] };
  else if (status) where.status = status;
  const q = sp.get("q")?.trim();
  if (q) where.OR = [{ paymentCode: { contains: q } }, { referenceNumber: { contains: q } }, { visit: { visitCode: { contains: q } } }, { visit: { patient: { name: { contains: q } } } }, { visit: { patient: { patientCode: { contains: q } } } }];
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const [rows, total, sums] = await Promise.all([
    db.payment.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      select: {
        id: true, paymentCode: true, amount: true, mode: true, status: true, referenceNumber: true, createdAt: true,
        feeName: true, standardAmount: true, overrideReason: true, refundAmount: true, cancelReason: true, refundReason: true,
        recordedBy: { select: { name: true } },
        visit: { select: { id: true, visitCode: true, patient: { select: { id: true, name: true, patientCode: true } } } },
      },
    }),
    db.payment.count({ where }),
    db.payment.findMany({ where, select: { amount: true, status: true, refundAmount: true } }),
  ]);
  return NextResponse.json({
    scope: all ? "all" : "mine", canSeeAll: has("finance.view"), canRefund: has("payments.refund"),
    total, page, pageSize: PAGE,
    totals: { net: Math.round(sums.reduce((a, p) => a + netAmount(p), 0) * 100) / 100, count: sums.filter((p) => paymentState(p.status) !== "cancelled").length },
    payments: rows.map((r) => ({ ...r, state: paymentState(r.status), net: netAmount(r), collectedBy: r.recordedBy?.name ?? "Clinic owner" })),
  });
}

/**
 * Record a payment for a visit. Body: { visitId, feeId?, amount, mode, referenceNumber?, overrideReason?, idempotencyKey }.
 * The same idempotencyKey always returns the first payment — a double click can't charge twice.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { has } = await who(auth);
  if (!has("payments")) return NextResponse.json({ error: "You don't have permission to collect payments." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const key = typeof b.idempotencyKey === "string" && b.idempotencyKey.length >= 8 ? b.idempotencyKey.slice(0, 80) : null;
  if (key) {
    const dup = await db.payment.findFirst({ where: { idempotencyKey: key, visit: { facilityId: auth.id } } });
    if (dup) return NextResponse.json({ payment: dup, duplicate: true });
  }
  if (!b.visitId) return NextResponse.json({ error: "visitId is required" }, { status: 400 });
  const amount = Math.round(parseFloat(b.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Enter an amount above zero" }, { status: 400 });
  if (amount > 1_000_000) return NextResponse.json({ error: "That amount looks too large — check it" }, { status: 400 });
  const mode = String(b.mode || "").trim();
  if (!mode) return NextResponse.json({ error: "Payment mode is required" }, { status: 400 });

  const visit = await db.visit.findFirst({ where: { id: b.visitId, facilityId: auth.id }, select: { id: true, visitCode: true, patient: { select: { name: true, patientCode: true } } } });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  let fee: { id: string; name: string; amount: number } | null = null;
  if (b.feeId) {
    fee = await db.facilityFee.findFirst({ where: { id: b.feeId, facilityId: auth.id, active: true }, select: { id: true, name: true, amount: true } });
    if (!fee) return NextResponse.json({ error: "That fee is not on this clinic's fee list" }, { status: 400 });
  }
  const overrideReason = String(b.overrideReason || "").trim();
  if (fee && amount !== fee.amount && overrideReason.length < 3) {
    return NextResponse.json({ error: `The fee is ₹${fee.amount}. Give a reason for charging ₹${amount}.` }, { status: 400 });
  }

  // Serialised with the duplicate check, so two simultaneous clicks can't both create a payment.
  const result = await db.$transaction(async (tx) => {
    if (key) {
      const dup = await tx.payment.findFirst({ where: { idempotencyKey: key } });
      if (dup) return { payment: dup, duplicate: true };
    }
    const payment = await tx.payment.create({
      data: {
        paymentCode: await nextPaymentCode(tx), visitId: visit.id, amount, mode, status: "paid",
        amountReceived: amount, referenceNumber: b.referenceNumber ? String(b.referenceNumber).trim().slice(0, 80) : null,
        recordedById: auth.staffId ?? null, idempotencyKey: key,
        feeId: fee?.id ?? null, feeName: fee?.name ?? (b.feeName ? String(b.feeName).slice(0, 80) : null), standardAmount: fee?.amount ?? null,
        overrideReason: fee && amount !== fee.amount ? overrideReason.slice(0, 300) : null,
      },
    });
    return { payment, duplicate: false };
  });
  if (!result.duplicate) {
    const p = result.payment;
    await logClinicEvent(req, auth, {
      action: "payment.recorded",
      summary: `Receipt ${p.paymentCode}: ₹${amount} by ${mode}${p.feeName ? ` — ${p.feeName}` : ""}${p.overrideReason ? ` (fee ₹${p.standardAmount}, reason: ${p.overrideReason})` : ""} for ${visit.patient.patientCode ?? ""} · ${visit.patient.name} (${visit.visitCode})`,
      entityType: "payment", entityId: p.id, entityLabel: `${p.paymentCode} · ${visit.patient.name}`, details: { amount, mode, fee: p.feeName, override: !!p.overrideReason },
    });
  }
  return NextResponse.json(result);
}
