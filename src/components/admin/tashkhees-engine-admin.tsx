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
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Save, Sparkles } from "lucide-react";

interface Config {
  weights: { complaints: number; asbab: number; dalail: number };
  constitutionalSections: string[];
  minEvidence: number; balancedMargin: number; darjaBands: [number, number, number];
  severityBoost: boolean; maddiThreshold: number; maxOrgans: number; ranking: boolean;
}
interface Section { key: string; label: string; english: string; framework: string }
interface MaddiSection { section: string; sectionLabel: string; questions: { id: string; label: string; reviewStatus: string; options: { id: string; label: string; maddi: number }[] }[] }
interface Organ { id: string; label: string; localName: string | null; description: string | null; appliesTo: string; priority: number; active: boolean }
interface Applies { categories?: string[]; complaints?: string[]; symptoms?: string[]; regions?: string[]; sex?: "male" | "female" }
interface Masters { categories: string[]; complaints: { key: string; label: string; category: string }[]; symptoms: string[]; regions: string[] }
const parseApplies = (raw: string): Applies => { try { return JSON.parse(raw || "{}") || {}; } catch { return {}; } };

function Block({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card className="p-5 border-border/50 bg-card/60 gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-base font-semibold">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground max-w-3xl">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

function Num({ label, value, onChange, step = 1, min, max, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <Input type="number" step={step} min={min} max={max} value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-20 bg-background/60 text-right" />
        {suffix && <span className="text-xs text-muted-foreground w-6">{suffix}</span>}
      </span>
    </label>
  );
}

/**
 * Admin → Meta → Tashkhees & Ilaj → Tashkhees Engine: everything the Stage 5
 * diagnosis engine uses — how much each humoral reading counts, which sections
 * describe the constitution, the balance / Darja thresholds, the morbid-matter
 * (Maddi) signs and the organ links.
 */
export function TashkheesEngineAdmin() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [defaults, setDefaults] = useState<Config | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [maddi, setMaddi] = useState<MaddiSection[]>([]);
  const [maddiEdits, setMaddiEdits] = useState<Record<string, number>>({});
  const [organs, setOrgans] = useState<Organ[]>([]);
  const [masters, setMasters] = useState<Masters | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  // id null = a new organ. Name, meaning and on/off live here too (moved from Option Lists).
  const [organDraft, setOrganDraft] = useState<{ organ: Organ; label: string; localName: string; description: string; applies: Applies; priority: number } | null>(null);
  const [q, setQ] = useState({ complaints: "", symptoms: "", regions: "" });

  const load = () => adminApi.get<{ config: Config; defaults: Config; sections: Section[]; maddi: MaddiSection[]; organs: Organ[] }>("/api/admin/tashkhees-engine")
    .then((r) => { setCfg(r.config); setDefaults(r.defaults); setSections(r.sections); setMaddi(r.maddi); setOrgans(r.organs); setMaddiEdits({}); })
    .catch((e) => toast.error(e.message || "Could not load the engine settings"));
  useEffect(() => {
    load();
    adminApi.get<Masters>("/api/admin/asbab/selection-masters").then(setMasters).catch(() => {});
  }, []);

  if (!cfg) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  const setC = (patch: Partial<Config>) => setCfg((c) => (c ? { ...c, ...patch } : c));

  const saveConfig = async () => {
    setSaving(true);
    try {
      const r = await adminApi.put<{ config: Config }>("/api/admin/tashkhees-engine", { config: cfg });
      setCfg(r.config);
      const changed = Object.entries(maddiEdits).map(([id, m]) => ({ id, maddi: m }));
      if (changed.length) await adminApi.patch("/api/admin/tashkhees-engine", { maddi: changed });
      toast.success("Engine settings saved");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally { setSaving(false); }
  };
  const saveOrgan = async () => {
    if (!organDraft) return;
    const name = { label: organDraft.label.trim(), localName: organDraft.localName.trim(), description: organDraft.description.trim() };
    if (!name.label) { toast.error("Enter the organ's name"); return; }
    try {
      let id = organDraft.organ.id;
      if (!id) id = (await adminApi.post<{ option: { id: string } }>("/api/admin/tashkhees-options", { ...name, list: "organ" })).option.id;
      else await adminApi.patch(`/api/admin/tashkhees-options/${id}`, { ...name, active: organDraft.organ.active });
      await adminApi.patch(`/api/admin/tashkhees-engine/organs/${id}`, { appliesTo: organDraft.applies, priority: organDraft.priority });
      toast.success(organDraft.organ.id ? "Organ saved" : "Organ added");
      setOrganDraft(null);
      load();
    } catch (e: any) { toast.error(e.message || "Could not save"); }
  };
  const toggleOrgan = async (o: Organ) => {
    try { await adminApi.patch(`/api/admin/tashkhees-options/${o.id}`, { active: !o.active }); load(); }
    catch (e: any) { toast.error(e.message || "Could not update"); }
  };
  const openOrgan = (o?: Organ) => {
    setQ({ complaints: "", symptoms: "", regions: "" });
    const organ = o ?? { id: "", label: "", description: null, appliesTo: "{}", priority: 3, active: true, localName: null };
    setOrganDraft({ organ, label: organ.label, localName: organ.localName || "", description: organ.description || "", applies: parseApplies(organ.appliesTo), priority: organ.priority });
  };
  const summary = (raw: string) => {
    const a = parseApplies(raw);
    const parts = [...(a.categories || []), ...(a.complaints || []).map((k) => masters?.complaints.find((c) => c.key === k)?.label ?? k), ...(a.symptoms || []), ...(a.regions || [])];
    return parts.length ? parts.slice(0, 5).join(" · ") + (parts.length > 5 ? ` +${parts.length - 5}` : "") : "Not linked — never suggested";
  };
  const maddiCount = maddi.reduce((n, s) => n + s.questions.reduce((m, qq) => m + qq.options.filter((o) => (maddiEdits[o.id] ?? o.maddi) > 0).length, 0), 0);
  const setOA = (patch: Partial<Applies>) => setOrganDraft((d) => (d ? { ...d, applies: { ...d.applies, ...patch } } : d));

  return (
    <div className="space-y-5">
      <Card className="p-4 border-primary/25 bg-primary/5 flex-row items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-primary">How the Tashkhees engine works</p>
          <p className="text-muted-foreground"><b className="text-foreground">Mizaj-e-Asli</b> comes from the constitutional sections below. <b className="text-foreground">Su-e-Mizaj</b> blends the three humoral readings (weighted below; a reading with few answers counts for less) — a clear lead gives Damawi / Safrawi / Balghami / Saudawi, a lead on one axis gives Haar / Barid / Ratab / Yabis, otherwise Mu&apos;tadil. <b className="text-foreground">Maddi</b> is suggested when the morbid-matter signs add up to the threshold; <b className="text-foreground">Darja</b> follows how strongly one humour leads. <b className="text-foreground">Organs</b> come from their links. Every suggestion shows its evidence and is only applied when the Hakim accepts it.</p>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Block title="Humoral readings — how much each counts" hint="Weight 0 switches a reading off. Applies to Su-e-Mizaj.">
          <div className="space-y-2">
            <Num label="Complaints (Stages 2–3)" value={cfg.weights.complaints} step={0.25} min={0} max={3} onChange={(v) => setC({ weights: { ...cfg.weights, complaints: v } })} suffix="×" />
            <Num label="Asbab-e-Sittah lifestyle (Stage 4)" value={cfg.weights.asbab} step={0.25} min={0} max={3} onChange={(v) => setC({ weights: { ...cfg.weights, asbab: v } })} suffix="×" />
            <Num label="Dala'il clinical signs (Stage 5)" value={cfg.weights.dalail} step={0.25} min={0} max={3} onChange={(v) => setC({ weights: { ...cfg.weights, dalail: v } })} suffix="×" />
          </div>
        </Block>

        <Block title="Thresholds" hint="Leads are in percentage points between the top two humours.">
          <div className="space-y-2">
            <Num label="Minimum evidence before suggesting" value={cfg.minEvidence} min={0} max={30} onChange={(v) => setC({ minEvidence: v })} suffix="pts" />
            <Num label="Balanced (Mu'tadil) below a lead of" value={cfg.balancedMargin} min={1} max={50} onChange={(v) => setC({ balancedMargin: v })} suffix="%" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <Num key={i} label={`Darja ${i + 2} from`} value={cfg.darjaBands[i]} min={1} max={90}
                  onChange={(v) => { const b = [...cfg.darjaBands] as [number, number, number]; b[i] = v; setC({ darjaBands: b }); }} suffix="%" />
              ))}
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
              <span>One Darja higher when the main complaint is severe (7/10+)</span>
              <Switch checked={cfg.severityBoost} onCheckedChange={(v) => setC({ severityBoost: v })} />
            </label>
          </div>
        </Block>
      </div>

      <Block title="Mizaj-e-Asli — constitutional sections" hint="Only answers in these sections are used to suggest the baseline temperament.">
        {(["dalail", "asbab"] as const).map((fw) => (
          <div key={fw}>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">{fw === "dalail" ? "Dala'il examination (Stage 5)" : "Asbab-e-Sittah (Stage 4)"}</p>
            <div className="flex flex-wrap gap-1.5">
              {sections.filter((s) => s.framework === fw).map((s) => {
                const on = cfg.constitutionalSections.includes(s.key);
                return (
                  <button key={s.key} type="button" title={s.english}
                    onClick={() => setC({ constitutionalSections: on ? cfg.constitutionalSections.filter((x) => x !== s.key) : [...cfg.constitutionalSections, s.key] })}
                    className={cn("rounded-full border px-3 py-1 text-xs transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/40")}>{s.label}</button>
                );
              })}
            </div>
          </div>
        ))}
      </Block>

      <Block title="Su-e-Mizaj — Sada or Maddi" hint="Give a weight to findings that indicate morbid matter (Madda). When the patient's findings add up to the threshold, Maddi is suggested; otherwise Sada."
        right={<Badge variant="outline">{maddiCount} signs weighted</Badge>}>
        <Num label="Suggest Maddi when the signs add up to" value={cfg.maddiThreshold} step={0.5} min={0.5} max={20} onChange={(v) => setC({ maddiThreshold: v })} />
        <div className="space-y-1.5">
          {maddi.map((s) => {
            const isOpen = !!open[s.section];
            const count = s.questions.reduce((m, qq) => m + qq.options.filter((o) => (maddiEdits[o.id] ?? o.maddi) > 0).length, 0);
            return (
              <div key={s.section} className="rounded-lg border border-border/50 bg-background/40">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [s.section]: !isOpen }))} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                  <span className="flex items-center gap-1.5">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{s.sectionLabel}</span>
                  <span className="text-xs text-muted-foreground">{count} weighted</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border/40 px-3 py-2 space-y-3">
                    {s.questions.map((qq) => (
                      <div key={qq.id}>
                        <p className="text-sm font-medium">{qq.label}{qq.reviewStatus !== "approved" && <span className="ml-1.5 text-[10px] uppercase text-amber-600">{qq.reviewStatus}</span>}</p>
                        <div className="mt-1 grid sm:grid-cols-2 gap-1.5">
                          {qq.options.map((o) => (
                            <label key={o.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-2.5 py-1 text-xs">
                              <span className="truncate" title={o.label}>{o.label}</span>
                              <Input type="number" step={0.5} min={0} max={5} value={String(maddiEdits[o.id] ?? o.maddi)} onChange={(e) => setMaddiEdits((m) => ({ ...m, [o.id]: Number(e.target.value) }))}
                                className={cn("h-7 w-16 text-right bg-background/60", (maddiEdits[o.id] ?? o.maddi) > 0 && "border-amber-500/50")} />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Block>

      <Block title="Udw-e-Mutathir — organs" hint="The organ list the doctor chooses from, and when each organ is suggested — when the patient's complaints, complaint categories, other symptoms or body regions match its links."
        right={
          <span className="flex items-center gap-3 text-sm flex-wrap">
            <Button size="sm" onClick={() => openOrgan()}><Plus className="h-3.5 w-3.5" /> Add organ</Button>
            <label className="flex items-center gap-2">Max organs suggested <Input type="number" min={1} max={10} value={String(cfg.maxOrgans)} onChange={(e) => setC({ maxOrgans: Number(e.target.value) })} className="h-8 w-16 bg-background/60" /></label>
            <label className="flex items-center gap-2">Order with Hakeem Insight <Switch checked={cfg.ranking} onCheckedChange={(v) => setC({ ranking: v })} /></label>
          </span>
        }>
        <div className="grid md:grid-cols-2 gap-2">
          {organs.map((o) => (
            <div key={o.id} className={cn("flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2", !o.active && "opacity-50")}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{o.label}{o.localName && <span className="ml-1 text-xs font-normal text-muted-foreground">{o.localName}</span>}{o.description && <span className="text-xs font-normal text-muted-foreground"> · {o.description}</span>}<span className="ml-1.5 text-[11px] text-muted-foreground">priority {o.priority}</span></p>
                <p className="text-xs text-muted-foreground truncate" title={summary(o.appliesTo)}>{summary(o.appliesTo)}</p>
              </div>
              <span className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openOrgan(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Switch checked={o.active} onCheckedChange={() => toggleOrgan(o)} aria-label={o.active ? "Switch off" : "Switch on"} />
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Switching an organ off hides it from new diagnoses; organs already recorded on visits are kept.</p>
      </Block>

      <div className="sticky bottom-3 z-10 flex justify-end gap-2">
        {defaults && <Button variant="outline" onClick={() => setCfg(defaults)}>Restore default settings</Button>}
        <Button onClick={saveConfig} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save engine settings</Button>
      </div>

      <Dialog open={organDraft !== null} onOpenChange={(o) => { if (!o) setOrganDraft(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{organDraft?.organ.id ? `Organ · ${organDraft.organ.label}` : "Add organ"}</DialogTitle></DialogHeader>
          {organDraft && masters && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <FloatingField id="orgLabel" label="Organ (Unani name)" required value={organDraft.label} onChange={(e) => setOrganDraft((d) => d && { ...d, label: e.target.value })} />
                <FloatingField id="orgLocal" label="Urdu / Arabic (optional)" value={organDraft.localName} onChange={(e) => setOrganDraft((d) => d && { ...d, localName: e.target.value })} />
                <FloatingField id="orgDesc" label="English meaning" value={organDraft.description} onChange={(e) => setOrganDraft((d) => d && { ...d, description: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <FloatingSelect id="orgPriority" label="Priority" value={String(organDraft.priority)} onValueChange={(v) => setOrganDraft((d) => d && { ...d, priority: Number(v) })}>
                  {[5, 4, 3, 2, 1].map((x) => <SelectItem key={x} value={String(x)}>{x} — {["", "Low", "Below average", "Average", "High", "Very high"][x]}</SelectItem>)}
                </FloatingSelect>
                <FloatingSelect id="orgSex" label="Patients" value={organDraft.applies.sex || "any"} onValueChange={(v) => setOA({ sex: v === "any" ? undefined : (v as "male" | "female") })}>
                  <SelectItem value="any">Any sex</SelectItem>
                  <SelectItem value="female">Women only</SelectItem>
                  <SelectItem value="male">Men only</SelectItem>
                </FloatingSelect>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Complaint categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {masters.categories.map((c) => {
                    const on = (organDraft.applies.categories || []).includes(c);
                    return <button key={c} type="button" onClick={() => setOA({ categories: on ? (organDraft.applies.categories || []).filter((x) => x !== c) : [...(organDraft.applies.categories || []), c] })}
                      className={cn("rounded-full border px-2.5 py-0.5 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/40")}>{c}</button>;
                  })}
                </div>
              </div>
              <FloatingMultiSelect id="orgComplaints" label="Specific complaints" openOnFocus
                selected={(organDraft.applies.complaints || []).map((k) => ({ id: k, label: masters.complaints.find((c) => c.key === k)?.label ?? k }))}
                onRemove={(k) => setOA({ complaints: (organDraft.applies.complaints || []).filter((x) => x !== k) })}
                query={q.complaints} onQueryChange={(v) => setQ((x) => ({ ...x, complaints: v }))}
                results={masters.complaints.filter((c) => !(organDraft.applies.complaints || []).includes(c.key) && (!q.complaints.trim() || c.label.toLowerCase().includes(q.complaints.trim().toLowerCase()))).slice(0, 12).map((c) => ({ id: c.key, label: c.label }))}
                onPick={(k) => setOA({ complaints: [...(organDraft.applies.complaints || []), k] })} placeholder="Type a complaint…" />
              <FloatingMultiSelect id="orgSymptoms" label="Other symptoms" openOnFocus
                selected={(organDraft.applies.symptoms || []).map((x) => ({ id: x, label: x }))}
                onRemove={(x) => setOA({ symptoms: (organDraft.applies.symptoms || []).filter((y) => y !== x) })}
                query={q.symptoms} onQueryChange={(v) => setQ((x) => ({ ...x, symptoms: v }))}
                results={masters.symptoms.filter((x) => !(organDraft.applies.symptoms || []).includes(x) && (!q.symptoms.trim() || x.toLowerCase().includes(q.symptoms.trim().toLowerCase()))).slice(0, 12).map((x) => ({ id: x, label: x }))}
                onPick={(x) => setOA({ symptoms: [...(organDraft.applies.symptoms || []), x] })} placeholder="Type a symptom…" />
              <FloatingMultiSelect id="orgRegions" label="Body regions" openOnFocus
                selected={(organDraft.applies.regions || []).map((x) => ({ id: x, label: x }))}
                onRemove={(x) => setOA({ regions: (organDraft.applies.regions || []).filter((y) => y !== x) })}
                query={q.regions} onQueryChange={(v) => setQ((x) => ({ ...x, regions: v }))}
                results={masters.regions.filter((x) => !(organDraft.applies.regions || []).includes(x) && (!q.regions.trim() || x.toLowerCase().includes(q.regions.trim().toLowerCase()))).slice(0, 12).map((x) => ({ id: x, label: x }))}
                onPick={(x) => setOA({ regions: [...(organDraft.applies.regions || []), x] })} placeholder="Type a region…" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrganDraft(null)}>Cancel</Button>
            <Button onClick={saveOrgan}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
