"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, HelpCircle, Plus, ShieldAlert, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FloatingCombobox } from "@/components/shared/combobox";
import { FloatingField } from "@/components/shared/floating-field";
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
const ROLE_STYLE: Record<DiagnosisRole, string> = { working: "border-primary/50 bg-primary/5", secondary: "border-border/60", differential: "border-dashed border-border/70", ruled_out: "border-border/40 opacity-70" };

function Pill({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", className)}>{children}</span>;
}

/** Differential diagnosis (rules) for the visit — each candidate with its evidence, plus what to ask next and what not to miss. */
function DifferentialCard({ visitId, d, add, rerun }: { visitId: string; d: MarzState; add: (x: Differential, role: DiagnosisRole) => void; rerun: () => Promise<unknown> }) {
  const t = useTranslations("clinic.marz");
  const [data, setData] = useState<(DifferentialResult & { catalogueSize: number }) | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const fetchIt = useCallback(() => api.get<DifferentialResult & { catalogueSize: number }>(`/api/facility/visits/${visitId}/differentials`)
    .then((r) => { setData(r); setFailed(false); }).catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchIt(); }, [fetchIt]);
  const recheck = async () => { setRunning(true); try { await rerun(); await fetchIt(); } finally { setRunning(false); } };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {t("engine")}</p>
        <button type="button" onClick={recheck} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? t("rechecking") : t("recheck")}</button>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">{t.rich("failed", { retry: (c) => <button type="button" onClick={() => fetchIt()} className="text-primary font-medium hover:underline">{c}</button> })}</p>
      ) : !data ? <div className="h-16 animate-pulse rounded-lg bg-muted/50" /> : (
        <>
          {data.differentials.length === 0 ? <p className="text-sm text-muted-foreground">{t("none")}</p> : (
            <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background/50">
              {data.differentials.map((x) => {
                const chosen = d.diagnoses.find((y) => (x.marzId && y.marzId === x.marzId) || y.label === x.label);
                return (
                  <li key={x.key} className="p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{x.label}</span>
                      {x.localName && <span className="text-xs text-muted-foreground">{x.localName}</span>}
                      <Pill className={CERT_STYLE[x.certainty]}>{t(`cert_${x.certainty}`)}</Pill>
                      {x.unverified && <Pill className="border-border/60 text-muted-foreground font-medium" title={t("unverified_hint")}><HelpCircle className="h-3 w-3" />{t("unverified")}</Pill>}
                      {x.mizajFit && <span className={cn("text-[11px]", x.mizajFit === "against" ? "text-destructive" : "text-muted-foreground")}>{t(`fit_${x.mizajFit}`)}</span>}
                    </div>
                    {x.for.length > 0 && <p className="text-xs"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("for")}:</span> {x.for.join(" · ")}</p>}
                    {x.against.length > 0 && <p className="text-xs"><span className="font-semibold text-destructive">{t("against")}:</span> {x.against.join(" · ")}</p>}
                    {x.missing.length > 0 && <p className="text-xs text-muted-foreground"><span className="font-semibold">{t("not_checked")}:</span> {x.missing.slice(0, 3).join(" · ")}</p>}
                    {x.typicalMizaj.length > 0 && <p className="text-[11px] text-muted-foreground">{t("typical", { mizaj: x.typicalMizaj.join(", ") })}{x.organs.length ? ` · ${x.organs.join(", ")}` : ""}</p>}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {chosen ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> {t("added_as", { role: t(`role_${chosen.role}`).toLowerCase() })}</span>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => add(x, d.diagnoses.some((y) => y.role === "working") ? "secondary" : "working")}>{t("as_working")}</Button>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => add(x, "differential")}>{t("as_differential")}</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => add(x, "ruled_out")}>{t("rule_out")}</Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {(data.nextQuestions.length > 0 || data.dontMiss.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {data.nextQuestions.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t("ask_next")}</p>
                  <ul className="space-y-1">
                    {data.nextQuestions.map((q) => (
                      <li key={q.questionId} className="text-xs">
                        <a href="#dalail" className="font-medium text-primary hover:underline">{q.sectionLabel} — {q.question}</a>
                        <span className="block text-muted-foreground">{t("helps", { items: q.helps.join(", ") })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.dontMiss.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive mb-1 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> {t("dont_miss")}</p>
                  <ul className="space-y-1">
                    {data.dontMiss.map((x) => <li key={x.label} className="text-xs"><span className="font-medium">{x.label}</span><span className="block text-muted-foreground">{x.why}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t("engine_note", { n: data.catalogueSize })} {data.basis.from === "hakim" ? t("basis_hakim") : data.basis.from === "engine" ? t("basis_engine") : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** Marz & Sabab block of the Tashkhees section: the differential, the Hakim's diagnoses, causes and an optional ICD diagnosis. */
export function MarzSection({ visitId, d, set, amraz, rerun }: { visitId: string; d: MarzState; set: (p: Partial<MarzState>) => void; amraz: AmrazOption[]; rerun: () => Promise<unknown> }) {
  const t = useTranslations("clinic.marz");
  const [pick, setPick] = useState("");
  const [freeOpen, setFreeOpen] = useState(false);
  const [free, setFree] = useState("");
  const [sababDraft, setSababDraft] = useState("");
  const [icdOpen, setIcdOpen] = useState(!!(d.icdCode || d.icdLabel));

  const addDx = (x: DossierDiagnosis) => {
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
  const toggleSabab = (s: string) => set({ sabab: d.sabab.includes(s) ? d.sabab.filter((x) => x !== s) : [...d.sabab, s] });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">{t("title")} <span className="text-destructive">*</span></p>
        <p className="text-[13px] text-muted-foreground">{t("hint")}</p>
      </div>
      <DifferentialCard visitId={visitId} d={d} add={fromDifferential} rerun={rerun} />

      {/* The Hakim's diagnoses */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("yours")}</p>
        {d.diagnoses.length === 0 ? <p className="text-[13px] text-muted-foreground">{t("empty")}</p> : (
          <ul className="space-y-2">
            {sorted.map(({ x, i }) => (
              <li key={`${x.label}${i}`} className={cn("rounded-lg border p-2.5 space-y-1.5", ROLE_STYLE[x.role])}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("text-sm font-semibold min-w-0", x.role === "ruled_out" && "line-through")}>{x.label}</span>
                  {x.localName && <span className="text-xs text-muted-foreground">{x.localName}</span>}
                  {x.source === "engine" && <span className="text-[11px] text-muted-foreground">· {t("from_engine")}</span>}
                  {amraz.find((m) => m.id === x.marzId)?.unverified && <Pill className="border-border/60 text-muted-foreground font-medium" title={t("unverified_hint")}>{t("unverified")}</Pill>}
                  <button type="button" onClick={() => set({ diagnoses: d.diagnoses.filter((_, j) => j !== i) })} className="ms-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("remove")}><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label={t("role_working")} value={x.role} onChange={(e) => update(i, { role: e.target.value as DiagnosisRole })} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
                  </select>
                  {x.role !== "ruled_out" && (
                    <select aria-label={t("certainty")} value={x.certainty ?? ""} onChange={(e) => update(i, { certainty: (e.target.value || null) as DossierDiagnosis["certainty"] })} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                      <option value="">{t("certainty")}</option>
                      {CERTS.map((c) => <option key={c} value={c}>{t(`cert_${c}`)}</option>)}
                    </select>
                  )}
                  <input value={x.note ?? ""} onChange={(e) => update(i, { note: e.target.value || null })} placeholder={t("note_ph")} maxLength={1000}
                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
                </div>
                {(x.evidenceFor.length > 0 || x.evidenceAgainst.length > 0) && (
                  <p className="text-[11px] text-muted-foreground">
                    {x.evidenceFor.length > 0 && <><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("for")}:</span> {x.evidenceFor.join(" · ")} </>}
                    {x.evidenceAgainst.length > 0 && <><span className="font-semibold text-destructive">{t("against")}:</span> {x.evidenceAgainst.join(" · ")}</>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {d.diagnoses.length > 0 && !d.diagnoses.some((x) => x.role === "working") && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> {t("need_working")}</p>
        )}
        <FloatingCombobox id="addMarz" label={t("add")} placeholder={t("add_ph")} value={pick}
          options={amraz.map((m) => ({ value: m.id, label: m.localName ? `${m.label} · ${m.localName}` : m.label }))}
          onValueChange={(id) => {
            const m = amraz.find((x) => x.id === id);
            if (m) addDx({ marzId: m.id, label: m.label, localName: m.localName, role: d.diagnoses.some((y) => y.role === "working") ? "differential" : "working", certainty: null, evidenceFor: [], evidenceAgainst: [], note: null, source: "hakim" });
            setPick("");
          }} />
        {freeOpen ? (
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0"><FloatingField id="freeMarz" label={t("add_free_label")} value={free} onChange={(e) => setFree(e.target.value)} maxLength={200} /></div>
            <Button size="sm" variant="outline" disabled={!free.trim()} onClick={() => { addDx({ marzId: null, label: free.trim(), localName: null, role: d.diagnoses.some((y) => y.role === "working") ? "differential" : "working", certainty: null, evidenceFor: [], evidenceAgainst: [], note: null, source: "hakim" }); setFree(""); setFreeOpen(false); }}>{t("add_btn")}</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setFreeOpen(true)} className="text-xs font-medium text-primary hover:underline">{t("add_free")}</button>
        )}
      </div>

      {/* Sabab */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t("sabab")}</p>
        <p className="text-[13px] text-muted-foreground">{t("sabab_hint")}</p>
        <div className="flex flex-wrap gap-1.5">
          {d.sabab.map((s) => (
            <button key={s} type="button" onClick={() => toggleSabab(s)} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
              {s} <X className="h-3 w-3" />
            </button>
          ))}
          {sababSuggest.map((s) => (
            <button key={s} type="button" onClick={() => toggleSabab(s)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/70 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0"><FloatingField id="sababAdd" label={t("sabab_add")} value={sababDraft} onChange={(e) => setSababDraft(e.target.value)} maxLength={160}
            onKeyDown={(e) => { if (e.key === "Enter" && sababDraft.trim()) { e.preventDefault(); if (!d.sabab.includes(sababDraft.trim())) set({ sabab: [...d.sabab, sababDraft.trim()] }); setSababDraft(""); } }} /></div>
          <Button size="sm" variant="outline" disabled={!sababDraft.trim()} onClick={() => { if (!d.sabab.includes(sababDraft.trim())) set({ sabab: [...d.sabab, sababDraft.trim()] }); setSababDraft(""); }}>{t("add_btn")}</Button>
        </div>
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
