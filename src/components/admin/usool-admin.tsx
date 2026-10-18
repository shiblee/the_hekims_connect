"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingMultiSelect, FloatingSelect } from "@/components/shared/floating-field";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, Sparkles } from "lucide-react";

interface Rule {
  always?: boolean; mizaj?: string[]; type?: "Sada" | "Maddi"; minDarja?: number; organs?: string[]; categories?: string[];
  complaints?: string[]; symptoms?: string[]; regions?: string[]; sex?: "male" | "female"; phase?: number;
  avoidIf?: string[]; cautionBelowAge?: number; cautionAboveAge?: number;
}
interface Principle { id: string; label: string; localName: string | null; description: string | null; priority: number; reviewStatus: string; active: boolean; appliesTo: string }
interface Masters { categories: string[]; complaints: { key: string; label: string; category: string }[]; symptoms: string[]; regions: string[] }
interface Draft { id: string | null; label: string; localName: string; description: string; priority: number; reviewStatus: string; active: boolean; rule: Rule }

const parseRule = (raw: string): Rule => { try { return JSON.parse(raw || "{}") || {}; } catch { return {}; } };
const PHASES: [number, string][] = [[1, "Remove the cause · Izala-e-Sabab"], [2, "Concoction · Nuzj"], [3, "Evacuation · Istifragh"], [4, "Correct the temperament · Tadeel-e-Mizaj"], [5, "Strengthen · Taqwiyat"], [6, "Relieve symptoms · Ilaj-e-Alamati"]];
const STATUS: Record<string, string> = {
  draft: "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  approved: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  retired: "border-border/60 text-muted-foreground",
};

function Chips({ items, selected, onToggle }: { items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => {
        const on = selected.includes(v);
        return <button key={v} type="button" onClick={() => onToggle(v)} className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/40")}>{v}</button>;
      })}
    </div>
  );
}

/**
 * Admin → Meta → Tashkhees & Ilaj → Usool-e-Ilaj: the principles of treatment
 * and the conditions the Stage 5 engine uses to build a treatment plan — the
 * step in the classical order, which diagnoses / organs / complaints each
 * principle suits, and the cautions under which it must not be suggested.
 */
