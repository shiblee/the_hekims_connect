"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IndianRupee, Loader2, Pencil, Plus } from "lucide-react";
import type { Fee } from "@/components/facility/payments/payment-dialog";

const KINDS: Record<string, string> = { registration: "Registration", consultation: "Consultation", follow_up: "Follow-up", other: "Other" };
const SUGGESTED = [["New patient registration", "registration"], ["Consultation", "consultation"], ["Follow-up visit", "follow_up"]] as const;

/** Facility Profile → Fees: the amounts reception picks from. Switched off, never deleted. */
export function FeesView() {
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [draft, setDraft] = useState<{ id?: string; name: string; amount: string; kind: string; active: boolean } | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(() => api.get<{ fees: Fee[] }>("/api/facility/fees?all=1").then((r) => setFees(r.fees)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const save = async (d = draft) => {
    if (!d) return;
    setSaving(true); setError("");
    try { await api.put("/api/facility/fees", { ...d }); setDraft(null); await load(); }
    catch (e: any) { setError(e.message || "Not saved"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-bold"><IndianRupee className="h-5 w-5 text-primary" /> Fees</h2>
          <p className="text-sm text-muted-foreground">Reception picks one of these when recording a payment. Charging a different amount needs a reason, which is logged. Price changes don&apos;t alter past receipts.</p>
        </div>
        <Button data-tour="fees.add" onClick={() => setDraft({ name: "", amount: "", kind: "consultation", active: true })}><Plus className="h-4 w-4" /> Add fee</Button>
      </div>
      {error && !draft && <p className="text-sm text-destructive">{error}</p>}

      {!fees ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : fees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No fees yet. Start with the common ones:</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTED.map(([n, k]) => <Button key={n} variant="outline" size="sm" onClick={() => setDraft({ name: n, amount: "", kind: k, active: true })}><Plus className="h-3.5 w-3.5" /> {n}</Button>)}
          </div>
        </div>
      ) : (
        <div data-tour="fees.list" className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2.5">Fee</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-center">In use</th><th className="px-3 py-2.5 text-right">Edit</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fees.map((f) => (
                <tr key={f.id} className={cn(!f.active && "opacity-50")}>
                  <td className="px-3 py-2.5 font-medium">{f.name}</td>
                  <td className="px-3 py-2.5"><Badge variant="outline">{KINDS[f.kind] ?? f.kind}</Badge></td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">₹{f.amount.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 text-center"><Switch checked={f.active} onCheckedChange={(v) => save({ id: f.id, name: f.name, amount: String(f.amount), kind: f.kind, active: v })} aria-label={f.active ? `Switch off ${f.name}` : `Switch on ${f.name}`} /></td>
                  <td className="px-3 py-2.5 text-right"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDraft({ id: f.id, name: f.name, amount: String(f.amount), kind: f.kind, active: f.active })} aria-label={`Edit ${f.name}`}><Pencil className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit fee" : "Add fee"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3 pt-1">
              <FloatingField id="feeName" label="Fee name" value={draft.name} onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <FloatingField id="feeAmount" type="number" min={0} label="Amount (₹)" value={draft.amount} onChange={(e) => setDraft((d) => d && { ...d, amount: e.target.value })} />
                <FloatingSelect id="feeKind" label="Type" value={draft.kind} onValueChange={(v) => setDraft((d) => d && { ...d, kind: v })}>
                  {Object.entries(KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </FloatingSelect>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
            <Button onClick={() => save()} disabled={saving || !draft?.name.trim() || draft?.amount === ""}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
