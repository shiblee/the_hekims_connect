"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, BookOpen, Eye, History, Loader2, Map, Plus, RotateCcw, Save, Send, Trash2, Undo2, X,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingCombobox } from "@/components/shared/combobox";
import { GuideText } from "@/components/guidance/guide-text";
import { LangDots, StatusPill } from "@/components/guidance/admin-bits";
import {
  DOC_SECTIONS, GUIDE_LANGS, LANG_LABEL, RTL_LANGS, STATE_LABEL, t,
  type DocContent, type GuideLang, type L10n, type TourContent, type TourStep, type TranslationState,
} from "@/lib/guidance/content";

interface RouteInfo { route: string; name: string; targets: { id: string; label: string }[] }
interface Loaded {
  item: { id: string; name: string; audience: string; status: string; version: number; dirty: boolean; updatedAt: string; publishedAt: string | null; trigger?: string; reoffer?: boolean; draft: TourContent | DocContent; languages: Record<GuideLang, TranslationState> };
  module: { key: string; app: "clinic" | "admin"; name: string; route: string };
  routes: RouteInfo[];
  staffRoles: string[];
  versions: { version: number; publishedBy: string; note: string | null; createdAt: string }[];
}

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const TEXT_HINT = "Blank line = new paragraph · “- ” bullets · “1. ” numbered steps · **bold** · [link text](/facility/…)";

function LangField({ label, value, english, lang, onChange, multiline, rows = 3 }: { label: string; value: L10n; english?: string; lang: GuideLang; onChange: (v: L10n) => void; multiline?: boolean; rows?: number }) {
  const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  const v = value[lang] ?? "";
  const set = (s: string) => onChange({ ...value, [lang]: s });
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}{lang !== "en" && <span className="ms-1 font-normal">({LANG_LABEL[lang]})</span>}</label>
      {lang !== "en" && english && <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" dir="ltr"><span className="font-semibold">English:</span> {english}</p>}
      {multiline
        ? <Textarea dir={dir} rows={rows} value={v} onChange={(e) => set(e.target.value)} className={cn("bg-background/60 text-sm", !v.trim() && english && "border-amber-500/50")} />
        : <Input dir={dir} value={v} onChange={(e) => set(e.target.value)} className={cn("bg-background/60", !v.trim() && english && "border-amber-500/50")} />}
    </div>
  );
}

