import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { nextPaymentCode } from "@/lib/codes";

// Cash/payments can be recorded by the facility owner account or by a logged-in
// staff member (e.g. a cashier/front-desk role) — either way we need to know
// which facility the visit belongs to, and attribute the payment to the staff
// member when it's a staff session, for reconciliation (who collected this cash).
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let facilityId: string;
  if (auth.type === "facility") {
    facilityId = auth.id;
  } else {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    facilityId = staff.facilityId;
  }

  const { visitId, amount, mode, status, amountReceived, referenceNumber } = await req.json();
  if (!visitId) {
    return NextResponse.json({ error: "visitId is required" }, { status: 400 });
  }
  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }
  if (!mode || !String(mode).trim()) {
    return NextResponse.json({ error: "Payment mode is required" }, { status: 400 });
  }

  const visit = await db.visit.findFirst({ where: { id: visitId, facilityId }, select: { id: true } });
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const paymentCode = await nextPaymentCode();
  const payment = await db.payment.create({
    data: {
      paymentCode,
      visitId,
      amount: parsedAmount,
      mode: String(mode).trim(),
      status: status || "paid",
      amountReceived: amountReceived !== undefined && amountReceived !== null && amountReceived !== ""
        ? parseFloat(amountReceived) || null
        : null,
      referenceNumber: referenceNumber || null,
      recordedById: auth.type === "staff" ? auth.id : null,
    },
  });

  return NextResponse.json({ payment });
}
