"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Plus, Search, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FloatingField } from "@/components/shared/floating-field";
import { FindingAddButton } from "@/components/facility/views/finding-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DifferentialResult, Differential } from "@/lib/differential-engine";

export type DiagnosisRole = "working" | "secondary" | "differential" | "ruled_out";
export interface DossierDiagnosis {
  marzId: string | null; label: string; localName: string | null; role: DiagnosisRole; certainty: "suspected" | "probable" | "confirmed" | null;
  evidenceFor: string[]; evidenceAgainst: string[]; note: string | null; source: "hakim" | "engine" | "ai";
}
export interface AmrazOption { id: string; label: string; localName: string | null; category: string | null; sabab: string[]; unverified: boolean }
interface MarzState { diagnoses: DossierDiagnosis[]; sabab: string[]; icdCode: string | null; icdLabel: string | null }

const ROLES: DiagnosisRole[] = ["working", "secondary", "differential", "ruled_out"];
const CERTS = ["suspected", "probable", "confirmed"] as const;
const CERT_STYLE = { suspected: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", probable: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", confirmed: "border-primary/40 bg-primary/10 text-primary" };
// Coloured edge per role so the table reads at a glance.
const ROLE_EDGE: Record<DiagnosisRole, string> = { working: "bg-primary", secondary: "bg-sky-500", differential: "bg-amber-500", ruled_out: "bg-muted-foreground/40" };
// Diagnosis · Role · Certainty · Notes · remove
const DX_COLS = "md:grid-cols-[minmax(0,1.3fr)_10rem_8.5rem_minmax(0,1.2fr)_2rem]";