export default function GuidanceEditorPage() {
  const { kind, id } = useParams<{ kind: "tours" | "docs"; id: string }>();
  const router = useRouter();
  const isTour = kind === "tours";
  const [data, setData] = useState<Loaded | null>(null);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<string[]>([]);
  const [trigger, setTrigger] = useState("first_visit");
  const [reoffer, setReoffer] = useState(false);
  const [draft, setDraft] = useState<TourContent | DocContent | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [lang, setLang] = useState<GuideLang>("en");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState<GuideLang>("en");
  const [previewStep, setPreviewStep] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await adminApi.get<Loaded>(`/api/admin/guidance/${kind}/${id}`);
    setData(r); setName(r.item.name); setAudience(JSON.parse(r.item.audience || "[]")); setTrigger(r.item.trigger ?? "first_visit"); setReoffer(!!r.item.reoffer);
    setDraft(r.item.draft); setUpdatedAt(r.item.updatedAt); setDirty(false);
  }, [kind, id]);
  useEffect(() => { load().catch(() => toast.error("Could not load")); }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = (fn: (d: TourContent & DocContent) => void) => setDraft((d) => {
    if (!d) return d;
    const copy = structuredClone(d) as TourContent & DocContent;
    fn(copy); setDirty(true); return copy;
  });

  const save = async () => {
    if (!draft) return false;
    setBusy("save");
    try {
      const r = await adminApi.put<{ updatedAt: string; languages: Record<GuideLang, TranslationState> }>(`/api/admin/guidance/${kind}/${id}`, { name, audience, trigger, reoffer, draft, updatedAt });
      setUpdatedAt(r.updatedAt); setDirty(false);
      setData((d) => d && { ...d, item: { ...d.item, name, dirty: true, languages: r.languages } });
      toast.success("Draft saved");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved"); return false; }
    finally { setBusy(""); }
  };

  const action = async (act: "publish" | "unpublish" | "archive" | "restore", extra: Record<string, unknown> = {}) => {
    if (dirty && act === "publish" && !(await save())) return;
    setBusy(act);
    try {
      await adminApi.post(`/api/admin/guidance/${kind}/${id}/action`, { action: act, ...extra });
      toast.success(act === "publish" ? "Published — users now see this version" : act === "restore" ? "Version loaded into the draft — review it, then publish" : act === "archive" ? "Archived" : "Unpublished — users no longer see it");
      setPublishOpen(false); setNote("");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(""); }
  };

  const remove = async () => {
    if (!confirm("Delete this draft? It has never been published.")) return;
    try { await adminApi.delete(`/api/admin/guidance/${kind}/${id}`); router.push("/admin/guidance"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Not deleted"); }
  };

  const liveLangs = useMemo(() => data?.item.languages, [data]);
  if (!data || !draft) return <div className="mx-auto max-w-[1680px] px-4 py-16 sm:px-6 lg:px-16"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div></div>;

  const tour = draft as TourContent, doc = draft as DocContent;
  const item = data.item;
  const audienceOptions = data.module.app === "admin"
    ? [{ v: "admin", l: "Admins" }]
    : [{ v: "owner", l: "Clinic owner" }, { v: "staff", l: "All staff" }, ...data.staffRoles.map((r) => ({ v: `role:${r}`, l: r }))];
  const toggleAudience = (v: string) => { setAudience((a) => a.includes(v) ? a.filter((x) => x !== v) : [...a, v]); setDirty(true); };
  const steps = isTour ? tour.steps : [];
  const previewSteps = steps.filter((s) => s.active);

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-16">
      <Link href="/admin/guidance" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> User guidance</Link>

      {/* Header + actions */}
      <Card className="mb-4 gap-4 border-border bg-card/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{isTour ? <Map className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}{isTour ? "Guided tour" : "Module tutorial"} · {data.module.name} <code className="text-[11px]">{data.module.route}</code></p>
            <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} className="mt-1 h-10 max-w-xl border-transparent bg-transparent px-0 font-serif text-2xl font-bold shadow-none focus-visible:border-input focus-visible:px-2" aria-label="Internal name" />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={item.status} dirty={item.dirty || dirty} version={item.version} />
              {liveLangs && <LangDots languages={liveLangs} />}
              {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setPreviewLang(lang); setPreviewStep(0); setPreview(true); }}><Eye className="h-4 w-4" /> Preview</Button>
            <Button variant="outline" onClick={save} disabled={!!busy || !dirty}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft</Button>
            <Button onClick={() => setPublishOpen(true)} disabled={!!busy}><Send className="h-4 w-4" /> Publish</Button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Who it&apos;s for <span className="font-normal">(nothing ticked = everyone who can open {data.module.name})</span></p>
            <div className="flex flex-wrap gap-1.5">
              {audienceOptions.map((o) => (
                <button key={o.v} type="button" onClick={() => toggleAudience(o.v)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", audience.includes(o.v) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:border-primary/40")}>{o.l}</button>
              ))}
            </div>
          </div>
          {isTour && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-60"><FloatingCombobox id="trigger" label="Starts" value={trigger} onValueChange={(v) => { setTrigger(v); setDirty(true); }} keepOrder options={[{ value: "first_login", label: "At the user's first sign-in" }, { value: "first_visit", label: "First visit to the page" }, { value: "manual", label: "Only when the user starts it" }]} /></div>
              <label className="flex items-center gap-2 pb-3 text-sm"><Switch checked={reoffer} onCheckedChange={(v) => { setReoffer(v); setDirty(true); }} /> Offer again after updates</label>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {/* Language tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-lg border border-border bg-card/60 p-1">
              {GUIDE_LANGS.map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", lang === l ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {LANG_LABEL[l]}{liveLangs && l !== "en" && <span className={cn("rounded px-1 text-[10px]", lang === l ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{STATE_LABEL[liveLangs[l]]}</span>}
                </button>
              ))}
            </div>
            {lang !== "en" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!draft.reviewed[lang]} onCheckedChange={(v) => edit((d) => { d.reviewed = { ...d.reviewed, [lang]: v === true }; })} />
                {LANG_LABEL[lang]} reviewed by a fluent speaker
              </label>
            )}
          </div>
          {lang !== "en" && <p className="text-xs text-muted-foreground">Users see {LANG_LABEL[lang]} only when every text is filled in <strong>and</strong> marked reviewed; until then they get the fallback language. Empty fields are outlined in amber.</p>}

          <Card className="gap-4 border-border bg-card/60 p-5">
            <LangField label={isTour ? "Tour title (shown to users)" : "Tutorial title"} value={draft.title} english={draft.title.en} lang={lang} onChange={(v) => edit((d) => { d.title = v; })} />
          </Card>

          {isTour ? (
            <>
              {steps.map((s, i) => {
                const route = data.routes.find((r) => r.route === (s.route || data.module.route));
                return (
                  <Card key={s.id} className={cn("gap-3 border-border bg-card/60 p-5", !s.active && "opacity-60")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Step {i + 1}{!s.active && <span className="ms-2 text-xs font-normal text-muted-foreground">(inactive — not shown)</span>}</p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => edit((d) => { [d.steps[i - 1], d.steps[i]] = [d.steps[i], d.steps[i - 1]]; })} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === steps.length - 1} onClick={() => edit((d) => { [d.steps[i + 1], d.steps[i]] = [d.steps[i], d.steps[i + 1]]; })} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                        <label className="ms-2 flex items-center gap-1.5 text-xs text-muted-foreground">Active<Switch checked={s.active} onCheckedChange={(v) => edit((d) => { d.steps[i].active = v; })} /></label>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => edit((d) => { d.steps.splice(i, 1); })} aria-label="Delete step"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <LangField label="Step title" value={s.title} english={s.title.en} lang={lang} onChange={(v) => edit((d) => { d.steps[i].title = v; })} />
                    <LangField label="Explanation" value={s.body} english={s.body.en} lang={lang} multiline onChange={(v) => edit((d) => { d.steps[i].body = v; })} />
                    {lang === "en" && (
                      <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                        <FloatingCombobox id={`route-${s.id}`} label="Page" value={s.route || data.module.route} keepOrder onValueChange={(v) => edit((d) => { d.steps[i].route = v; d.steps[i].target = undefined; })} options={data.routes.map((r) => ({ value: r.route, label: r.name }))} />
                        <FloatingCombobox id={`target-${s.id}`} label="Highlight" value={s.target ?? ""} keepOrder onValueChange={(v) => edit((d) => { d.steps[i].target = v || undefined; })} options={[{ value: "", label: "Nothing — centred card" }, ...(route?.targets ?? []).map((tg) => ({ value: tg.id, label: tg.label }))]} placeholder="Nothing — centred card" />
                        <FloatingCombobox id={`place-${s.id}`} label="Card position" value={s.placement ?? "auto"} keepOrder onValueChange={(v) => edit((d) => { d.steps[i].placement = v as TourStep["placement"]; })} options={[{ value: "auto", label: "Automatic" }, { value: "bottom", label: "Below" }, { value: "top", label: "Above" }, { value: "right", label: "Beside (end)" }, { value: "left", label: "Beside (start)" }]} />
                      </div>
                    )}
                  </Card>
                );
              })}
              <Button variant="outline" className="w-full border-dashed" onClick={() => edit((d) => { d.steps.push({ id: uid(), title: {}, body: {}, active: true, placement: "auto" }); })}><Plus className="h-4 w-4" /> Add step</Button>
            </>
          ) : (
            <>
              <Card className="gap-5 border-border bg-card/60 p-5">
                <p className="text-xs text-muted-foreground">{TEXT_HINT}. Empty sections are left out of the tutorial.</p>
                {DOC_SECTIONS.map(([key, label]) => (
                  <LangField key={key} label={label} value={doc.sections[key] ?? {}} english={doc.sections[key]?.en} lang={lang} multiline rows={key === "workflow" || key === "controls" ? 6 : 3} onChange={(v) => edit((d) => { d.sections[key] = v; })} />
                ))}
              </Card>
              <Card className="gap-3 border-border bg-card/60 p-5">
                <p className="font-semibold">Frequently asked questions</p>
                {doc.faqs.map((f, i) => (
                  <div key={f.id} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex justify-end"><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => edit((d) => { d.faqs.splice(i, 1); })} aria-label="Delete question"><X className="h-4 w-4" /></Button></div>
                    <LangField label="Question" value={f.q} english={f.q.en} lang={lang} onChange={(v) => edit((d) => { d.faqs[i].q = v; })} />
                    <LangField label="Answer" value={f.a} english={f.a.en} lang={lang} multiline onChange={(v) => edit((d) => { d.faqs[i].a = v; })} />
                  </div>
                ))}
                <Button variant="outline" className="border-dashed" onClick={() => edit((d) => { d.faqs.push({ id: uid(), q: {}, a: {} }); })}><Plus className="h-4 w-4" /> Add question</Button>
              </Card>
            </>
          )}
          {isTour && <p className="text-xs text-muted-foreground">{TEXT_HINT}.</p>}
        </div>

        {/* Side: publishing + history */}
        <div className="space-y-4">
          <Card className="gap-3 border-border bg-card/60 p-5 xl:sticky xl:top-6">
            <h2 className="font-semibold">Publishing</h2>
            <p className="text-xs text-muted-foreground">{item.status === "published" ? `Users see version ${item.version}, published ${item.publishedAt ? formatDateTime(item.publishedAt) : ""}. Edits stay in the draft until you publish again.` : item.status === "archived" ? "Archived — users don't see it. History is kept." : "Not visible to users yet."}</p>
            <div className="flex flex-wrap gap-2">
              {item.status === "published" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => action("unpublish")}><Undo2 className="h-3.5 w-3.5" /> Unpublish</Button>}
              {item.status !== "archived" && item.version > 0 && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => action("archive")}><Archive className="h-3.5 w-3.5" /> Archive</Button>}
              {item.version === 0 && <Button size="sm" variant="outline" className="text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /> Delete draft</Button>}
            </div>
            <div className="border-t border-border pt-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> Version history</h3>
              {data.versions.length === 0 ? <p className="text-xs text-muted-foreground">Nothing published yet.</p> : (
                <ul className="space-y-2">
                  {data.versions.map((v) => (
                    <li key={v.version} className="rounded-lg border border-border px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">v{v.version}</span><button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => action("restore", { version: v.version })}><RotateCcw className="h-3 w-3" /> Load into draft</button></div>
                      <p className="text-muted-foreground">{v.publishedBy} · {formatDateTime(v.createdAt)}</p>
                      {v.note && <p className="mt-0.5">{v.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Publish */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish version {item.version + 1}?</DialogTitle>
            <DialogDescription>Users start seeing this version straight away. Languages that aren't complete and reviewed fall back to {LANG_LABEL.en} (or your fallback language).</DialogDescription>
          </DialogHeader>
          {liveLangs && <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">{GUIDE_LANGS.map((l) => <div key={l} className="rounded-md border border-border px-1 py-1.5"><p className="font-semibold">{LANG_LABEL[l]}</p><p className="text-muted-foreground">{STATE_LABEL[liveLangs[l]]}</p></div>)}</div>}
          <Input placeholder="What changed? (optional, shown in history)" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button onClick={() => action("publish", { note })} disabled={!!busy}>{busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />} Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview (draft)</DialogTitle>
            <DialogDescription>How users will see the current draft. Highlighting the page itself comes with the tour on the real screen.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1">{GUIDE_LANGS.map((l) => <button key={l} type="button" onClick={() => setPreviewLang(l)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", previewLang === l ? "bg-primary text-primary-foreground" : "bg-muted")}>{LANG_LABEL[l]}</button>)}</div>
          <div dir={RTL_LANGS.includes(previewLang) ? "rtl" : "ltr"} className="rounded-xl border border-border p-4">
            {isTour ? (previewSteps.length === 0 ? <p className="text-sm text-muted-foreground">No active steps yet.</p> : (() => {
              const s = previewSteps[Math.min(previewStep, previewSteps.length - 1)];
              const n = Math.min(previewStep, previewSteps.length - 1);
              return (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{t(tour.title, previewLang)} · {n + 1} / {previewSteps.length}</p>
                  <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${((n + 1) / previewSteps.length) * 100}%` }} /></div>
                  <p className="font-semibold">{t(s.title, previewLang)}</p>
                  <GuideText text={t(s.body, previewLang)} />
                  {s.target && <p className="text-[11px] text-muted-foreground" dir="ltr">Highlights: {data.routes.flatMap((r) => r.targets).find((x) => x.id === s.target)?.label ?? s.target}</p>}
                  <div className="flex justify-between border-t border-border pt-3">
                    <Button size="sm" variant="outline" disabled={n === 0} onClick={() => setPreviewStep(n - 1)}>Previous</Button>
                    <Button size="sm" disabled={n === previewSteps.length - 1} onClick={() => setPreviewStep(n + 1)}>Next</Button>
                  </div>
                </div>
              );
            })()) : (
              <div className="space-y-4">
                <p className="font-serif text-xl font-semibold">{t(doc.title, previewLang)}</p>
                {DOC_SECTIONS.filter(([k]) => t(doc.sections[k], previewLang)).map(([k, label]) => (
                  <section key={k}><h3 className="mb-1 font-semibold">{label}</h3><GuideText text={t(doc.sections[k], previewLang)} /></section>
                ))}
                {doc.faqs.length > 0 && <section><h3 className="mb-1 font-semibold">Questions</h3>{doc.faqs.map((f) => <div key={f.id} className="mb-2"><p className="text-sm font-medium">{t(f.q, previewLang)}</p><GuideText text={t(f.a, previewLang)} /></div>)}</section>}
              </div>
            )}
          </div>
          {previewLang !== "en" && liveLangs && liveLangs[previewLang] !== "complete" && <p className="text-xs text-amber-600 dark:text-amber-400">{LANG_LABEL[previewLang]} isn&apos;t complete and reviewed yet — users would see the fallback language instead. Missing texts show in English here.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
