"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { useUrlParam } from "@/hooks/use-url-param";
import { cn } from "@/lib/utils";
import { AKHLAT, QUESTION_TYPES, pillarIcon, type AsbabAnswer, type AsbabQuestionCfg } from "@/lib/asbab";
import { QuestionCard } from "@/components/facility/views/asbab-assessment";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingMultiSelect, FloatingSelect } from "@/components/shared/floating-field";
import { CheckCircle2, ChevronDown, ChevronUp, GitBranch, Loader2, Pencil, Plus, ShieldAlert, Sparkles, Trash2 } from "lucide-react";

interface Option { id?: string; label: string; description: string | null; safra: number; dam: number; balgham: number; sauda: number; active: boolean }
interface Question {
  id: string; pillarId: string; label: string; labelLocal: string | null; helpText: string | null; type: string; required: boolean;
  weight: number; showIfQuestionId: string | null; showIfOption: string | null; sortOrder: number; active: boolean; version: number; options: Option[];
  // Adaptive selection (Dala'il)
  appliesTo: string; priority: number; safetyCritical: boolean; reviewStatus: string; purpose: string | null; reference: string | null;
}
interface Applies { always?: boolean; categories?: string[]; complaints?: string[]; symptoms?: string[]; regions?: string[]; sex?: "male" | "female"; minAge?: number; maxAge?: number }
interface Masters { categories: string[]; complaints: { key: string; label: string; category: string }[]; symptoms: string[]; regions: string[] }
const parseApplies = (raw: string | undefined): Applies => { try { return JSON.parse(raw || "{}") || {}; } catch { return {}; } };
const REVIEW_STYLES: Record<string, string> = {
  draft: "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10",
  approved: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  retired: "border-border/60 text-muted-foreground",
};
interface Pillar { id: string; key: string; label: string; english: string; description: string | null; sortOrder: number; active: boolean; questions: Question[] }

type Draft = Omit<Question, "id" | "pillarId" | "sortOrder" | "version" | "appliesTo"> & { id: string | null; applies: Applies };

const blankOption = (): Option => ({ label: "", description: null, safra: 0, dam: 0, balgham: 0, sauda: 0, active: true });
const blankDraft = (): Draft => ({
  id: null, label: "", labelLocal: "", helpText: "", type: "single_select", required: false, weight: 1,
  showIfQuestionId: null, showIfOption: null, active: true, options: [blankOption(), blankOption()],
  applies: {}, priority: 3, safetyCritical: false, reviewStatus: "draft", purpose: "", reference: "",
});
const typeLabel = (t: string) => QUESTION_TYPES.find((x) => x.value === t)?.label ?? t;
const isChoice = (t: string) => t === "single_select" || t === "multi_select";

function PillarIcon({ pillarKey, className }: { pillarKey: string; className?: string }) {
  return createElement(pillarIcon(pillarKey), { className });
}

/**
 * Admin → Meta → Asbab-e-Sittah. The six pillars are fixed (edit wording,
 * order, enable/disable — never delete); questions and their options with
 * Safra/Dam/Balgham/Sauda points are fully managed here and drive Stage 4.
 */
