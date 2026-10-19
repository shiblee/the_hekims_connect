"use client";

import { useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, CheckCircle2, ImageIcon, Loader2, Pencil, Plus, Search, Sparkles, Utensils } from "lucide-react";
import { sortLabels } from "@/lib/sort-options";

interface Side { symptoms?: string[]; conditions?: string[]; categories?: string[]; organs?: string[] }
interface Rule { good?: Side; avoid?: Side; allergens?: string[]; heavy?: boolean; nafakh?: boolean }
interface Food {
  id: string; label: string; description: string | null; category: string | null; foodMizaj: string | null; appliesTo: string;
  reviewStatus: string; active: boolean; imageUrl: string | null; imageCredit: string | null; imageSource: string | null;
}
interface Draft {
  id: string | null; label: string; description: string; category: string; hot: string; moist: string; degree: number;
  reviewStatus: string; active: boolean; rule: Rule; imageUrl: string | null; imageCredit: string | null; imageSource: string | null;
}
interface Photo { title: string; url: string; credit: string; source: string }

const GROUPS = ["Grains & breads", "Pulses", "Vegetables", "Leafy greens & herbs", "Fruits", "Dry fruits, nuts & seeds", "Dairy", "Meat, fish & eggs", "Spices", "Oils & fats", "Sweeteners", "Drinks", "Prepared foods"];
const parseRule = (raw: string): Rule => { try { return JSON.parse(raw || "{}") || {}; } catch { return {}; } };
const mizajParts = (m: string | null) => {
  const s = m || "";
  return { hot: /haar/i.test(s) ? "Haar" : /barid/i.test(s) ? "Barid" : "", moist: /ratab/i.test(s) ? "Ratab" : /yabis/i.test(s) ? "Yabis" : "", degree: Number((s.match(/[1-4]/) || ["1"])[0]) };
};
const STATUS: Record<string, string> = {
  draft: "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  approved: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  retired: "border-border/60 text-muted-foreground",
};

function Chips({ items, selected, onToggle, tone = "primary" }: { items: { key: string; label: string }[]; selected: string[]; onToggle: (k: string) => void; tone?: "primary" | "danger" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.includes(it.key);
        return <button key={it.key} type="button" onClick={() => onToggle(it.key)}
          className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", on ? (tone === "danger" ? "border-destructive bg-destructive text-white" : "border-primary bg-primary text-primary-foreground") : "border-border/60 hover:border-primary/40")}>{it.label}</button>;
      })}
    </div>
  );
}

/**
 * Admin → Meta → Tashkhees & Ilaj → Ghiza (Foods): the food database used by
 * Ilaj-bil-Ghiza — photo, food group, Unani temperament, and when each food is
 * good or should be avoided (health conditions, symptoms, organs, allergens,
 * heavy / wind-forming). The Stage 5 diet engine sorts approved foods into
 * Recommended and Parhez for each patient.
 */
