"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";

type Counts = Record<string, number>;
interface Data {
  config: { enabled: boolean; maxPerCategory: number; ranking: boolean };
  readiness: { indications: Counts; symptoms: Counts; ingredients: Counts; safety: Counts; allergy: Counts };
  usage: { sessions: number; decisions: Counts; recentRejections: { label: string; reason: string | null; createdAt: string }[] };
}

function Ready({ label, c }: { label: string; c: Counts }) {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const ver = c.verified || 0, rej = c.rejected || 0;
  const pct = total ? Math.round((ver / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-baseline justify-between"><p className="text-sm font-medium">{label}</p><p className="text-xs tabular-nums text-muted-foreground">{ver} / {total} verified</p></div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-[11px] text-muted-foreground">{pct}% verified{rej ? ` · ${rej} rejected` : ""} · {c.unverified || 0} awaiting review</p>
    </div>
  );
}

/**
 * Admin → Meta → Tashkhees & Ilaj → Medicines (Decision support): the pilot
 * switch, settings, how much of the medicine data is clinically verified, and
 * how doctors are using it (accepted / rejected with reasons).
 */
export function CdsAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const load = () => adminApi.get<Data>("/api/admin/cds").then(setData).catch((e) => toast.error(e.message || "Could not load"));
  useEffect(() => { load(); }, []);
  if (!data) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  const save = async (config: Data["config"]) => {
    if (config.enabled && !data.config.enabled && !window.confirm("Switch the pilot ON? Doctors will see medicine and supplement candidates on page 5, marked 'Unverified' until your clinical team reviews the data. Recommendations remain decision support — doctors decide and prescribe.")) return;
    setData({ ...data, config });
    try { await adminApi.put("/api/admin/cds", { config }); toast.success(config.enabled ? "Pilot is ON for doctors" : "Saved"); } catch (e: any) { toast.error(e.message || "Could not save"); }
  };
  const c = data.config;
  const d = data.usage.decisions;
  return (
    <div className="space-y-5">
      <Card className={cn("p-5 gap-3", c.enabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5")}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", c.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}><ShieldAlert className="h-5 w-5" /></div>
            <div>
              <h3 className="font-serif text-lg font-semibold">Clinical Decision Support — Medicines &amp; Supplements</h3>
              <p className="text-sm text-muted-foreground max-w-3xl">Doctors only, on page 5 above Ilaj-bil-Dawa. Suggests Unani medicines and supplements from your own database after safety checks (allergies, interactions with current medicines, duplicates, pregnancy, children, older adults, kidney, liver, contraindications). Allopathic medicines are used for safety checks only, never suggested. No doses. Doctors accept, reject (with a reason) or add to the prescription themselves.</p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">{c.enabled ? "Pilot ON" : "Pilot OFF"}<Switch checked={c.enabled} onCheckedChange={(v) => save({ ...c, enabled: v })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">Candidates per tab <Input type="number" min={2} max={15} value={String(c.maxPerCategory)} onChange={(e) => setData({ ...data, config: { ...c, maxPerCategory: Number(e.target.value) } })} onBlur={() => save(data.config)} className="h-8 w-16 bg-background/60" /></label>
          <label className="flex items-center gap-2">Order with Hakeem Insight <Switch checked={c.ranking} onCheckedChange={(v) => save({ ...c, ranking: v })} /></label>
        </div>
      </Card>

      <Card className="p-5 border-border/50 bg-card/60 gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-base font-semibold">Data readiness — clinical verification</h3>
            <p className="text-xs text-muted-foreground max-w-3xl">Candidates and safety notes are shown as &ldquo;Unverified&rdquo; until reviewed. Safety data is applied even when unverified (the safer error). Verify or reject items in each medicine&apos;s profile.</p>
          </div>
          <Button asChild size="sm" variant="outline"><Link href="/admin/meta/supplements">Review medicines &amp; herbs →</Link></Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <Ready label="Indications" c={data.readiness.indications} />
          <Ready label="Symptom links" c={data.readiness.symptoms} />
          <Ready label="Safety items" c={data.readiness.safety} />
          <Ready label="Allergy cautions" c={data.readiness.allergy} />
          <Ready label="Ingredients" c={data.readiness.ingredients} />
        </div>
        {!(data.readiness.indications.verified) && <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> No indications are verified yet — keep the pilot limited to trained doctors until the most-used medicines are reviewed.</p>}
      </Card>

      <Card className="p-5 border-border/50 bg-card/60 gap-3">
        <h3 className="font-serif text-base font-semibold">Usage &amp; audit</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {([["Checks run", data.usage.sessions], ["Considered", d.considered || 0], ["Accepted", d.accepted || 0], ["Rejected", d.rejected || 0], ["Added to Rx", d.added_to_prescription || 0]] as const).map(([l, v]) => (
            <div key={l} className="rounded-lg border border-border/50 bg-background/40 p-2"><p className="text-xl font-bold tabular-nums">{v}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recent rejections (doctor feedback)</p>
          {data.usage.recentRejections.length ? data.usage.recentRejections.map((r, i) => <p key={i} className="text-xs"><span className="font-medium">{r.label}</span> — {r.reason} <span className="text-muted-foreground">· {new Date(r.createdAt).toLocaleDateString()}</span></p>) : <p className="text-xs text-muted-foreground">None yet.</p>}
        </div>
      </Card>
    </div>
  );
}
