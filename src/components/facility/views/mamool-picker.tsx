"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BookMarked, Check, ChevronDown, ChevronUp, Leaf, Loader2, Pill, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { normalizeTerm } from "@/lib/complaint-search";
import type { PrescriptionLine } from "@/lib/tashkhees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNotice } from "@/components/shared/inline-notice";

interface RegimenMedicine { tagId: string; name: string; kind: string; form: string; dose: string; timing: string; duration: string; adjuvant: string; instructions: string; available: boolean }
export interface Regimen {
  id: string; code: string; version: number; approvedByName: string; name: string; description: string | null; clinicalNotes: string | null;
  complaints: { id: string; label: string; required: boolean }[];
  medicines: RegimenMedicine[];
  match: { matched: string[]; missingRequired: string[]; suggested: boolean };
}

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Add a regimen's medicines to the prescription without touching what's there:
 *  - a medicine already prescribed with the same instructions is skipped (no copy);
 *  - one already prescribed with different instructions is added too and both are
 *    flagged as duplicates for the Hakim to resolve — never merged automatically;
 *  - a medicine withdrawn from the master since approval is skipped and reported.
 */
export function applyRegimen(current: PrescriptionLine[], r: Regimen) {
  const added: PrescriptionLine[] = [];
  let skippedSame = 0, skippedUnavailable = 0;
  for (const m of r.medicines) {
    if (!m.available) { skippedUnavailable++; continue; }
    const line: PrescriptionLine = {
      tagId: m.tagId, name: m.name, form: m.form, dose: m.dose, timing: m.timing, duration: m.duration, adjuvant: m.adjuvant, instructions: m.instructions,
      sourceRegimenId: r.id, sourceRegimenName: r.name, sourceRegimenVersion: r.version,
    };
    const existing = [...current, ...added].filter((p) => p.tagId === m.tagId);
    if (existing.some((p) => same(p.form, line.form) && same(p.dose, line.dose) && same(p.timing, line.timing) && same(p.duration, line.duration) && same(p.adjuvant, line.adjuvant))) { skippedSame++; continue; }
    added.push(line);
  }
  return { lines: [...current, ...added], added: added.length, skippedSame, skippedUnavailable };
}

export function MamoolPicker({ visitId, onApply }: { visitId: string; onApply: (r: Regimen) => void }) {
  const t = useTranslations("clinic.mamool");
  const td = useTranslations("clinic.dossier");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Regimen[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setFailed(false); setData(null);
    api.get<{ regimens: Regimen[] }>(`/api/facility/mamool?visitId=${encodeURIComponent(visitId)}`)
      .then((r) => setData(r.regimens))
      .catch(() => setFailed(true));
  }, [visitId]);

  // Default view: only regimens suggested for this visit's complaints. Typing searches
  // every approved regimen (name, code, complaint, medicine) — not shown as a recommendation.
  const query = normalizeTerm(q);
  const shown = useMemo(() => {
    if (!data) return [];
    if (!query) return data.filter((r) => r.match.suggested);
    return data.filter((r) => normalizeTerm([r.name, r.code, ...r.complaints.map((c) => c.label), ...r.medicines.map((m) => m.name)].join(" ")).includes(query));
  }, [data, query]);

  const apply = (r: Regimen) => {
    onApply(r);
    setApplied((s) => new Set(s).add(r.id));
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); load(); }} data-tour="dossier.mamool"><BookMarked className="h-3.5 w-3.5" /> {t("button")}</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(""); setExpanded(null); setApplied(new Set()); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookMarked className="h-5 w-5 text-primary" /> {t("title")}</DialogTitle>
            <DialogDescription>{t("intro")}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_ph")} className="ps-9" aria-label={t("search_ph")} />
          </div>

          {failed ? (
            <InlineNotice tone="error" title={t("load_failed")} action={<Button size="sm" variant="outline" onClick={load}>{t("try_again")}</Button>} />
          ) : !data ? (
            <p className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{query ? t("results") : t("suggested")}</p>
              {shown.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {query ? t("none_found", { q }) : data.length ? t("none_match") : `${t("none_at_all")} ${t("none_match")}`}
                </p>
              )}
              {shown.map((r) => {
                const isOpen = expanded === r.id;
                const done = applied.has(r.id);
                return (
                  <div key={r.id} className={cn("rounded-xl border p-3 transition-colors", r.match.suggested ? "border-primary/30 bg-primary/[0.03]" : "border-border")}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.code} · {t("version", { n: r.version, name: r.approvedByName })} · {t("n_meds", { count: r.medicines.length })}</p>
                        <p className="mt-1 text-xs">
                          {r.match.matched.length > 0
                            ? <span className="text-emerald-700 dark:text-emerald-400">{t("matches", { list: r.match.matched.join(", ") })}</span>
                            : <span className="text-muted-foreground">{t("for_list", { list: r.complaints.map((c) => c.label).join(", ") })}</span>}
                          {r.match.missingRequired.length > 0 && <span className="text-amber-700 dark:text-amber-400"> · {t("needs", { list: r.match.missingRequired.join(", ") })}</span>}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : r.id)}>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {isOpen ? t("hide") : t("view")}
                        </Button>
                        <Button size="sm" onClick={() => apply(r)} disabled={done} variant={done ? "outline" : "default"}>
                          {done ? <><Check className="h-4 w-4" /> {t("applied")}</> : t("apply")}
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        {r.description && <p className="text-sm">{r.description}</p>}
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full min-w-[40rem] text-sm">
                            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr>{[td("cds_col_medicine"), td("form"), td("dose"), td("timing"), td("duration"), td("badraqa"), td("instructions")].map((h) => <th key={h} className="px-2.5 py-1.5 text-start font-semibold">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {r.medicines.map((m, i) => (
                                <tr key={i} className={cn(!m.available && "opacity-60")}>
                                  <td className="px-2.5 py-1.5 font-medium">
                                    <span className="inline-flex items-center gap-1.5">{m.kind === "medication" ? <Pill className="h-3.5 w-3.5 text-sky-600" /> : <Leaf className="h-3.5 w-3.5 text-primary" />}{m.name}</span>
                                    {!m.available && <span className="block text-[11px] text-destructive">{t("unavailable")}</span>}
                                  </td>
                                  {[m.form, m.dose, m.timing, m.duration, m.adjuvant, m.instructions].map((v, j) => <td key={j} className="px-2.5 py-1.5 text-muted-foreground">{v || "—"}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {r.clinicalNotes && <p className="text-xs"><span className="font-semibold">{t("clinical_notes")}:</span> <span className="text-muted-foreground">{r.clinicalNotes}</span></p>}
                        <p className="text-[11px] text-muted-foreground">{t("template_note")}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