export function GhizaAdmin() {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [conditions, setConditions] = useState<{ key: string; label: string }[]>([]);
  const [organs, setOrgans] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [cfg, setCfg] = useState({ maxRecommended: 8, maxAvoid: 8, ranking: true });
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [ms, setMs] = useState({ goodSym: "", avoidSym: "", allergen: "" });
  const [photoQ, setPhotoQ] = useState("");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = () => adminApi.get<{ config: typeof cfg; foods: Food[]; conditions: { key: string; label: string }[]; organs: string[]; allergies: string[]; symptoms: string[] }>("/api/admin/ghiza")
    .then((r) => { setFoods(r.foods); setCfg(r.config); setConditions(r.conditions); setOrgans(r.organs); setAllergies(r.allergies); setSymptoms(r.symptoms); })
    .catch((e) => toast.error(e.message || "Could not load the foods"));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (foods || []).filter((f) =>
    (group === "all" || f.category === group) && (status === "all" || f.reviewStatus === status)
    && (!q.trim() || f.label.toLowerCase().includes(q.trim().toLowerCase()) || (f.description || "").toLowerCase().includes(q.trim().toLowerCase()))), [foods, group, status, q]);

  if (!foods) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const drafts = shown.filter((f) => f.reviewStatus === "draft").map((f) => f.id);
  const saveCfg = async (next: typeof cfg) => {
    setCfg(next);
    try { await adminApi.put("/api/admin/ghiza", { config: next }); toast.success("Saved"); } catch (e: any) { toast.error(e.message || "Could not save"); }
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    try { await adminApi.patch(`/api/admin/ghiza/${id}`, body); load(); } catch (e: any) { toast.error(e.message || "Could not update"); }
  };
  const approve = async () => {
    if (!drafts.length || !window.confirm(`Approve ${drafts.length} draft food${drafts.length === 1 ? "" : "s"} shown? Only approve after a qualified Unani physician has reviewed the temperament and rules.`)) return;
    try { const r = await adminApi.post<{ approved: number }>("/api/admin/ghiza/approve", { ids: drafts }); toast.success(`${r.approved} approved`); load(); } catch (e: any) { toast.error(e.message || "Could not approve"); }
  };
  const open = (f?: Food) => {
    setMs({ goodSym: "", avoidSym: "", allergen: "" }); setPhotos(null); setPhotoQ(f ? f.label.replace(/\(.*\)/, "").trim() : "");
    if (f) {
      const m = mizajParts(f.foodMizaj);
      setDraft({ id: f.id, label: f.label, description: f.description || "", category: f.category || "", hot: m.hot, moist: m.moist, degree: m.degree, reviewStatus: f.reviewStatus, active: f.active, rule: parseRule(f.appliesTo), imageUrl: f.imageUrl, imageCredit: f.imageCredit, imageSource: f.imageSource });
    } else setDraft({ id: null, label: "", description: "", category: GROUPS[0], hot: "", moist: "", degree: 1, reviewStatus: "draft", active: true, rule: {}, imageUrl: null, imageCredit: null, imageSource: null });
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { ...draft };
      if (draft.id) await adminApi.patch(`/api/admin/ghiza/${draft.id}`, body); else await adminApi.post("/api/admin/ghiza", body);
      toast.success(draft.id ? "Food updated" : "Food added"); setDraft(null); load();
    } catch (e: any) { toast.error(e.message || "Could not save"); } finally { setSaving(false); }
  };
  const searchPhotos = async () => {
    if (!photoQ.trim()) return;
    setSearching(true);
    try { setPhotos((await adminApi.get<{ results: Photo[] }>(`/api/admin/ghiza/photo-search?q=${encodeURIComponent(photoQ)}`)).results); }
    catch (e: any) { toast.error(e.message || "Photo search failed"); } finally { setSearching(false); }
  };
  const setSide = (which: "good" | "avoid", patchSide: Side) => setDraft((d) => (d ? { ...d, rule: { ...d.rule, [which]: { ...(d.rule[which] || {}), ...patchSide } } } : d));
  const toggleIn = (which: "good" | "avoid", k: keyof Side, v: string) => setDraft((d) => {
    if (!d) return d;
    const cur = (d.rule[which]?.[k] as string[] | undefined) || [];
    return { ...d, rule: { ...d.rule, [which]: { ...(d.rule[which] || {}), [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } } };
  });

  return (
    <div className="space-y-5">
      <Card className="p-4 border-primary/25 bg-primary/5 flex-row flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-sm font-semibold flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /> Diet engine</p>
        <label className="flex items-center gap-2 text-sm">Recommended per patient <Input type="number" min={2} max={20} value={String(cfg.maxRecommended)} onChange={(e) => setCfg({ ...cfg, maxRecommended: Number(e.target.value) })} onBlur={() => saveCfg(cfg)} className="h-8 w-16 bg-background/60" /></label>
        <label className="flex items-center gap-2 text-sm">Parhez per patient <Input type="number" min={2} max={20} value={String(cfg.maxAvoid)} onChange={(e) => setCfg({ ...cfg, maxAvoid: Number(e.target.value) })} onBlur={() => saveCfg(cfg)} className="h-8 w-16 bg-background/60" /></label>
        <label className="flex items-center gap-2 text-sm">Order with Hakeem Insight <Switch checked={cfg.ranking} onCheckedChange={(v) => saveCfg({ ...cfg, ranking: v })} /></label>
        <p className="text-xs text-muted-foreground basis-full">Approved foods are sorted for each patient by Ilaj bil Zid (foods opposite to the present Su-e-Mizaj are favoured), the conditions found in their history, today&apos;s symptoms and affected organs. Foods matching a recorded allergy are always Parhez. Heavy and wind-forming foods are avoided when digestion is weak or there is bloating.</p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${foods.length} foods…`} className="h-10 pl-9 bg-background/60" />
        </div>
        <FloatingSelect label="Food group" value={group} onValueChange={setGroup}>
          <SelectItem value="all">All groups</SelectItem>
          {sortLabels(GROUPS).map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
        </FloatingSelect>
        <FloatingSelect label="Status" value={status} onValueChange={setStatus}>
          <SelectItem value="all">Any status</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="retired">Retired</SelectItem>
        </FloatingSelect>
        {drafts.length > 0 && <Button variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400" onClick={approve}><CheckCircle2 className="h-4 w-4" /> Approve {drafts.length} drafts</Button>}
        <Button onClick={() => open()}><Plus className="h-4 w-4" /> Add food</Button>
      </div>
      <p className="text-xs text-muted-foreground">{shown.length} shown · {foods.filter((f) => f.reviewStatus === "approved" && f.active).length} in use · {foods.filter((f) => f.reviewStatus === "draft").length} awaiting review</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {shown.map((f) => {
          const r = parseRule(f.appliesTo);
          const good = [...(r.good?.conditions || []).map((k) => conditions.find((c) => c.key === k)?.label ?? k), ...(r.good?.symptoms || [])];
          const bad = [...(r.avoid?.conditions || []).map((k) => conditions.find((c) => c.key === k)?.label ?? k), ...(r.avoid?.symptoms || [])];
          return (
            <Card key={f.id} className={cn("overflow-hidden border-border/50 bg-card/60 p-0 gap-0", !f.active && "opacity-50")}>
              <div className="relative h-40 w-full shrink-0 overflow-hidden bg-muted">
                {f.imageUrl
                  ? <img src={f.imageUrl} alt={f.label} title={f.imageCredit || undefined} loading="lazy" className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center text-muted-foreground"><Utensils className="h-8 w-8" /></div>}
                <Badge variant="outline" className={cn("absolute left-2 top-2 text-[10px] capitalize backdrop-blur", STATUS[f.reviewStatus])}>{f.reviewStatus}</Badge>
                {f.foodMizaj && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{f.foodMizaj}</span>}
              </div>
              <div className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{f.label}</p>
                    <p className="text-[11px] text-muted-foreground">{f.category || "No group"}</p>
                  </div>
                  <span className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => open(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Switch checked={f.active} onCheckedChange={(v) => patch(f.id, { active: v })} />
                  </span>
                </div>
                {f.description && <p className="text-xs text-muted-foreground line-clamp-2">{f.description}</p>}
                {good.length > 0 && <p className="text-[11px] text-emerald-700 dark:text-emerald-400 line-clamp-1" title={good.join(", ")}>✓ {good.join(", ")}</p>}
                {bad.length > 0 && <p className="text-[11px] text-destructive line-clamp-1" title={bad.join(", ")}>✕ {bad.join(", ")}</p>}
                {f.reviewStatus === "draft" && <Button size="sm" variant="outline" className="h-7 w-full border-emerald-500/40 text-emerald-700 dark:text-emerald-400" onClick={() => patch(f.id, { reviewStatus: "approved" })}>Approve</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit food" : "Add food"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4 pt-2">
              <div className="grid md:grid-cols-[220px_1fr] gap-4">
                <div className="space-y-2">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border/50 bg-muted">
                    {draft.imageUrl ? <img src={draft.imageUrl} alt={draft.label} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>}
                  </div>
                  {draft.imageCredit && <p className="text-[11px] text-muted-foreground">{draft.imageCredit}{draft.imageSource && <> · <a href={draft.imageSource} target="_blank" rel="noreferrer" className="text-primary hover:underline">source</a></>}</p>}
                  {draft.imageUrl && <button type="button" onClick={() => setDraft({ ...draft, imageUrl: null, imageCredit: null, imageSource: null })} className="text-xs text-destructive hover:underline">Remove photo</button>}
                </div>
                <div className="space-y-3">
                  <FloatingField id="gzLabel" label="Food (English · Unani / Urdu name)" required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                  <FloatingField id="gzDesc" label="Properties (shown to the doctor)" maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  <div className="grid sm:grid-cols-4 gap-3 pt-1">
                    <FloatingSelect id="gzGroup" label="Food group" value={draft.category || GROUPS[0]} onValueChange={(v) => setDraft({ ...draft, category: v })}>{sortLabels(GROUPS).map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</FloatingSelect>
                    <FloatingSelect id="gzHot" label="Hot / cold" value={draft.hot || "none"} onValueChange={(v) => setDraft({ ...draft, hot: v === "none" ? "" : v })}>
                      <SelectItem value="none">Balanced</SelectItem><SelectItem value="Haar">Haar (hot)</SelectItem><SelectItem value="Barid">Barid (cold)</SelectItem>
                    </FloatingSelect>
                    <FloatingSelect id="gzMoist" label="Moist / dry" value={draft.moist || "none"} onValueChange={(v) => setDraft({ ...draft, moist: v === "none" ? "" : v })}>
                      <SelectItem value="none">Balanced</SelectItem><SelectItem value="Ratab">Ratab (moist)</SelectItem><SelectItem value="Yabis">Yabis (dry)</SelectItem>
                    </FloatingSelect>
                    <FloatingSelect id="gzDeg" label="Degree (Darja)" value={String(draft.degree)} onValueChange={(v) => setDraft({ ...draft, degree: Number(v) })}>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</FloatingSelect>
                  </div>
                  <div className="flex gap-2">
                    <Input value={photoQ} onChange={(e) => setPhotoQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPhotos(); } }} placeholder="Find a real photo — e.g. dried figs" className="h-9 bg-background/60" />
                    <Button size="sm" variant="outline" onClick={searchPhotos} disabled={searching}>{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Find photo</Button>
                  </div>
                  {photos && (
                    photos.length ? (
                      <div className="grid grid-cols-4 gap-2">
                        {photos.map((ph) => (
                          <button key={ph.url} type="button" title={`${ph.title}\n${ph.credit}`} onClick={() => setDraft({ ...draft, imageUrl: ph.url, imageCredit: ph.credit, imageSource: ph.source })}
                            className={cn("aspect-square overflow-hidden rounded-lg border-2", draft.imageUrl === ph.url ? "border-primary" : "border-transparent hover:border-primary/50")}>
                            <img src={ph.url} alt={ph.title} loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">No freely-licensed photos found — try other words.</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">Photos come from Wikimedia Commons under free licences; the author and licence are saved with the food.</p>
                </div>
              </div>

              {([["good", "Good for — recommend when", "primary"], ["avoid", "Avoid (Parhez) when", "danger"]] as const).map(([which, title, tone]) => (
                <div key={which} className={cn("rounded-xl border p-3.5 space-y-3", which === "good" ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5")}>
                  <p className={cn("text-sm font-semibold", which === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>{title}</p>
                  <div><p className="text-xs font-semibold text-muted-foreground mb-1.5">Health conditions (from the patient&apos;s history)</p>
                    <Chips tone={tone} items={conditions} selected={draft.rule[which]?.conditions || []} onToggle={(k) => toggleIn(which, "conditions", k)} /></div>
                  <FloatingMultiSelect id={`gz-${which}-sym`} label="Symptoms or complaints (words to match)" openOnFocus tone={which === "avoid" ? "destructive" : "primary"}
                    selected={(draft.rule[which]?.symptoms || []).map((x) => ({ id: x, label: x }))}
                    onRemove={(x) => setSide(which, { symptoms: (draft.rule[which]?.symptoms || []).filter((y) => y !== x) })}
                    query={which === "good" ? ms.goodSym : ms.avoidSym} onQueryChange={(v) => setMs((m) => ({ ...m, [which === "good" ? "goodSym" : "avoidSym"]: v }))}
                    results={symptoms.filter((s) => !(draft.rule[which]?.symptoms || []).includes(s) && (!(which === "good" ? ms.goodSym : ms.avoidSym).trim() || s.toLowerCase().includes((which === "good" ? ms.goodSym : ms.avoidSym).trim().toLowerCase()))).slice(0, 10).map((s) => ({ id: s, label: s }))}
                    onPick={(x) => setSide(which, { symptoms: [...(draft.rule[which]?.symptoms || []), x] })}
                    onCreate={(t) => setSide(which, { symptoms: [...(draft.rule[which]?.symptoms || []), t.toLowerCase()] })} createLabel={(t) => `Match the word "${t}"`}
                    placeholder="e.g. constipation, cough, burning…" />
                  <div><p className="text-xs font-semibold text-muted-foreground mb-1.5">Affected organs</p>
                    <Chips tone={tone} items={organs.map((o) => ({ key: o, label: o }))} selected={draft.rule[which]?.organs || []} onToggle={(k) => toggleIn(which, "organs", k)} /></div>
                </div>
              ))}

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Always Parhez for these allergies</p>
                <FloatingMultiSelect id="gz-allergens" label="Allergens in this food" openOnFocus tone="destructive"
                  selected={(draft.rule.allergens || []).map((x) => ({ id: x, label: x }))}
                  onRemove={(x) => setDraft({ ...draft, rule: { ...draft.rule, allergens: (draft.rule.allergens || []).filter((y) => y !== x) } })}
                  query={ms.allergen} onQueryChange={(v) => setMs((m) => ({ ...m, allergen: v }))}
                  results={allergies.filter((a) => !(draft.rule.allergens || []).includes(a) && (!ms.allergen.trim() || a.toLowerCase().includes(ms.allergen.trim().toLowerCase()))).slice(0, 10).map((a) => ({ id: a, label: a }))}
                  onPick={(x) => setDraft({ ...draft, rule: { ...draft.rule, allergens: [...(draft.rule.allergens || []), x] } })} placeholder="e.g. Milk & Dairy, Peanut…" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">Heavy (Ghaleez) — avoid with weak digestion <Switch checked={!!draft.rule.heavy} onCheckedChange={(v) => setDraft({ ...draft, rule: { ...draft.rule, heavy: v || undefined } })} /></label>
                  <label className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">Wind-forming (Nafakh) — avoid with bloating <Switch checked={!!draft.rule.nafakh} onCheckedChange={(v) => setDraft({ ...draft, rule: { ...draft.rule, nafakh: v || undefined } })} /></label>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <FloatingSelect id="gzStatus" label="Review status" value={draft.reviewStatus} onValueChange={(v) => setDraft({ ...draft, reviewStatus: v })}>
                  <SelectItem value="draft">Draft — awaiting review</SelectItem>
                  <SelectItem value="approved">Approved — used by the engine</SelectItem>
                  <SelectItem value="retired">Retired — never used</SelectItem>
                </FloatingSelect>
                <label className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 text-sm h-14">Food enabled <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} /></label>
              </div>
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
