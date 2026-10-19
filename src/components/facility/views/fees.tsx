"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { cn } from "@/lib/utils";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IndianRupee, Loader2, Pencil, Plus } from "lucide-react";
import type { Fee } from "@/components/facility/payments/payment-dialog";

const KINDS = ["registration", "consultation", "follow_up", "other"];
const SUGGESTED = ["registration", "consultation", "follow_up"] as const;

/** Facility Profile → Fees: the amounts reception picks from. Switched off, never deleted. */
export function FeesView() {
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [draft, setDraft] = useState<{ id?: string; name: string; amount: string; kind: string; active: boolean } | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const t = useTranslations("clinic.fees");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const load = useCallback(() => api.get<{ fees: Fee[] }>("/api/facility/fees?all=1").then((r) => setFees(r.fees)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const save = async (d = draft) => {
    if (!d) return;
    setSaving(true); setError("");
    try { await api.put("/api/facility/fees", { ...d }); setDraft(null); await load(); }
    catch (e: any) { setError(e.message || tc("not_saved")); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-bold"><IndianRupee className="h-5 w-5 text-primary" /> {t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button data-tour="fees.add" onClick={() => setDraft({ name: "", amount: "", kind: "consultation", active: true })}><Plus className="h-4 w-4" /> {t("add")}</Button>
      </div>
      {error && !draft && <p className="text-sm text-destructive">{error}</p>}

      {!fees ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}</div>
      ) : fees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("none")}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTED.map((k) => <Button key={k} variant="outline" size="sm" onClick={() => setDraft({ name: t(`sugg_${k}`), amount: "", kind: k, active: true })}><Plus className="h-3.5 w-3.5" /> {t(`sugg_${k}`)}</Button>)}
          </div>
        </div>
      ) : (
        <div data-tour="fees.list" className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2.5">{t("col_fee")}</th><th className="px-3 py-2.5">{t("col_type")}</th><th className="px-3 py-2.5 text-end">{t("col_amount")}</th><th className="px-3 py-2.5 text-center">{t("col_in_use")}</th><th className="px-3 py-2.5 text-end">{t("col_edit")}</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fees.map((f) => (
                <tr key={f.id} className={cn(!f.active && "opacity-50")}>
                  <td className="px-3 py-2.5 font-medium">{f.name}</td>
                  <td className="px-3 py-2.5"><Badge variant="outline">{KINDS.includes(f.kind) ? t(`kind_${f.kind}`) : f.kind}</Badge></td>
                  <td className="px-3 py-2.5 text-end font-semibold tabular-nums">₹{f.amount.toLocaleString(dl)}</td>
                  <td className="px-3 py-2.5 text-center"><Switch checked={f.active} onCheckedChange={(v) => save({ id: f.id, name: f.name, amount: String(f.amount), kind: f.kind, active: v })} aria-label={t(f.active ? "switch_off" : "switch_on", { name: f.name })} /></td>
                  <td className="px-3 py-2.5 text-end"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDraft({ id: f.id, name: f.name, amount: String(f.amount), kind: f.kind, active: f.active })} aria-label={t("edit_name", { name: f.name })}><Pencil className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? t("edit") : t("add")}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3 pt-1">
              <FloatingField id="feeName" label={t("name")} value={draft.name} onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <FloatingField id="feeAmount" type="number" min={0} label={t("amount")} value={draft.amount} onChange={(e) => setDraft((d) => d && { ...d, amount: e.target.value })} />
                <FloatingSelect id="feeKind" label={t("col_type")} value={draft.kind} onValueChange={(v) => setDraft((d) => d && { ...d, kind: v })}>
                  {KINDS.map((k) => <SelectItem key={k} value={k}>{t(`kind_${k}`)}</SelectItem>)}
                </FloatingSelect>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>{tc("cancel")}</Button>
            <Button onClick={() => save()} disabled={saving || !draft?.name.trim() || draft?.amount === ""}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