export function UsoolAdmin() {
  const [rows, setRows] = useState<Principle[] | null>(null);
  const [mizaj, setMizaj] = useState<string[]>([]);
  const [organs, setOrgans] = useState<string[]>([]);
  const [findings, setFindings] = useState<string[]>([]);
  const [masters, setMasters] = useState<Masters | null>(null);
  const [cfg, setCfg] = useState<{ maxPrinciples: number; ranking: boolean }>({ maxPrinciples: 6, ranking: true });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState({ complaints: "", symptoms: "", regions: "", avoid: "" });

  const load = () => adminApi.get<{ config: typeof cfg; principles: Principle[]; mizaj: string[]; organs: string[]; findings: string[] }>("/api/admin/usool-engine")
    .then((r) => { setRows(r.principles); setCfg(r.config); setMizaj(r.mizaj); setOrgans(r.organs); setFindings(r.findings); })
    .catch((e) => toast.error(e.message || "Could not load the principles"));
  useEffect(() => {
    load();
    adminApi.get<Masters>("/api/admin/asbab/selection-masters").then(setMasters).catch(() => {});
  }, []);

  if (!rows) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const saveCfg = async (next: typeof cfg) => {
    setCfg(next);
    try { await adminApi.put("/api/admin/usool-engine", { config: next }); toast.success("Saved"); } catch (e: any) { toast.error(e.message || "Could not save"); }
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    try { await adminApi.patch(`/api/admin/usool-engine/${id}`, body); load(); } catch (e: any) { toast.error(e.message || "Could not update"); }
  };
  const drafts = rows.filter((r) => r.reviewStatus === "draft").map((r) => r.id);
  const approveAll = async () => {
    if (!drafts.length || !window.confirm(`Approve ${drafts.length} draft principle${drafts.length === 1 ? "" : "s"}? Only approve after a qualified Unani physician has reviewed the wording, conditions and cautions.`)) return;
    try { const r = await adminApi.post<{ approved: number }>("/api/admin/usool-engine/approve", { ids: drafts }); toast.success(`${r.approved} approved`); load(); } catch (e: any) { toast.error(e.message || "Could not approve"); }
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { label: draft.label, localName: draft.localName, description: draft.description, priority: draft.priority, reviewStatus: draft.reviewStatus, active: draft.active, rule: draft.rule };
      if (draft.id) await adminApi.patch(`/api/admin/usool-engine/${draft.id}`, body);
      else await adminApi.post("/api/admin/usool-engine", body);
      toast.success(draft.id ? "Principle updated" : "Principle added");
      setDraft(null);
      load();
    } catch (e: any) { toast.error(e.message || "Could not save"); } finally { setSaving(false); }
  };
  const setR = (p: Partial<Rule>) => setDraft((d) => (d ? { ...d, rule: { ...d.rule, ...p } } : d));
  const toggle = (k: "mizaj" | "organs" | "categories", v: string) => setDraft((d) => {
    if (!d) return d;
    const cur = d.rule[k] || [];
    return { ...d, rule: { ...d.rule, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } };
  });
  const summary = (r: Rule) => {
    const parts = [
      r.always && "Every plan",
      r.type, r.mizaj?.length && `for ${r.mizaj.join("/")}`, r.minDarja && `Darja ${r.minDarja}+`,
      r.organs?.length && (r.organs.includes("*") ? "any organ recorded" : r.organs.join(", ")),
      ...(r.categories || []), ...(r.symptoms || []).slice(0, 2),
    ].filter(Boolean) as string[];
    return parts.length ? parts.join(" · ") : "No conditions — never suggested";
  };
  const open = (p?: Principle) => {
    setQ({ complaints: "", symptoms: "", regions: "", avoid: "" });
    setDraft(p
      ? { id: p.id, label: p.label, localName: p.localName || "", description: p.description || "", priority: p.priority, reviewStatus: p.reviewStatus, active: p.active, rule: parseRule(p.appliesTo) }
      : { id: null, label: "", localName: "", description: "", priority: 3, reviewStatus: "draft", active: true, rule: { phase: 4 } });
  };
  const cautionPool = [...new Set([...findings, ...(masters?.symptoms || []), ...(masters?.regions || []), ...(masters?.categories || [])])];

  return (
    <div className="space-y-5">
      <Card className="p-4 border-primary/25 bg-primary/5 flex-row flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-sm font-semibold flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /> Treatment-plan engine</p>
        <label className="flex items-center gap-2 text-sm">Principles per plan
          <Input type="number" min={2} max={15} value={String(cfg.maxPrinciples)} onChange={(e) => setCfg({ ...cfg, maxPrinciples: Number(e.target.value) })} onBlur={() => saveCfg(cfg)} className="h-8 w-20 bg-background/60" />
        </label>
        <label className="flex items-center gap-2 text-sm">Order with Hakeem Insight <Switch checked={cfg.ranking} onCheckedChange={(v) => saveCfg({ ...cfg, ranking: v })} /></label>
        <p className="text-xs text-muted-foreground basis-full">The doctor sees a plan in classical steps built from the diagnosis (Su-e-Mizaj, Sada/Maddi, Darja, organs), complaints and symptoms. Only <b>Approved</b> principles are used; a principle that hits one of its cautions is shown apart and never pre-selected. Foundation principles (&ldquo;every plan&rdquo;) always lead.</p>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{rows.length} principles · {rows.filter((r) => r.reviewStatus === "approved" && r.active).length} in use · {drafts.length} awaiting review</p>
        <span className="flex gap-2">
          {drafts.length > 0 && <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400" onClick={approveAll}><CheckCircle2 className="h-3.5 w-3.5" /> Approve {drafts.length} drafts</Button>}
          <Button size="sm" onClick={() => open()}><Plus className="h-3.5 w-3.5" /> Add principle</Button>
        </span>
      </div>

      {PHASES.map(([n, title]) => {
        const items = rows.filter((r) => (parseRule(r.appliesTo).phase || 6) === n);
        if (!items.length) return null;
        return (
          <Card key={n} className="p-4 border-border/50 bg-card/60 gap-2">
            <p className="text-sm font-semibold"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">{n}</span>{title}</p>
            <div className="grid md:grid-cols-2 gap-2">
              {items.map((p) => {
                const r = parseRule(p.appliesTo);
                return (
                  <div key={p.id} className={cn("rounded-lg border border-border/50 bg-background/40 px-3 py-2", !p.active && "opacity-50")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.label}{p.localName && <span className="ml-1.5 text-xs text-muted-foreground">{p.localName}</span>}</p>
                        {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      </div>
                      <span className="flex items-center gap-1 shrink-0">
                        {p.reviewStatus === "draft" && <Button size="sm" variant="outline" className="h-7 border-emerald-500/40 text-emerald-700 dark:text-emerald-400" onClick={() => patch(p.id, { reviewStatus: "approved" })}>Approve</Button>}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => open(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Switch checked={p.active} onCheckedChange={(v) => patch(p.id, { active: v })} />
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS[p.reviewStatus])}>{p.reviewStatus}</Badge>
                      <span className="text-[11px] text-muted-foreground">Priority {p.priority}</span>
                      {(r.avoidIf?.length || r.cautionBelowAge != null || r.cautionAboveAge != null) && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" /> Cautions</Badge>}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground truncate" title={summary(r)}>{summary(r)}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Dialog open={draft !== null} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit principle" : "Add principle"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4 pt-2">
              <div className="grid sm:grid-cols-2 gap-3">
                <FloatingField id="usLabel" label="Principle" required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                <FloatingField id="usLocal" label="Unani / Urdu name (optional)" value={draft.localName} onChange={(e) => setDraft({ ...draft, localName: e.target.value })} />
              </div>
              <FloatingField id="usDesc" label="Meaning (shown to the doctor)" maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="grid sm:grid-cols-3 gap-3 pt-1">
                <FloatingSelect id="usPhase" label="Step in the plan" value={String(draft.rule.phase || 6)} onValueChange={(v) => setR({ phase: Number(v) })}>
                  {PHASES.map(([n, t]) => <SelectItem key={n} value={String(n)}>{n}. {t}</SelectItem>)}
                </FloatingSelect>
                <FloatingSelect id="usStatus" label="Review status" value={draft.reviewStatus} onValueChange={(v) => setDraft({ ...draft, reviewStatus: v })}>
                  <SelectItem value="draft">Draft — awaiting review</SelectItem>
                  <SelectItem value="approved">Approved — can be used</SelectItem>
                  <SelectItem value="retired">Retired — never used</SelectItem>
                </FloatingSelect>
                <FloatingSelect id="usPriority" label="Priority" value={String(draft.priority)} onValueChange={(v) => setDraft({ ...draft, priority: Number(v) })}>
                  {[5, 4, 3, 2, 1].map((x) => <SelectItem key={x} value={String(x)}>{x} — {["", "Low", "Below average", "Average", "High", "Very high"][x]}</SelectItem>)}
                </FloatingSelect>
              </div>

              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-3">
                <p className="text-sm font-semibold text-primary">When to suggest it</p>
                <label className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">Foundation — part of every plan <Switch checked={!!draft.rule.always} onCheckedChange={(v) => setR({ always: v || undefined })} /></label>
                <div className="grid sm:grid-cols-3 gap-3 pt-1">
                  <FloatingSelect id="usType" label="Su-e-Mizaj type" value={draft.rule.type || "any"} onValueChange={(v) => setR({ type: v === "any" ? undefined : (v as "Sada" | "Maddi") })}>
                    <SelectItem value="any">Sada or Maddi</SelectItem>
                    <SelectItem value="Sada">Sada only</SelectItem>
                    <SelectItem value="Maddi">Maddi only</SelectItem>
                  </FloatingSelect>
                  <FloatingSelect id="usDarja" label="Minimum Darja" value={String(draft.rule.minDarja || 0)} onValueChange={(v) => setR({ minDarja: Number(v) || undefined })}>
                    <SelectItem value="0">Any</SelectItem>
                    {[1, 2, 3, 4].map((x) => <SelectItem key={x} value={String(x)}>Darja {x}+</SelectItem>)}
                  </FloatingSelect>
                  <FloatingSelect id="usSex" label="Patients" value={draft.rule.sex || "any"} onValueChange={(v) => setR({ sex: v === "any" ? undefined : (v as "male" | "female") })}>
                    <SelectItem value="any">Any sex</SelectItem>
                    <SelectItem value="female">Women only</SelectItem>
                    <SelectItem value="male">Men only</SelectItem>
                  </FloatingSelect>
                </div>
                <div><p className="text-xs font-semibold text-muted-foreground mb-1.5">For these Su-e-Mizaj qualities (leave empty for any)</p><Chips items={mizaj} selected={draft.rule.mizaj || []} onToggle={(v) => toggle("mizaj", v)} /></div>
                <div><p className="text-xs font-semibold text-muted-foreground mb-1.5">Affected organs</p><Chips items={["*", ...organs]} selected={draft.rule.organs || []} onToggle={(v) => toggle("organs", v)} /><p className="mt-1 text-[11px] text-muted-foreground">&ldquo;*&rdquo; = any organ recorded in the diagnosis.</p></div>
                <div><p className="text-xs font-semibold text-muted-foreground mb-1.5">Complaint categories</p><Chips items={masters?.categories || []} selected={draft.rule.categories || []} onToggle={(v) => toggle("categories", v)} /></div>
                {masters && (
                  <div className="grid gap-4 pt-1">
                    <FloatingMultiSelect id="usComplaints" label="Specific complaints" openOnFocus
                      selected={(draft.rule.complaints || []).map((k) => ({ id: k, label: masters.complaints.find((c) => c.key === k)?.label ?? k }))}
                      onRemove={(k) => setR({ complaints: (draft.rule.complaints || []).filter((x) => x !== k) })}
                      query={q.complaints} onQueryChange={(v) => setQ((x) => ({ ...x, complaints: v }))}
                      results={masters.complaints.filter((c) => !(draft.rule.complaints || []).includes(c.key) && (!q.complaints.trim() || c.label.toLowerCase().includes(q.complaints.trim().toLowerCase()))).slice(0, 12).map((c) => ({ id: c.key, label: c.label }))}
                      onPick={(k) => setR({ complaints: [...(draft.rule.complaints || []), k] })} placeholder="Type a complaint…" />
                    <FloatingMultiSelect id="usSymptoms" label="Other symptoms" openOnFocus
                      selected={(draft.rule.symptoms || []).map((x) => ({ id: x, label: x }))}
                      onRemove={(x) => setR({ symptoms: (draft.rule.symptoms || []).filter((y) => y !== x) })}
                      query={q.symptoms} onQueryChange={(v) => setQ((x) => ({ ...x, symptoms: v }))}
                      results={masters.symptoms.filter((x) => !(draft.rule.symptoms || []).includes(x) && (!q.symptoms.trim() || x.toLowerCase().includes(q.symptoms.trim().toLowerCase()))).slice(0, 12).map((x) => ({ id: x, label: x }))}
                      onPick={(x) => setR({ symptoms: [...(draft.rule.symptoms || []), x] })} placeholder="Type a symptom…" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Cautions — shown apart, never pre-selected</p>
                <FloatingMultiSelect id="usAvoid" label="When any of these is recorded" openOnFocus tone="destructive"
                  selected={(draft.rule.avoidIf || []).map((x) => ({ id: x, label: x }))}
                  onRemove={(x) => setR({ avoidIf: (draft.rule.avoidIf || []).filter((y) => y !== x) })}
                  query={q.avoid} onQueryChange={(v) => setQ((x) => ({ ...x, avoid: v }))}
                  results={cautionPool.filter((x) => !(draft.rule.avoidIf || []).includes(x) && (!q.avoid.trim() || x.toLowerCase().includes(q.avoid.trim().toLowerCase()))).slice(0, 12).map((x) => ({ id: x, label: x }))}
                  onPick={(x) => setR({ avoidIf: [...(draft.rule.avoidIf || []), x] })} placeholder="Type a finding, symptom or region — e.g. weak pulse, pregnancy" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <FloatingField id="usBelow" label="Caution under age (optional)" type="number" min={0} max={120} value={draft.rule.cautionBelowAge ?? ""} onChange={(e) => setR({ cautionBelowAge: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  <FloatingField id="usAbove" label="Caution over age (optional)" type="number" min={0} max={120} value={draft.rule.cautionAboveAge ?? ""} onChange={(e) => setR({ cautionAboveAge: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5 text-sm font-medium">Principle enabled <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} /></label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !draft?.label.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {draft?.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
