"use client";

import { use, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PAYMENT_STATE_LABEL, type PaymentState } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

interface Receipt {
  branding: { portal_name: string; website_url?: string };
  payment: {
    id: string; paymentCode: string; amount: number; mode: string; referenceNumber: string | null; createdAt: string; state: PaymentState; net: number;
    feeName: string | null; standardAmount: number | null; overrideReason: string | null; collectedBy: string;
    cancelledAt: string | null; cancelReason: string | null; cancelledBy: string | null; refundAmount: number | null; refundedAt: string | null; refundReason: string | null; refundedBy: string | null;
    visit: {
      visitCode: string; visitDate: string; patient: { name: string; patientCode: string | null; phone: string | null; gender: string | null };
      facility: { facilityName: string; registeredFacilityName: string | null; addressLine1: string | null; addressLine2: string | null; locality: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null; hfrNumber: string | null };
    };
  };
}
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: string) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Printable receipt for one payment (cancelled / refunded receipts say so in full). */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { api.get<Receipt>(`/api/facility/payments/${id}`).then(setData).catch((e) => setError(e.message || "Couldn't load the receipt")); }, [id]);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);

  if (error) return <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…</div>;
  const p = data.payment, f = p.visit.facility;
  const address = [f.addressLine1, f.addressLine2, f.locality, f.city, f.state, f.pincode].filter(Boolean).join(", ");
  const voided = p.state === "cancelled";

  const doc = (
    <article className="receipt-doc relative mx-auto w-[148mm] max-w-full overflow-hidden bg-white px-[10mm] py-[9mm] text-[10.5pt] leading-snug text-[#1f2937] shadow-xl ring-1 ring-black/5" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif" }}>
      {(voided || p.state === "refunded") && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none text-[44pt] font-black tracking-widest text-red-600/15">{voided ? "CANCELLED" : "REFUNDED"}</span>
      )}
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#0f766e] pb-3">
        <div>
          <p className="text-[14pt] font-bold text-[#0f766e]">{f.registeredFacilityName || f.facilityName}</p>
          {address && <p className="text-[9pt] text-[#4b5563]">{address}</p>}
          <p className="text-[9pt] text-[#4b5563]">{[f.phone, f.email].filter(Boolean).join(" · ")}{f.hfrNumber ? ` · HFR ${f.hfrNumber}` : ""}</p>
        </div>
        <div className="text-right">
          <p className="text-[12pt] font-bold uppercase tracking-wide">Receipt</p>
          <p className="font-mono text-[10pt]">{p.paymentCode}</p>
          <p className="text-[9pt] text-[#4b5563]">{when(p.createdAt)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 py-3 text-[10pt]">
        <p><span className="text-[#6b7280]">Patient:</span> <b>{p.visit.patient.name}</b></p>
        <p><span className="text-[#6b7280]">Patient ID:</span> {p.visit.patient.patientCode ?? "—"}</p>
        <p><span className="text-[#6b7280]">Visit:</span> {p.visit.visitCode} · {new Date(p.visit.visitDate).toLocaleDateString()}</p>
        <p><span className="text-[#6b7280]">Phone:</span> {p.visit.patient.phone ?? "—"}</p>
      </section>

      <table className="w-full border-collapse text-[10pt]">
        <thead><tr className="border-y border-[#d1d5db] bg-[#f3f4f6] text-left"><th className="px-2 py-1.5">Description</th><th className="px-2 py-1.5 text-right">Amount</th></tr></thead>
        <tbody>
          <tr className="border-b border-[#e5e7eb]">
            <td className="px-2 py-2">{p.feeName ?? "Payment"}{p.overrideReason && <span className="block text-[8.5pt] text-[#6b7280]">Standard fee {inr(p.standardAmount ?? 0)} — {p.overrideReason}</span>}</td>
            <td className="px-2 py-2 text-right tabular-nums">{inr(p.amount)}</td>
          </tr>
          {p.refundAmount ? <tr className="border-b border-[#e5e7eb] text-red-700"><td className="px-2 py-2">Refunded{p.refundedAt ? ` on ${when(p.refundedAt)}` : ""}{p.refundReason ? ` — ${p.refundReason}` : ""}</td><td className="px-2 py-2 text-right tabular-nums">−{inr(p.refundAmount)}</td></tr> : null}
          <tr className="font-bold"><td className="px-2 py-2 text-right">{voided ? "Cancelled — nothing payable" : "Total received"}</td><td className="px-2 py-2 text-right tabular-nums">{inr(p.net)}</td></tr>
        </tbody>
      </table>

      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[9.5pt]">
        <p><span className="text-[#6b7280]">Paid by:</span> {p.mode}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}</p>
        <p><span className="text-[#6b7280]">Status:</span> <b className={voided || p.state !== "paid" ? "text-red-700" : "text-[#0f766e]"}>{PAYMENT_STATE_LABEL[p.state]}</b></p>
        <p><span className="text-[#6b7280]">Received by:</span> {p.collectedBy}</p>
        {voided && <p><span className="text-[#6b7280]">Cancelled:</span> {p.cancelledAt && when(p.cancelledAt)} by {p.cancelledBy} — {p.cancelReason}</p>}
      </section>

      <footer className="mt-6 flex items-end justify-between border-t border-[#e5e7eb] pt-2 text-[8.5pt] text-[#6b7280]">
        <span>Computer-generated receipt · {data.branding.portal_name}</span>
        <span className="text-right">Authorised signature<br /><span className="inline-block w-36 border-b border-[#9ca3af] pt-6" /></span>
      </footer>
    </article>
  );

  return (
    <div className="space-y-4">
      <style>{`
        #receipt-print { display: none; }
        @media print {
          @page { size: A5; margin: 8mm; }
          html, body { background: #fff !important; }
          body > *:not(#receipt-print) { display: none !important; }
          #receipt-print { display: block !important; }
          #receipt-print .receipt-doc { width: 100% !important; box-shadow: none !important; padding: 0 !important; }
        }
        .receipt-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <p className="text-sm font-semibold">Receipt {p.paymentCode} · {p.visit.patient.name}</p>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>
      {doc}
      {mounted && createPortal(<div id="receipt-print">{doc}</div>, document.body)}
    </div>
  );
}