function Pill({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", className)}>{children}</span>;
}

/**
 * Differential diagnosis (rules) for the visit: a search box whose drop-down lists each candidate with its
 * evidence and the choices (working / differential / rule out); "Don't miss" opens in a pop-up.
 */
type DdxData = DifferentialResult & { catalogueSize: number };

/** Group heading inside the Add diagnosis drop-down. */
function Head({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("sticky top-0 z-[1] bg-popover px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>{children}</p>;
}

/** The rules engine's differential for this visit (suggestions for the Add diagnosis drop-down). */
function useDifferential(visitId: string, rerun: () => Promise<unknown>) {
  const [data, setData] = useState<DdxData | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const fetchIt = useCallback(() => api.get<DdxData>(`/api/facility/visits/${visitId}/differentials`)
    .then((r) => { setData(r); setFailed(false); }).catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchIt(); }, [fetchIt]);
  const recheck = async () => { setRunning(true); try { await rerun(); await fetchIt(); } finally { setRunning(false); } };
  return { data, failed, running, recheck, retry: fetchIt };
}

/**
 * "+ Add diagnosis": one drop-down — suggestions from this patient's findings first (with why),
 * then the rest of the Amraz catalogue, or a free-text diagnosis that isn't in it.
 */
function DiagnosisPicker({ amraz, ddx, chosen, onSuggest, onPick, onFree }: {
  amraz: AmrazOption[]; ddx: DdxData | null; chosen: DossierDiagnosis[];
  onSuggest: (x: Differential) => void; onPick: (m: AmrazOption) => void; onFree: (label: string) => void;
}) {
  const t = useTranslations("clinic.marz");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const isChosen = (marzId: string | null, label: string) => chosen.some((y) => (marzId && y.marzId === marzId) || y.label.toLowerCase() === label.toLowerCase());
  const suggested = (ddx?.differentials ?? []).filter((x) => !ql || `${x.label} ${x.localName ?? ""} ${x.for.join(" ")}`.toLowerCase().includes(ql));
  const suggestedIds = new Set((ddx?.differentials ?? []).map((x) => x.marzId).filter(Boolean));
  const others = amraz.filter((m) => !suggestedIds.has(m.id) && (!ql || `${m.label} ${m.localName ?? ""} ${m.category ?? ""}`.toLowerCase().includes(ql))).slice(0, 60);
  const close = () => { setOpen(false); setQ(""); };
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> {t("add_dx")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] p-2" align="end">
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("add_ph")} className="h-9 ps-8" />
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {!ql && !!ddx?.dontMiss.length && (
            <div className="mx-1 mt-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> {t("dont_miss")}</p>
              <ul className="space-y-0.5 text-xs">{ddx.dontMiss.map((x) => <li key={x.label} className="truncate" title={`${x.label} — ${x.why}`}><span className="font-semibold">{x.label}</span> <span className="text-muted-foreground">— {x.why}</span></li>)}</ul>
            </div>
          )}
          {suggested.length > 0 && (
            <>
              <Head className="flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" /> {t("sugg_head")}</Head>
              {suggested.map((x) => {
                const done = isChosen(x.marzId, x.label);
                return (
                  <button key={x.key} type="button" disabled={done} onClick={() => { onSuggest(x); close(); }}
                    className={cn("w-full rounded-md px-2 py-1.5 text-start transition-colors", done ? "cursor-default opacity-60" : "hover:bg-primary/5")}>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-sm font-medium">{x.label}</span>
                      {x.localName && <span className="text-xs text-muted-foreground">{x.localName}</span>}
                      <Pill className={CERT_STYLE[x.certainty]}>{t(`cert_${x.certainty}`)}</Pill>
                      {x.mizajFit && <span className={cn("text-[11px]", x.mizajFit === "against" ? "text-destructive" : "text-muted-foreground")}>{t(`fit_${x.mizajFit}`)}</span>}
                      {done && <span className="ms-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> {t("added")}</span>}
                    </span>
                    {x.for.length > 0 && <span className="block truncate text-[11px] text-muted-foreground"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("for")}:</span> {x.for.join(" · ")}</span>}
                  </button>
                );
              })}
            </>
          )}
          {others.length > 0 && <Head className={suggested.length ? "mt-1 border-t border-border" : ""}>{t("all_head")}</Head>}
          {others.map((m) => {
            const done = isChosen(m.id, m.label);
            return (
              <button key={m.id} type="button" disabled={done} onClick={() => { onPick(m); close(); }} className={cn("w-full text-start rounded-md px-2 py-1.5 text-sm", done ? "cursor-default opacity-60" : "hover:bg-muted/60")}>
                {m.label}{m.localName && <span className="ms-1.5 text-xs text-muted-foreground">{m.localName}</span>}
                {done && <Check className="ms-1.5 inline h-3 w-3 text-emerald-600" />}
                {m.category && <span className="block text-[11px] text-muted-foreground">{m.category}</span>}
              </button>
            );
          })}
          {q.trim() && !amraz.some((m) => m.label.toLowerCase() === ql) && (
            <button type="button" onClick={() => { onFree(q.trim()); close(); }} className="w-full text-start rounded-md px-2 py-1.5 text-sm text-primary hover:bg-muted/60">{t("add_free_q", { q: q.trim() })}</button>
          )}
          {!ql && !!ddx?.nextQuestions.length && (
            <div className="mx-1 mb-1 mt-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("ask_next")}</p>
              <ul className="space-y-0.5 text-xs">
                {ddx.nextQuestions.map((nq) => (
                  <li key={nq.questionId}><a href="#dalail" onClick={close} className="font-medium text-primary hover:underline">{nq.sectionLabel} — {nq.question}</a><span className="text-muted-foreground"> · {t("helps", { items: nq.helps.join(", ") })}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Marz & Sabab block of the Tashkhees section: the differential, the Hakim's diagnoses, causes and an optional ICD diagnosis. */
export function MarzSection({ visitId, d, set, amraz, rerun }: { visitId: string; d: MarzState; set: (p: Partial<MarzState>) => void; amraz: AmrazOption[]; rerun: () => Promise<unknown> }) {
  const t = useTranslations("clinic.marz");
  const [icdOpen, setIcdOpen] = useState(!!(d.icdCode || d.icdLabel));
  const ddx = useDifferential(visitId, rerun);

  const addDx = (x: DossierDiagnosis | null) => {
    if (!x) return;
    if (d.diagnoses.some((y) => (x.marzId && y.marzId === x.marzId) || y.label.toLowerCase() === x.label.toLowerCase())) return;
    set({ diagnoses: [...d.diagnoses, x] });
  };
  const fromDifferential = (x: Differential, role: DiagnosisRole) => addDx({
    marzId: x.marzId, label: x.label, localName: x.localName, role, certainty: role === "ruled_out" ? null : x.certainty,
    evidenceFor: x.for, evidenceAgainst: x.against, note: null, source: "engine",
  });
  const update = (i: number, patch: Partial<DossierDiagnosis>) => {
    const next = d.diagnoses.map((x, j) => (j === i ? { ...x, ...patch } : patch.role === "working" && x.role === "working" ? { ...x, role: "secondary" as const } : x));
    set({ diagnoses: next });
  };
  const sorted = d.diagnoses.map((x, i) => ({ x, i })).sort((a, b) => ROLES.indexOf(a.x.role) - ROLES.indexOf(b.x.role));
  const sababSuggest = [...new Set(d.diagnoses.filter((x) => x.role === "working" || x.role === "secondary").flatMap((x) => amraz.find((m) => m.id === x.marzId)?.sabab ?? []))].filter((s) => !d.sabab.includes(s));
  // Which of the chosen diagnoses list this cause (Admin → Amraz).
  const linkedTo = (s: string) => d.diagnoses.filter((x) => x.role !== "ruled_out" && amraz.find((m) => m.id === x.marzId)?.sabab.includes(s)).map((x) => x.label);
  const toggleSabab = (s: string) => set({ sabab: d.sabab.includes(s) ? d.sabab.filter((x) => x !== s) : [...d.sabab, s] });

  return (
    <div className="space-y-4">
      {/* The Hakim's diagnoses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold">{t("yours")} <span className="text-destructive">*</span></p>
          <span className="flex items-center gap-3">
          {ddx.failed ? (
            <span className="text-xs text-muted-foreground">{t.rich("failed", { retry: (c) => <button type="button" onClick={() => ddx.retry()} className="text-primary font-medium hover:underline">{c}</button> })}</span>
          ) : ddx.data && (
            <span className="flex items-center gap-2 text-xs">
              {ddx.data.differentials.length > 0 && <span className="inline-flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />{t("n_suggested", { count: ddx.data.differentials.length })}</span>}
              {ddx.data.dontMiss.length > 0 && <span className="inline-flex items-center gap-1 font-semibold text-destructive"><ShieldAlert className="h-3 w-3" />{t("dont_miss")} · {ddx.data.dontMiss.length}</span>}
              <button type="button" onClick={ddx.recheck} disabled={ddx.running} className="font-medium text-primary hover:underline disabled:opacity-50">{ddx.running ? t("rechecking") : t("recheck")}</button>
            </span>
          )}
          <DiagnosisPicker amraz={amraz} ddx={ddx.data} chosen={d.diagnoses} onSuggest={(x) => fromDifferential(x, d.diagnoses.some((y) => y.role === "working") ? "differential" : "working")} onPick={(m) => addDx(m
            ? { marzId: m.id, label: m.label, localName: m.localName, role: d.diagnoses.some((y) => y.role === "working") ? "differential" : "working", certainty: null, evidenceFor: [], evidenceAgainst: [], note: null, source: "hakim" }
            : null)} onFree={(label) => addDx({ marzId: null, label, localName: null, role: d.diagnoses.some((y) => y.role === "working") ? "differential" : "working", certainty: null, evidenceFor: [], evidenceAgainst: [], note: null, source: "hakim" })} />
          </span>
        </div>
        {d.diagnoses.length === 0 ? <p className="text-[13px] text-muted-foreground">{t("empty")}</p> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* One header for all rows */}
            <div className={cn("hidden gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid", DX_COLS)}>
              <span>{t("add_free_label")}</span><span>{t("role")}</span><span>{t("certainty")}</span><span>{t("note_ph")}</span><span />
            </div>
            <ul className="divide-y divide-border">
              {sorted.map(({ x, i }) => (
                <li key={`${x.label}${i}`} className={cn("relative grid items-center gap-2 py-2 ps-4 pe-3 md:gap-3", DX_COLS, x.role === "ruled_out" && "opacity-70")}>
                  <span className={cn("absolute inset-y-1.5 start-0 w-1 rounded-e-full", ROLE_EDGE[x.role])} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className={cn("text-sm font-semibold", x.role === "ruled_out" && "line-through")}>{x.label}</span>
                      {x.localName && <span className="text-xs text-muted-foreground">{x.localName}</span>}
                      {amraz.find((m) => m.id === x.marzId)?.unverified && <Pill className="border-border/60 text-muted-foreground font-medium" title={t("unverified_hint")}>{t("unverified")}</Pill>}
                    </p>
                    {(x.source === "engine" || x.evidenceFor.length > 0 || x.evidenceAgainst.length > 0) && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={[x.evidenceFor.length ? `${t("for")}: ${x.evidenceFor.join(" · ")}` : "", x.evidenceAgainst.length ? `${t("against")}: ${x.evidenceAgainst.join(" · ")}` : ""].filter(Boolean).join("  ")}>
                        {x.source === "engine" && <span>{t("from_engine")} </span>}
                        {x.evidenceFor.length > 0 && <><span className="font-semibold text-emerald-700 dark:text-emerald-400">· {t("for")}:</span> {x.evidenceFor.join(" · ")} </>}
                        {x.evidenceAgainst.length > 0 && <><span className="font-semibold text-destructive">· {t("against")}:</span> {x.evidenceAgainst.join(" · ")}</>}
                      </p>
                    )}
                  </div>
                  <Select value={x.role} onValueChange={(v) => update(i, { role: v as DiagnosisRole })}>
                    <SelectTrigger className="h-8 w-full bg-background/60 text-xs" aria-label={t("role")}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role_${r}`)}</SelectItem>)}</SelectContent>
                  </Select>
                  {x.role !== "ruled_out" ? (
                    <Select value={x.certainty ?? "none"} onValueChange={(v) => update(i, { certainty: (v === "none" ? null : v) as DossierDiagnosis["certainty"] })}>
                      <SelectTrigger className={cn("h-8 w-full bg-background/60 text-xs", !x.certainty && "text-muted-foreground")} aria-label={t("certainty")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("cert_none")}</SelectItem>
                        {CERTS.map((c) => <SelectItem key={c} value={c}>{t(`cert_${c}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <span className="hidden text-xs text-muted-foreground md:block">—</span>}
                  <Input value={x.note ?? ""} onChange={(e) => update(i, { note: e.target.value || null })} maxLength={1000} aria-label={t("note_ph")} className="h-8 bg-background/60 text-xs" />
                  <button type="button" onClick={() => set({ diagnoses: d.diagnoses.filter((_, j) => j !== i) })} className="justify-self-end rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={t("remove")} title={t("remove")}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.diagnoses.length > 0 && !d.diagnoses.some((x) => x.role === "working") && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> {t("need_working")}</p>
        )}
      </div>

      {/* Sabab — Add a cause (suggestions from the chosen diagnoses first) + the causes as a table */}
      <div className="space-y-2 border-t border-border/50 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-semibold">{t("sabab")} <span className="text-xs font-normal text-muted-foreground">· {d.sabab.length}</span></p>
          <FindingAddButton label={t("sabab_add")} searchPh={t("sabab_search")} createLabel={(q) => t("sabab_add_q", { q })}
            options={sababSuggest.map((s) => ({ id: s, label: s, description: linkedTo(s).length ? t("sabab_from", { list: linkedTo(s).join(", ") }) : null }))}
            onPick={(s) => toggleSabab(s)} onCreate={(q) => { if (!d.sabab.includes(q)) set({ sabab: [...d.sabab, q] }); }} />
        </div>
        {d.sabab.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">{t("sabab_none")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="text-end">#</span><span>{t("sabab_col")}</span><span>{t("sabab_from_col")}</span><span />
            </div>
            <ul className="divide-y divide-border">
              {d.sabab.map((s, i) => {
                const from = linkedTo(s);
                return (
                  <li key={s} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.3fr)_2rem] items-center gap-x-3 px-3 py-2">
                    <span className="text-end text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <p className="text-sm font-semibold">{s}</p>
                    <p className="min-w-0 text-xs text-muted-foreground">
                      {from.length ? from.map((x) => <span key={x} className="me-1 inline-block rounded-full border border-border bg-muted/40 px-2 py-px">{x}</span>)
                        : <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-px font-medium text-amber-700 dark:text-amber-400">{t("sabab_mine")}</span>}
                    </p>
                    <button type="button" onClick={() => toggleSabab(s)} aria-label={`${t("remove")} ${s}`} title={`${t("remove")} ${s}`}
                      className="justify-self-end rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Optional biomedical diagnosis */}
      <div className="space-y-2">
        <button type="button" onClick={() => setIcdOpen((v) => !v)} aria-expanded={icdOpen} className="text-sm font-medium text-primary hover:underline">{t("icd")}</button>
        {icdOpen && (
          <>
            <p className="text-[13px] text-muted-foreground">{t("icd_hint")}</p>
            <div className="grid sm:grid-cols-[10rem_1fr] gap-2">
              <FloatingField id="icdCode" label={t("icd_code")} value={d.icdCode ?? ""} onChange={(e) => set({ icdCode: e.target.value || null })} maxLength={20} />
              <FloatingField id="icdLabel" label={t("icd_label")} value={d.icdLabel ?? ""} onChange={(e) => set({ icdLabel: e.target.value || null })} maxLength={200} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
