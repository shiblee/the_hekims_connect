"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useValueLabel } from "@/lib/i18n/use-date-locale";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Receipt } from "lucide-react";
import { sortLabels } from "@/lib/sort-options";

export interface Fee { id: string; name: string; amount: number; kind: string; active: boolean }
const DEFAULT_MODES = ["Cash", "UPI", "Card", "Bank transfer"];

/** The clinic's active fees and payment modes (Admin → Meta → Payment Mode). */
export function useFeesAndModes() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [modes, setModes] = useState<string[]>(DEFAULT_MODES);
  useEffect(() => {
    api.get<{ fees: Fee[] }>("/api/facility/fees").then((r) => setFees(r.fees)).catch(() => {});
    api.get<{ sections: Record<string, { options: string[] }> }>("/api/facility/metadata").then((r) => { if (r.sections.payment_mode?.options.length) setModes(r.sections.payment_mode.options); }).catch(() => {});
  }, []);
  return { fees, modes };
}

/** A fresh one-time key per payment form, so a repeated submit can't charge twice. */
export const newPaymentKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Fee picker + amount (+ reason when the amount differs from the fee). Used in the dialog and the registration form. */
export function FeeAmountFields({ fees, feeId, setFeeId, amount, setAmount, reason, setReason }: {
  fees: Fee[]; feeId: string; setFeeId: (v: string) => void; amount: string; setAmount: (v: string) => void; reason: string; setReason: (v: string) => void;
}) {
  const fee = fees.find((f) => f.id === feeId);
  const t = useTranslations("clinic.payments");
  const differs = !!fee && amount !== "" && Number(amount) !== fee.amount;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fees.length > 0 ? (
          <FloatingSelect id="payFee" label={t("fee")} value={feeId || "custom"} onValueChange={(v) => { setFeeId(v === "custom" ? "" : v); const f = fees.find((x) => x.id === v); if (f) setAmount(String(f.amount)); }} placeholder={t("select_fee")}>
            {fees.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} — ₹{f.amount.toLocaleString("en-IN")}</SelectItem>)}
            <SelectItem value="custom">{t("other_amount")}</SelectItem>
          </FloatingSelect>
        ) : (
          <p className="self-center text-xs text-muted-foreground">{t("no_fees")}</p>
        )}
        <FloatingField id="payAmount" type="number" inputMode="decimal" min={0} label={t("amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {differs && (
        <div>
          <FloatingField id="payReason" label={t("reason_for", { amount, fee: fee!.amount })} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> {t("differs_hint")}</p>
        </div>
      )}
    </div>
  );
}

/** Record a payment for one visit; on success hands back the receipt. */
export function PaymentDialog(props: {
  open: boolean; onOpenChange: (o: boolean) => void; visitId: string; patientLabel: string;
  onRecorded: (p: { id: string; paymentCode: string; amount: number }) => void;
}) {
  const t = useTranslations("clinic.payments");
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("record_title")}</DialogTitle></DialogHeader>
        {/* Mounted only while open, so every opening starts a fresh form with a fresh one-time key. */}
        {props.open && <PaymentForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ onOpenChange, visitId, patientLabel, onRecorded }: {
  onOpenChange: (o: boolean) => void; visitId: string; patientLabel: string;
  onRecorded: (p: { id: string; paymentCode: string; amount: number }) => void;
}) {
  const { fees, modes } = useFeesAndModes();
  const [picked, setPicked] = useState<{ feeId: string; amount: string } | null>(null);
  // Until the user chooses, the first fee on the list is the default.
  const feeId = picked ? picked.feeId : fees[0]?.id ?? "";
  const amount = picked ? picked.amount : fees[0] ? String(fees[0].amount) : "";
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState(""); const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [key] = useState(newPaymentKey);
  const t = useTranslations("clinic.payments");
  const tc = useTranslations("common");
  const val = useValueLabel();

  const submit = async () => {
    setError("");
    if (!amount || Number(amount) <= 0) return setError(t("enter_amount"));
    if (!mode) return setError(t("choose_mode"));
    setSaving(true);
    try {
      const r = await api.post<{ payment: { id: string; paymentCode: string; amount: number }; duplicate?: boolean }>("/api/facility/payments", {
        visitId, feeId: feeId || null, amount, mode, referenceNumber: ref || null, overrideReason: reason || null, idempotencyKey: key,
      });
      onRecorded(r.payment);
      onOpenChange(false);
    } catch (e: any) { setError(e.message || t("not_recorded")); }
    finally { setSaving(false); }
  };

  return (
    <>
      <p className="-mt-2 text-sm text-muted-foreground">{patientLabel}</p>
      <div className="space-y-3 pt-1">
        <FeeAmountFields fees={fees} feeId={feeId} setFeeId={(v) => setPicked({ feeId: v, amount })} amount={amount} setAmount={(v) => setPicked({ feeId, amount: v })} reason={reason} setReason={setReason} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FloatingSelect id="payMode" label={t("paid_by")} value={mode} onValueChange={setMode} placeholder={tc("select")}>
            {sortLabels(modes).map((m) => <SelectItem key={m} value={m}>{val(m)}</SelectItem>)}
          </FloatingSelect>
          {mode && mode.toLowerCase() !== "cash" && <FloatingField id="payRef" label={t("reference")} value={ref} onChange={(e) => setRef(e.target.value)} />}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{tc("cancel")}</Button>
        <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} {t("record_x", { amount: amount || 0 })}</Button>
      </DialogFooter>
    </>
  );
}