export function AsbabAdmin({ framework = "asbab" }: { framework?: "asbab" | "dalail" } = {}) {
  const words = framework === "dalail"
    ? { sections: "Examination Sections", section: "Section", fixedNote: "Sections can be renamed, reordered or disabled, but not removed." }
    : { sections: "Six Pillars", section: "Pillar", fixedNote: "The six pillars are fixed by the classical framework — they can be renamed, reordered or disabled, but not removed." };
  const [pillars, setPillars] = useState<Pillar[] | null>(null);
  // The open section lives in the URL (?section=<key>) so each has its own link.
  const [sectionKey, setSectionKey] = useUrlParam<string>("section", "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pillarDraft, setPillarDraft] = useState<{ id: string; label: string; english: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewAnswer, setPreviewAnswer] = useState<AsbabAnswer | undefined>(undefined);
  const isDalail = framework === "dalail";
  // Lists a Dala'il question can be linked to, and the selection settings.
  const [masters, setMasters] = useState<Masters | null>(null);
  const [linkQuery, setLinkQuery] = useState<{ complaints: string; symptoms: string; regions: string }>({ complaints: "", symptoms: "", regions: "" });
  const [cap, setCap] = useState("7");
  const [ranking, setRanking] = useState(true);
  useEffect(() => {
    if (!isDalail) return;
    adminApi.get<Masters>("/api/admin/asbab/selection-masters").then(setMasters).catch(() => {});
    adminApi.get<{ settings: { category: string; key: string; value: string }[] }>("/api/admin/settings").then((r) => {
      const get = (k: string) => r.settings.find((x) => x.category === "dalail" && x.key === k)?.value;
      if (get("max_questions")) setCap(get("max_questions")!);
      setRanking(get("ranking") !== "off");
    }).catch(() => {});
  }, [isDalail]);
  const saveSetting = async (key: string, value: string) => {
    try { await adminApi.put("/api/admin/settings", { updates: [{ category: "dalail", key, value }] }); toast.success("Saved"); }
    catch (e: any) { toast.error(e.message || "Could not save"); }
  };
  const setReview = async (q: Question, reviewStatus: string) => {
    try { await adminApi.patch(`/api/admin/asbab/questions/${q.id}`, { reviewStatus }); load(); }
    catch (e: any) { toast.error(e.message || "Could not update the question"); }
  };
  const approveAll = async (ids: string[]) => {
    if (!ids.length || !window.confirm(`Approve ${ids.length} draft question${ids.length === 1 ? "" : "s"}? Only approve after a qualified Unani physician has reviewed the wording, options and humoral points.`)) return;
    try { const r = await adminApi.post<{ approved: number }>("/api/admin/asbab/questions/approve", { ids }); toast.success(`${r.approved} approved`); load(); }
    catch (e: any) { toast.error(e.message || "Could not approve"); }
  };

  const load = () => adminApi.get<{ pillars: Pillar[] }>(`/api/admin/asbab?framework=${framework}`)
    .then((r) => setPillars(r.pillars))
    .catch((e) => toast.error(e.message || "Could not load Asbab-e-Sittah"));
  useEffect(() => { load(); }, []);

  const active = pillars?.find((p) => p.key === sectionKey) ?? pillars?.[0] ?? null;

  const patchPillar = async (id: string, body: Record<string, unknown>) => {
    try { await adminApi.patch(`/api/admin/asbab/pillars/${id}`, body); await load(); }
    catch (e: any) { toast.error(e.message || "Could not update the pillar"); }
  };
  const movePillar = async (i: number, d: -1 | 1) => {
    if (!pillars || !pillars[i + d]) return;
    const order = [...pillars];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await Promise.all(order.map((p, n) => (p.sortOrder === n ? null : adminApi.patch(`/api/admin/asbab/pillars/${p.id}`, { sortOrder: n }))));
    load();
  };
  const moveQuestion = async (i: number, d: -1 | 1) => {
    if (!active || !active.questions[i + d]) return;
    const order = [...active.questions];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await Promise.all(order.map((q, n) => (q.sortOrder === n ? null : adminApi.patch(`/api/admin/asbab/questions/${q.id}`, { sortOrder: n }))));
    load();
  };
  const toggleQuestion = async (q: Question) => {
    try { await adminApi.patch(`/api/admin/asbab/questions/${q.id}`, { active: !q.active }); load(); }
    catch (e: any) { toast.error(e.message || "Could not update the question"); }
  };

  const openQuestion = (q?: Question) => {
    setPreviewAnswer(undefined);
    setLinkQuery({ complaints: "", symptoms: "", regions: "" });
    setDraft(q ? {
      ...q, labelLocal: q.labelLocal || "", helpText: q.helpText || "", options: q.options.map((o) => ({ ...o })),
      applies: parseApplies(q.appliesTo), purpose: q.purpose || "", reference: q.reference || "",
    } : { ...blankDraft(), reviewStatus: isDalail ? "draft" : "approved" });
  };
  const setD = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setOpt = (i: number, patch: Partial<Option>) => setDraft((d) => (d ? { ...d, options: d.options.map((o, n) => (n === i ? { ...o, ...patch } : o)) } : d));
  const moveOpt = (i: number, dir: -1 | 1) => setDraft((d) => {
    if (!d || !d.options[i + dir]) return d;
    const o = [...d.options];
    [o[i], o[i + dir]] = [o[i + dir], o[i]];
    return { ...d, options: o };
  });

  const saveQuestion = async () => {
    if (!draft || !active) return;
    setSaving(true);
    try {
      const { applies, ...rest } = draft;
      const body = { ...rest, pillarId: active.id, options: isChoice(draft.type) ? draft.options : [], ...(isDalail ? { appliesTo: applies } : {}) };
      if (draft.id) await adminApi.patch(`/api/admin/asbab/questions/${draft.id}`, body);
      else await adminApi.post("/api/admin/asbab/questions", body);
      toast.success(draft.id ? "Question updated" : "Question added");
      setDraft(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save the question");
    } finally {
      setSaving(false);
    }
  };

  const savePillar = async () => {
    if (!pillarDraft) return;
    setSaving(true);
    try {
      await adminApi.patch(`/api/admin/asbab/pillars/${pillarDraft.id}`, { label: pillarDraft.label, english: pillarDraft.english, description: pillarDraft.description });
      setPillarDraft(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save the pillar");
    } finally {
      setSaving(false);
    }
  };

  // Questions in this pillar a new/edited question can depend on ("show only if").
  const parentChoices = useMemo(
    () => (active?.questions || []).filter((q) => isChoice(q.type) && q.id !== draft?.id),
    [active, draft?.id],
  );
  const parent = parentChoices.find((q) => q.id === draft?.showIfQuestionId);

  // Live preview — rendered with the doctor's own question card.
  const preview: AsbabQuestionCfg | null = draft && draft.label.trim() ? {
    id: "preview", label: draft.label, labelLocal: draft.labelLocal || null, helpText: draft.helpText || null, type: draft.type,
    required: draft.required, weight: draft.weight, showIfQuestionId: null, showIfOption: null, version: 1,
    options: isChoice(draft.type) ? draft.options.filter((o) => o.active && o.label.trim()).map((o, i) => ({ ...o, id: `p${i}` })) : [],
  } : null;

  if (!pillars) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const setA = (patch: Partial<Applies>) => setDraft((d) => (d ? { ...d, applies: { ...d.applies, ...patch } } : d));
  const drafts = (active?.questions || []).filter((q) => q.reviewStatus === "draft").map((q) => q.id);
  const linkSummary = (raw: string) => {
    const a = parseApplies(raw);
    const parts = [a.always && "Every patient", ...(a.categories || []), ...(a.complaints || []).map((k) => masters?.complaints.find((c) => c.key === k)?.label ?? k), ...(a.symptoms || []), ...(a.regions || [])].filter(Boolean) as string[];
    return parts.length ? parts.slice(0, 4).join(" · ") + (parts.length > 4 ? ` +${parts.length - 4}` : "") : "Not linked — shown only when a doctor adds it";
  };

  return (
    <div className="space-y-6">
    {isDalail && (
      <Card className="p-4 border-primary/25 bg-primary/5 flex-row flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-sm font-semibold flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /> Adaptive selection</p>
        <label className="flex items-center gap-2 text-sm">Questions per patient
          <Input type="number" min={3} max={25} value={cap} onChange={(e) => setCap(e.target.value)} onBlur={() => saveSetting("max_questions", String(Math.max(3, Math.min(25, Number(cap) || 7))))} className="h-8 w-20 bg-background/60" />
        </label>
        <label className="flex items-center gap-2 text-sm">Order with Hakeem Insight
          <Switch checked={ranking} onCheckedChange={(v) => { setRanking(v); saveSetting("ranking", v ? "on" : "off"); }} />
        </label>
        <p className="text-xs text-muted-foreground basis-full">Doctors see only <b>Approved</b> questions linked to the patient&apos;s complaints, symptoms or body regions (plus &ldquo;every patient&rdquo; core signs). Safety questions are always included. Drafts stay hidden until approved after clinical review.</p>
      </Card>
    )}
    <div className="grid md:grid-cols-[280px_1fr] gap-6">
      <Card className="p-3 border-border/50 bg-card/60 h-fit gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 pt-1 pb-2">{words.sections}</p>
        {pillars.map((p, i) => {
          const on = active?.id === p.id;
          const activeCount = p.questions.filter((q) => q.active).length;
          return (
            <div key={p.id} className={cn("flex items-center gap-1 rounded-lg", on ? "bg-primary text-primary-foreground" : "hover:bg-background/60")}>
              <div className="flex flex-col pl-1">
                <button disabled={i === 0} onClick={() => movePillar(i, -1)} className="disabled:opacity-20 opacity-70 hover:opacity-100"><ChevronUp className="h-3 w-3" /></button>
                <button disabled={i === pillars.length - 1} onClick={() => movePillar(i, 1)} className="disabled:opacity-20 opacity-70 hover:opacity-100"><ChevronDown className="h-3 w-3" /></button>
              </div>
              <button onClick={() => setSectionKey(i === 0 ? "" : p.key)} className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 text-left">
                <PillarIcon pillarKey={p.key} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium leading-snug", !p.active && "line-through opacity-60")}>{i + 1}. {p.label}</span>
                  <span className={cn("block text-[11px] leading-snug", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{p.english}</span>
                </span>
                <Badge variant={on ? "outline" : "secondary"} className={cn("shrink-0", on && "border-primary-foreground/40 text-primary-foreground")}>{activeCount}</Badge>
              </button>
            </div>
          );
        })}
      </Card>

      {active && (
        <Card className="p-6 border-border/50 bg-card/60">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary"><PillarIcon pillarKey={active.key} className="h-4.5 w-4.5" /></div>
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-semibold">{active.label} <span className="text-sm font-sans font-normal text-muted-foreground">· {active.english}</span></h2>
                {active.description && <p className="text-sm text-muted-foreground max-w-2xl">{active.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("text-xs font-medium", active.active ? "text-emerald-500" : "text-muted-foreground")}>{active.active ? `${words.section} enabled` : `${words.section} disabled`}</span>
              <Switch checked={active.active} onCheckedChange={(v) => patchPillar(active.id, { active: v })} />
              <Button size="sm" variant="outline" onClick={() => setPillarDraft({ id: active.id, label: active.label, english: active.english, description: active.description || "" })}><Pencil className="h-3.5 w-3.5" /> Edit {words.section.toLowerCase()}</Button>
              {isDalail && drafts.length > 0 && (
                <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400" onClick={() => approveAll(drafts)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve {drafts.length} draft{drafts.length === 1 ? "" : "s"}
                </Button>
              )}
              <Button size="sm" onClick={() => openQuestion()}><Plus className="h-3.5 w-3.5" /> Add Question</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {active.questions.map((q, i) => {
              const parentQ = q.showIfQuestionId ? active.questions.find((x) => x.id === q.showIfQuestionId) : null;
              return (
                <div key={q.id} className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-border/50 bg-background/40">
                  <div className="flex flex-col -my-0.5 pt-0.5">
                    <button disabled={i === 0} onClick={() => moveQuestion(i, -1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button disabled={i === active.questions.length - 1} onClick={() => moveQuestion(i, 1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", !q.active && "line-through text-muted-foreground")}>{q.label}{q.required && <span className="text-destructive"> *</span>}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <Badge variant="outline" className="text-[10px] font-normal">{typeLabel(q.type)}</Badge>
                      {q.weight !== 1 && <Badge variant="outline" className="text-[10px] font-normal">Weight {q.weight}×</Badge>}
                      {isChoice(q.type) && <span className="text-[11px] text-muted-foreground">{q.options.filter((o) => o.active).length} options</span>}
                      {parentQ && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> only if &quot;{q.showIfOption}&quot;</span>}
                      <span className="text-[11px] text-muted-foreground">v{q.version}</span>
                      {isDalail && (
                        <>
                          <Badge variant="outline" className={cn("text-[10px] font-medium capitalize", REVIEW_STYLES[q.reviewStatus])}>{q.reviewStatus}</Badge>
                          {q.safetyCritical && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive"><ShieldAlert className="h-2.5 w-2.5" /> Safety</Badge>}
                          <span className="text-[11px] text-muted-foreground">Priority {q.priority}</span>
                        </>
                      )}
                    </div>
                    {isDalail && <p className="mt-1 text-[11px] text-muted-foreground truncate" title={linkSummary(q.appliesTo)}>Shown for: {linkSummary(q.appliesTo)}</p>}
                  </div>
                  {isDalail && q.reviewStatus === "draft" && (
                    <Button size="sm" variant="outline" className="h-8 shrink-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400" onClick={() => setReview(q, "approved")}>Approve</Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openQuestion(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <span className={cn("text-xs font-medium w-14 text-right shrink-0 pt-2", q.active ? "text-emerald-500" : "text-muted-foreground")}>{q.active ? "Active" : "Inactive"}</span>
                  <Switch className="mt-1.5" checked={q.active} onCheckedChange={() => toggleQuestion(q)} />
                </div>
              );
            })}
            {active.questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet — add the first one.</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">Disabling a question hides it from new assessments only — answers already recorded are kept exactly as they were.</p>
        </Card>
      )}

      {/* Question editor */}
      <Dialog open={draft !== null} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit Question" : `Add Question · ${active?.label ?? ""}`}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <FloatingField id="asbabLabel" label="Question" required value={draft.label} onChange={(e) => setD({ label: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-3">
                <FloatingField id="asbabLocal" label="Unani / Urdu label (optional)" value={draft.labelLocal || ""} onChange={(e) => setD({ labelLocal: e.target.value })} />
                <FloatingField id="asbabHelp" label="Help text (optional)" value={draft.helpText || ""} onChange={(e) => setD({ helpText: e.target.value })} />
                <FloatingSelect id="asbabType" label="Answer type" value={draft.type} onValueChange={(v) => setD({ type: v })}>
                  {QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </FloatingSelect>
                <FloatingField id="asbabWeight" label="Constitutional weight (0 – 5)" type="number" step="0.1" min={0} max={5} value={String(draft.weight)} onChange={(e) => setD({ weight: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
                <span className="text-sm font-medium">Required to complete the review</span>
                <Switch checked={draft.required} onCheckedChange={(v) => setD({ required: v })} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FloatingSelect id="asbabShowIf" label="Show only if (optional follow-up)" value={draft.showIfQuestionId || "always"}
                  onValueChange={(v) => setD({ showIfQuestionId: v === "always" ? null : v, showIfOption: null })}>
                  <SelectItem value="always">Always show</SelectItem>
                  {parentChoices.map((q) => <SelectItem key={q.id} value={q.id}>{q.label}</SelectItem>)}
                </FloatingSelect>
                {parent && (
                  <FloatingSelect id="asbabShowIfOpt" label="…has this answer" value={draft.showIfOption || ""} onValueChange={(v) => setD({ showIfOption: v })}>
                    {parent.options.filter((o) => o.active).map((o) => <SelectItem key={o.label} value={o.label}>{o.label}</SelectItem>)}
                  </FloatingSelect>
                )}
              </div>

              {isChoice(draft.type) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Options &amp; humoral points</p>
                    <Button size="sm" variant="outline" onClick={() => setD({ options: [...draft.options, blankOption()] })}><Plus className="h-3.5 w-3.5" /> Add option</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Points (−10 to 10) each option adds to the Akhlat — multiplied by the question weight to drive the live Humoral Drift. Leave all at 0 for a balanced (Mo&apos;tadil) answer.</p>
                  <div className="space-y-2">
                    {draft.options.map((o, i) => (
                      <div key={i} className={cn("rounded-lg border border-border/50 bg-background/40 p-2.5 space-y-2", !o.active && "opacity-60")}>
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col pt-1.5">
                            <button disabled={i === 0} onClick={() => moveOpt(i, -1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                            <button disabled={i === draft.options.length - 1} onClick={() => moveOpt(i, 1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="flex-1 grid sm:grid-cols-2 gap-2">
                            <Input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} placeholder={`Option ${i + 1}`} className="bg-background/60" />
                            <Input value={o.description || ""} onChange={(e) => setOpt(i, { description: e.target.value || null })} placeholder="Description (optional)" className="bg-background/60" />
                          </div>
                          <Switch className="mt-2" checked={o.active} onCheckedChange={(v) => setOpt(i, { active: v })} aria-label="Option active" />
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setD({ options: draft.options.filter((_, n) => n !== i) })} aria-label="Remove option"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 pl-6">
                          {AKHLAT.map((h) => (
                            <label key={h.key} className="flex items-center gap-1.5 text-xs">
                              <span className={cn("font-medium w-14", h.text)}>{h.label}</span>
                              <Input type="number" min={-10} max={10} step="0.5" value={String(o[h.key])} onChange={(e) => setOpt(i, { [h.key]: Number(e.target.value) } as Partial<Option>)} className="h-8 bg-background/60" />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isDalail && (
                <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                  <p className="text-sm font-semibold flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /> Patient selection</p>
                  <div className="grid sm:grid-cols-3 gap-3 pt-1">
                    <FloatingSelect id="dlReview" label="Review status" value={draft.reviewStatus} onValueChange={(v) => setD({ reviewStatus: v })}>
                      <SelectItem value="draft">Draft — awaiting clinical review</SelectItem>
                      <SelectItem value="approved">Approved — can be shown</SelectItem>
                      <SelectItem value="retired">Retired — never shown</SelectItem>
                    </FloatingSelect>
                    <FloatingSelect id="dlPriority" label="Clinical priority" value={String(draft.priority)} onValueChange={(v) => setD({ priority: Number(v) })}>
                      {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} — {["", "Low", "Below average", "Average", "High", "Very high"][n]}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingSelect id="dlSex" label="Patients" value={draft.applies.sex || "any"} onValueChange={(v) => setA({ sex: v === "any" ? undefined : (v as "male" | "female") })}>
                      <SelectItem value="any">Any sex</SelectItem>
                      <SelectItem value="female">Women only</SelectItem>
                      <SelectItem value="male">Men only</SelectItem>
                    </FloatingSelect>
                  </div>
                  <div className="pt-2"><FloatingField id="dlPurpose" label="Why this question (shown to the doctor)" maxLength={200} value={draft.purpose || ""} onChange={(e) => setD({ purpose: e.target.value })} /></div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                      <span className="text-sm">Ask every patient (core sign)</span>
                      <Switch checked={!!draft.applies.always} onCheckedChange={(v) => setA({ always: v || undefined })} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <span className="text-sm flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Safety-critical (always included)</span>
                      <Switch checked={draft.safetyCritical} onCheckedChange={(v) => setD({ safetyCritical: v })} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Complaint categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(masters?.categories || []).map((c) => {
                        const on = (draft.applies.categories || []).includes(c);
                        return (
                          <button key={c} type="button" onClick={() => setA({ categories: on ? (draft.applies.categories || []).filter((x) => x !== c) : [...(draft.applies.categories || []), c] })}
                            className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/40")}>{c}</button>
                        );
                      })}
                    </div>
                  </div>
                  {masters && (
                    <div className="grid gap-4 pt-1">
                      <FloatingMultiSelect id="dlComplaints" label="Specific complaints (optional)" openOnFocus
                        selected={(draft.applies.complaints || []).map((k) => ({ id: k, label: masters.complaints.find((c) => c.key === k)?.label ?? k }))}
                        onRemove={(k) => setA({ complaints: (draft.applies.complaints || []).filter((x) => x !== k) })}
                        query={linkQuery.complaints} onQueryChange={(q) => setLinkQuery((l) => ({ ...l, complaints: q }))}
                        results={masters.complaints.filter((c) => !(draft.applies.complaints || []).includes(c.key) && (!linkQuery.complaints.trim() || c.label.toLowerCase().includes(linkQuery.complaints.trim().toLowerCase()))).slice(0, 12).map((c) => ({ id: c.key, label: c.label, category: c.category }))}
                        describe={(c) => (c as { category?: string }).category}
                        onPick={(k) => setA({ complaints: [...(draft.applies.complaints || []), k] })} placeholder="Type a complaint…" />
                      <FloatingMultiSelect id="dlSymptoms" label="Other symptoms (optional)" openOnFocus
                        selected={(draft.applies.symptoms || []).map((x) => ({ id: x, label: x }))}
                        onRemove={(x) => setA({ symptoms: (draft.applies.symptoms || []).filter((y) => y !== x) })}
                        query={linkQuery.symptoms} onQueryChange={(q) => setLinkQuery((l) => ({ ...l, symptoms: q }))}
                        results={masters.symptoms.filter((x) => !(draft.applies.symptoms || []).includes(x) && (!linkQuery.symptoms.trim() || x.toLowerCase().includes(linkQuery.symptoms.trim().toLowerCase()))).slice(0, 12).map((x) => ({ id: x, label: x }))}
                        onPick={(x) => setA({ symptoms: [...(draft.applies.symptoms || []), x] })} placeholder="Type a symptom…" />
                      <FloatingMultiSelect id="dlRegions" label="Body regions (optional)" openOnFocus
                        selected={(draft.applies.regions || []).map((x) => ({ id: x, label: x }))}
                        onRemove={(x) => setA({ regions: (draft.applies.regions || []).filter((y) => y !== x) })}
                        query={linkQuery.regions} onQueryChange={(q) => setLinkQuery((l) => ({ ...l, regions: q }))}
                        results={masters.regions.filter((x) => !(draft.applies.regions || []).includes(x) && (!linkQuery.regions.trim() || x.toLowerCase().includes(linkQuery.regions.trim().toLowerCase()))).slice(0, 12).map((x) => ({ id: x, label: x }))}
                        onPick={(x) => setA({ regions: [...(draft.applies.regions || []), x] })} placeholder="Type a region…" />
                    </div>
                  )}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <FloatingField id="dlMinAge" label="Minimum age (optional)" type="number" min={0} max={120} value={draft.applies.minAge ?? ""} onChange={(e) => setA({ minAge: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    <FloatingField id="dlMaxAge" label="Maximum age (optional)" type="number" min={0} max={120} value={draft.applies.maxAge ?? ""} onChange={(e) => setA({ maxAge: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    <FloatingField id="dlRef" label="Reference source (optional)" maxLength={300} value={draft.reference || ""} onChange={(e) => setD({ reference: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
                <span className="text-sm font-medium">Question enabled</span>
                <Switch checked={draft.active} onCheckedChange={(v) => setD({ active: v })} />
              </div>

              {preview && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview — as the doctor sees it</p>
                  <QuestionCard inline q={preview} index={0} count={1} pillarLabel={active?.label ?? ""} value={previewAnswer} onChange={setPreviewAnswer} />
                </div>
              )}
              {draft.id && <p className="text-[11px] text-muted-foreground">Saving a change to the wording, options or weights creates a new version — answers already recorded keep the wording they were given with.</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={saveQuestion} disabled={saving || !draft?.label.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {draft?.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pillar editor */}
      <Dialog open={pillarDraft !== null} onOpenChange={(o) => { if (!o) setPillarDraft(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit {words.section}</DialogTitle></DialogHeader>
          {pillarDraft && (
            <div className="space-y-3">
              <FloatingField id="pillarLabel" label="Name" value={pillarDraft.label} onChange={(e) => setPillarDraft((d) => d && { ...d, label: e.target.value })} />
              <FloatingField id="pillarEnglish" label="English name" value={pillarDraft.english} onChange={(e) => setPillarDraft((d) => d && { ...d, english: e.target.value })} />
              <Textarea value={pillarDraft.description} onChange={(e) => setPillarDraft((d) => d && { ...d, description: e.target.value })} placeholder="Description shown to the doctor" className="min-h-[90px] bg-background/60" />
              <p className="text-[11px] text-muted-foreground">{words.fixedNote}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPillarDraft(null)}>Cancel</Button>
            <Button onClick={savePillar} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
