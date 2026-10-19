// Shared payment rules. A payment is never deleted: it is "paid", "cancelled" (whole amount void),
// "refunded" or "partially_refunded" (money returned, recorded separately). Older rows say "Paid".

export type PaymentState = "paid" | "cancelled" | "refunded" | "partially_refunded";

export function paymentState(status: string | null | undefined): PaymentState {
  const s = (status || "paid").toLowerCase();
  return s === "cancelled" || s === "refunded" || s === "partially_refunded" ? s : "paid";
}

/** What the clinic actually keeps from this payment. */
export function netAmount(p: { amount: number; status: string | null; refundAmount?: number | null }): number {
  if (paymentState(p.status) === "cancelled") return 0;
  return Math.round((p.amount - (p.refundAmount ?? 0)) * 100) / 100;
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  paid: "Paid", cancelled: "Cancelled", refunded: "Refunded", partially_refunded: "Part refunded",
};
