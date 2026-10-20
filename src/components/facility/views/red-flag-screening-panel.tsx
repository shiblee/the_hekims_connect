"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useDateLocale, useListFormat, useValueLabel } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { InlineNotice, LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { SectionHeading } from "@/components/shared/section-heading";
import { setFlash } from "@/lib/flash";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FloatingField, FloatingMultiSelect, FloatingTextarea } from "@/components/shared/floating-field";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, TriangleAlert, Sparkles, Info, Pencil, Trash2 } from "lucide-react";

interface Criterion { id: string; label: string; description: string | null }
interface Answer { id: string; criterionId: string | null; criterionLabel: string; present: boolean }
interface ReferralRecord { id: string; reason: string; referredTo: string; urgency: string; notes: string | null; createdAt: string }
interface AmaRecord { id: string; reason: string; patientReason: string | null; createdAt: string }
interface Screening { id: string; outcome: string; createdAt: string; updatedAt: string; answers: Answer[]; referral: ReferralRecord | null; amaDecline: AmaRecord | null }

export interface RedFlagScreeningPanelHandle {
  /** Resolves true when clear to proceed (cleared, or already referred/AMA'd).
   * If flags are present and unresolved, opens the Refer dialog and resolves
   * false — the caller should stop and let the doctor resolve it, then retry. */
  attemptResolve: () => Promise<boolean>;
  openReferDialog: () => void;
  /** Save Draft: store the marked signs (no referral decision). */
  save: () => Promise<void>;
  /** Reopen the referral pop-up pre-filled with the saved referral, to correct or remove it. */
  openEditReferral: () => void;
}

// Where a patient is usually sent for a given warning sign — offered as one-tap suggestions.
const DESTINATION_HINTS: [RegExp, string][] = [
  [/chest|angina|palpit|cardiac|heart/i, "Cardiology"],
  [/dyspn|breath|respirat|asthma|copd/i, "Pulmonology"],
  [/neuro|stroke|tia|conscious|gcs|seizure|fast screen/i, "Neurology"],
  [/abdom|peritoni|surgical|appendic/i, "General Surgery"],
  [/pregnan|obstet|bleeding per vagin/i, "Obstetrics & Gynaecology"],
];
const COMMON_DESTINATIONS = [
  "Emergency Department", "General Physician (Allopathic)", "Cardiology", "Neurology", "Pulmonology",
  "General Surgery", "Obstetrics & Gynaecology", "Paediatrics", "Orthopaedics",
];
const URGENCY = [
  { value: "Emergency", label: "Emergency", when: "Send immediately", tone: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400", dot: "bg-red-500", button: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "Urgent", label: "Urgent", when: "Within 24 hours", tone: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500", button: "bg-amber-600 hover:bg-amber-700 text-white" },
  { value: "Routine", label: "Routine", when: "Planned appointment", tone: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400", dot: "bg-sky-500", button: "bg-sky-600 hover:bg-sky-700 text-white" },
] as const;

export const RedFlagScreeningPanel = forwardRef<RedFlagScreeningPanelHandle, {
  visitId: string;
  /** Called after a referral is made, edited or removed, so the page can refresh its referral line. */
  onReferralChange?: () => void;
  /** Render only the referral / AMA pop-ups (for later stages, which refer without showing the signs list). */
  dialogsOnly?: boolean;
  /** Called when the patient / family declines the referral offered on "Proceed", so the page moves on to the next stage. */
  onContinue?: () => void;
}>(function RedFlagScreeningPanel({ visitId, onReferralChange, dialogsOnly, onContinue }, ref) {
  // Set while the referral pop-up was opened by "Proceed": a recorded decline then carries on to the next stage.
  const fromProceed = useRef(false);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [screening, setScreening] = useState<Screening | null>(null);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  // "Other" warning signs typed in by staff (not in the admin list).
  const [custom, setCustom] = useState<string[]>([]);
  const [signQuery, setSignQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // `msg` sits in the panel; `dialogMsg` inside whichever decision dialog is open.
  const msg = useNotice();
  const dialogMsg = useNotice();
  const t = useTranslations("clinic.redflag");
  const tc = useTranslations("common");
  const vl = useValueLabel();
  const dl = useDateLocale();
  const list = useListFormat();

  const [referDialogOpen, setReferDialogOpen] = useState(false);
  const [referReason, setReferReason] = useState("");
  const [referredTo, setReferredTo] = useState("");
  const [urgency, setUrgency] = useState("Emergency");
  const [referNotes, setReferNotes] = useState("");
  const [editingReferral, setEditingReferral] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [amaDialogOpen, setAmaDialogOpen] = useState(false);
  const [amaReason, setAmaReason] = useState("");
  const [amaPatientReason, setAmaPatientReason] = useState("");
  const [amaAcknowledged, setAmaAcknowledged] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ criteria: Criterion[] }>("/api/facility/red-flags"),
      api.get<{ screening: Screening | null }>(`/api/facility/visits/${visitId}/red-flag-screening`),
    ])
      .then(([critRes, screenRes]) => {
        setLoadError(null);
        setCriteria(critRes.criteria || []);
        setScreening(screenRes.screening);
        const initial: Record<string, boolean> = {};
        const others: string[] = [];
        for (const a of screenRes.screening?.answers || []) {
          if (a.criterionId) initial[a.criterionId] = a.present;
          else if (a.present) others.push(a.criterionLabel);
        }
        setPresent(initial);
        setCustom(others);
      })
      .catch((e) => setLoadError(e.message || tc("network_error")))
      .finally(() => setLoading(false));
  }, [visitId, reloadTick]);

  const anyPresent = Object.values(present).some(Boolean) || custom.length > 0;
  const alreadyReferred = screening?.outcome === "referred";

  const flaggedSummary = () => {
    const flaggedLabels = [...criteria.filter((c) => present[c.id]).map((c) => c.label), ...custom];
    return flaggedLabels.length ? t("positive", { items: list(flaggedLabels) }) : "";
  };

  const anyPresentRef = () => Object.values(present).some(Boolean) || custom.length > 0;
  const openEditReferral = () => {
    const r = screening?.referral;
    if (!r) return;
    setReferReason(r.reason);
    setReferredTo(r.referredTo);
    setUrgency(r.urgency);
    setReferNotes(r.notes || "");
    setEditingReferral(true);
    setConfirmRemove(false);
    dialogMsg.clear();
    setReferDialogOpen(true);
  };
  const openReferDialog = () => {
    fromProceed.current = false;
    setEditingReferral(false);
    setConfirmRemove(false);
    setReferReason(flaggedSummary());
    setReferredTo("");
    setUrgency(anyPresentRef() ? "Emergency" : "Urgent");
    setReferNotes("");
    dialogMsg.clear();
    setReferDialogOpen(true);
  };

  const openAmaDialog = () => {
    setAmaReason(flaggedSummary());
    setAmaPatientReason("");
    setAmaAcknowledged(false);
    dialogMsg.clear();
    setAmaDialogOpen(true);
  };

  const submitScreening = async (
    outcome: "cleared" | "referred" | "continued_ama",
    extra?: { referral?: { reason: string; referredTo: string; urgency: string; notes?: string }; amaDecline?: { reason: string; patientReason?: string; acknowledged: boolean } }
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await api.post<{ screening: Screening }>(`/api/facility/visits/${visitId}/red-flag-screening`, {
        answers: criteria.map((c) => ({ criterionId: c.id, present: !!present[c.id] })),
        custom,
        outcome,
        ...extra,
      });
      setScreening(res.screening);
      msg.clear();
      if (outcome === "referred") {
        // The page shows it as a one-line summary under the signature card.
        setReferDialogOpen(false);
        onReferralChange?.();
      } else if (outcome === "continued_ama") {
        setAmaDialogOpen(false);
        msg.success(t("ama_saved"), t("ama_saved_hint"));
        if (fromProceed.current && onContinue) { fromProceed.current = false; onContinue(); }
      } else {
        // Clearing happens on "Proceed", which then opens Stage 3 — say it there.
        setFlash({ tone: "success", title: t("cleared"), detail: t("cleared_hint") });
      }
      return true;
    } catch (e: any) {
      const notice = [
        outcome === "referred" ? t("ref_not_saved") : outcome === "continued_ama" ? t("decision_not_saved") : t("screen_not_saved"),
        t("nothing_lost", { error: e.message || tc("network_error") }),
      ] as const;
      if (outcome === "cleared") msg.error(...notice);
      else dialogMsg.error(...notice);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveReferralEdit = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ referral: ReferralRecord }>(`/api/facility/visits/${visitId}/referral`, { reason: referReason, referredTo, urgency, notes: referNotes });
      setScreening((sc) => (sc ? { ...sc, referral: res.referral } : sc));
      setReferDialogOpen(false);
      onReferralChange?.();
    } catch (e: any) {
      dialogMsg.error(t("ref_not_updated"), t("changes_here", { error: e.message || tc("network_error") }), { retry: saveReferralEdit, retryLabel: t("save_again") });
    } finally {
      setSaving(false);
    }
  };

  const removeReferral = async () => {
    setSaving(true);
    try {
      await api.delete(`/api/facility/visits/${visitId}/referral`);
      setScreening((sc) => (sc ? { ...sc, referral: null, outcome: "pending" } : sc));
      setReferDialogOpen(false);
      setConfirmRemove(false);
      onReferralChange?.();
      msg.info(t("ref_removed"), anyPresentRef() ? t("ref_removed_signs") : t("ref_removed_none"));
    } catch (e: any) {
      dialogMsg.error(t("ref_not_removed"), t("try_again", { error: e.message || tc("network_error") }), { retry: removeReferral, retryLabel: tc("retry") });
    } finally {
      setSaving(false);
    }
  };

  const submitReferral = () => {
    if (!referReason.trim()) { dialogMsg.warning(t("need_reason"), t("need_reason_hint")); document.getElementById("referReason")?.focus(); return; }
    if (!referredTo.trim()) { dialogMsg.warning(t("need_to"), t("need_to_hint")); document.getElementById("referredTo")?.focus(); return; }
    if (editingReferral) { saveReferralEdit(); return; }
    submitScreening("referred", { referral: { reason: referReason, referredTo, urgency, notes: referNotes || undefined } });
  };

  const submitAma = () => {
    if (!amaReason.trim()) { dialogMsg.warning(t("need_ama_reason"), t("need_ama_reason_hint")); return; }
    if (!amaAcknowledged) { dialogMsg.warning(t("need_ack"), t("need_ack_hint")); return; }
    submitScreening("continued_ama", { amaDecline: { reason: amaReason, patientReason: amaPatientReason || undefined, acknowledged: true } });
  };

  const attemptResolve = async (): Promise<boolean> => {
    if (!anyPresent) {
      if (screening?.outcome === "cleared") return true;
      return submitScreening("cleared");
    }
    if (screening?.outcome === "referred" || screening?.outcome === "continued_ama") return true;
    openReferDialog();
    fromProceed.current = true;
    return false;
  };

  const saveDraft = async () => {
    // Nothing to store: still loading, locked after referral, or nothing marked on a fresh visit.
    if (loading || loadError || screening?.outcome === "referred") return;
    if (!screening && !anyPresent) return;
    try {
      const res = await api.post<{ screening: Screening }>(`/api/facility/visits/${visitId}/red-flag-screening`, {
        draft: true,
        answers: criteria.map((c) => ({ criterionId: c.id, present: !!present[c.id] })),
        custom,
      });
      setScreening(res.screening);
    } catch (e: any) {
      msg.error(t("signs_not_saved"), t("signs_not_saved_hint", { error: e.message || tc("network_error") }), { retry: () => { saveDraft().catch(() => {}); } });
      throw e;
    }
  };

  useImperativeHandle(ref, () => ({ attemptResolve, openReferDialog, openEditReferral, save: saveDraft }), [anyPresent, screening, present, criteria, custom, loading, loadError]);

  if (dialogsOnly && (loading || loadError)) return null;
  if (loadError) return <LoadFailed what={t("the_signs")} detail={loadError} onRetry={() => { setLoading(true); setReloadTick((n) => n + 1); }} />;
  if (loading) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}
      </Card>
    );
  }


  const presentCount = criteria.filter((c) => present[c.id]).length + custom.length;
  const flaggedLabels = [...criteria.filter((c) => present[c.id]).map((c) => c.label), ...custom];
  const suggestedDestinations = new Set<string>(flaggedLabels.length ? ["Emergency Department"] : []);
  for (const l of flaggedLabels) for (const [re, dest] of DESTINATION_HINTS) if (re.test(l)) suggestedDestinations.add(dest);
  const destinationOptions = [
    ...[...suggestedDestinations].map((name) => ({ name, suggested: true })),
    ...COMMON_DESTINATIONS.filter((d) => !suggestedDestinations.has(d)).map((name) => ({ name, suggested: false })),
  ];
  const sq = signQuery.trim().toLowerCase();
  // Search the admin list by name or description; with nothing typed, offer the first few.
  const signSuggestions = criteria
    .filter((c) => !present[c.id] && (!sq || c.label.toLowerCase().includes(sq) || (c.description || "").toLowerCase().includes(sq)))
    .slice(0, sq ? 12 : 6);
  const addCustomSign = (text: string) => {
    const match = criteria.find((c) => c.label.toLowerCase() === text.toLowerCase());
    if (match) { setPresent((p) => ({ ...p, [match.id]: true })); return; }
    setCustom((cur) => (cur.some((x) => x.toLowerCase() === text.toLowerCase()) ? cur : [...cur, text]));
  };

  const dialogs = (
    <>
      <Dialog open={referDialogOpen} onOpenChange={setReferDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto gap-4 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0"><ShieldAlert className="h-5 w-5" /></span>
              <span className="text-lg font-semibold leading-tight">{editingReferral ? t("edit_ref") : t("refer")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* What triggered it */}
          {flaggedLabels.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1.5 flex items-center gap-1"><TriangleAlert className="h-3 w-3" /> {t("signs_present")}</p>
              <div className="flex flex-wrap gap-1.5">
                {flaggedLabels.map((l) => <span key={l} className="rounded-full bg-destructive/10 border border-destructive/30 text-destructive px-2.5 py-0.5 text-[13px] font-medium">{l}</span>)}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground rounded-lg border border-dashed border-border/70 px-3 py-2">{t("no_signs")}</p>
          )}

          <FloatingTextarea id="referReason" label={t("reason")} required value={referReason} onChange={(e) => setReferReason(e.target.value)} rows={2} />

          {/* Destination with one-tap suggestions */}
          <div className="space-y-2">
            <FloatingField id="referredTo" label={t("refer_to")} required value={referredTo} onChange={(e) => setReferredTo(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {destinationOptions.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => setReferredTo(d.name)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                    referredTo === d.name ? "border-primary bg-primary text-primary-foreground" : d.suggested ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  {d.suggested && referredTo !== d.name && <Sparkles className="h-3 w-3" />}{d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Urgency as clear choices */}
          <div>
            <p className="text-sm font-medium mb-2">{t("how_urgent")}</p>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  aria-pressed={urgency === u.value}
                  className={cn(
                    "rounded-lg border-2 px-2.5 py-2 text-start transition-colors",
                    urgency === u.value ? u.tone : "border-border/60 hover:border-border",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold"><span className={cn("h-2 w-2 rounded-full", u.dot)} />{vl(u.value)}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t(`urg_${u.value}_when`)}</span>
                </button>
              ))}
            </div>
          </div>

          <FloatingTextarea id="referNotes" label={t("notes")} value={referNotes} onChange={(e) => setReferNotes(e.target.value)} rows={2} />

          {/* What happens next */}
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {referredTo.trim()
                ? <>{t.rich("summary", { to: referredTo.trim(), urgency: vl(urgency), b: (c) => <span className="font-semibold text-foreground">{c}</span> })} </>
                : null}
              {editingReferral ? t("saving_updates") : t("confirming_closes")}
            </span>
          </div>

          {/* Remove — edit mode only, confirmed in place */}
          {editingReferral && confirmRemove && (
            <InlineNotice
              tone="error"
              title={t("remove_q")}
              detail={t("remove_hint")}
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={saving}>{tc("keep")}</Button>
                  <Button size="sm" variant="destructive" onClick={removeReferral} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {tc("remove")}
                  </Button>
                </div>
              }
            />
          )}
          {/* Patient / family won't go — record it and carry on with treatment here */}
          {!editingReferral && anyPresent && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <span className="text-[13px] text-amber-800 dark:text-amber-300">{t("decline_q")}</span>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/50 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800 dark:text-amber-400"
                onClick={() => { const keep = fromProceed.current; setReferDialogOpen(false); openAmaDialog(); fromProceed.current = keep; }}
                disabled={saving}
              >
                <ShieldQuestion className="h-3.5 w-3.5" /> {t("family_declines")}
              </Button>
            </div>
          )}
          <NoticeSlot state={dialogMsg} />
          <DialogFooter className="sm:justify-between gap-2">
            {editingReferral ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:me-auto" onClick={() => setConfirmRemove(true)} disabled={saving || confirmRemove}>
                <Trash2 className="h-4 w-4" /> {t("remove_ref")}
              </Button>
            ) : <span />}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReferDialogOpen(false)}>{tc("cancel")}</Button>
              <Button onClick={submitReferral} disabled={saving} className={URGENCY.find((u) => u.value === urgency)?.button}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingReferral ? <Pencil className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {editingReferral ? tc("save_changes") : t("confirm_close")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={amaDialogOpen} onOpenChange={setAmaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ama_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              {t("ama_info")}
            </div>
            <FloatingField id="amaReason" label={t("ama_reason")} value={amaReason} onChange={(e) => setAmaReason(e.target.value)} />
            <Textarea maxLength={500}
              placeholder={t("ama_patient")}
              value={amaPatientReason}
              onChange={(e) => setAmaPatientReason(e.target.value)}
              className="bg-background/60"
              rows={3}
            />
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox checked={amaAcknowledged} onCheckedChange={(v) => setAmaAcknowledged(!!v)} className="mt-0.5" />
              <span className="text-sm">
                {t("ama_ack")}
              </span>
            </label>
          </div>
          <NoticeSlot state={dialogMsg} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmaDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={submitAma} disabled={saving || !amaAcknowledged} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("ama_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (dialogsOnly) return dialogs;

  // After a referral the signs are locked (the visit's emergency decision is made);
  // the referral itself is shown — and edited — on the line under the signature card.
  const locked = alreadyReferred && !!screening?.referral;


  return (
    <Card className={cn("p-4 gap-3 border-border/50 bg-card transition-colors", anyPresent && "border-destructive/40")}>
      <SectionHeading
        icon={anyPresent ? ShieldAlert : ShieldCheck}
        tone={anyPresent ? "danger" : "success"}
        title={t("title")}
        right={
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold",
            anyPresent || locked ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", anyPresent ? "bg-destructive animate-pulse" : "bg-emerald-500")} />
            {locked ? t("referred_signs", { signs: presentCount ? t("n_signs", { count: presentCount }) : t("no_signs_marked") }) : anyPresent ? t("n_present", { count: presentCount }) : t("all_clear")}
          </span>
        }
      />

      {locked ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {[...criteria.filter((c) => present[c.id]).map((c) => c.label), ...custom].map((l) => (
            <span key={l} className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-sm text-destructive">
              <TriangleAlert className="h-3 w-3" />{l}
            </span>
          ))}
          {presentCount === 0 && <span className="text-sm text-muted-foreground">{t("none_were")}</span>}
          <span className="text-[13px] text-muted-foreground ms-auto">{t("locked")}</span>
        </div>
      ) : (
      <FloatingMultiSelect
        id="warningSignSearch"
        label={t("search")}
        tone="destructive"
        labelIcon={TriangleAlert}
        itemIcon={TriangleAlert}
        placeholder={t("search_ph")}
        openOnFocus
        emptyHint={criteria.length > 6 ? t("common", { count: criteria.length }) : t("signs")}
        selected={[
          ...criteria.filter((c) => present[c.id]).map((c) => ({ id: c.id, label: c.label, description: c.description })),
          ...custom.map((label) => ({ id: `other:${label}`, label, description: t("added_by_staff") })),
        ]}
        onRemove={(sid) => {
          if (sid.startsWith("other:")) setCustom((cur) => cur.filter((x) => `other:${x}` !== sid));
          else setPresent((p) => ({ ...p, [sid]: false }));
        }}
        query={signQuery}
        onQueryChange={setSignQuery}
        results={signSuggestions}
        describe={(c) => c.description}
        onPick={(cid) => setPresent((p) => ({ ...p, [cid]: true }))}
        onCreate={addCustomSign}
        createLabel={(q) => t("add_other", { q })}
      />
      )}

      {anyPresent && !locked && screening?.outcome !== "continued_ama" && (
        <p className="text-[13px] text-destructive">
          {t.rich("recommended", {
            b: (c) => <span className="font-semibold">{c}</span>,
            ama: (c) => <button type="button" onClick={openAmaDialog} className="underline underline-offset-2 hover:text-destructive/80">{c}</button>,
          })}
        </p>
      )}

      {screening?.outcome === "continued_ama" && screening.amaDecline && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px]">
          <ShieldQuestion className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-amber-700 dark:text-amber-400">{t("continuing_ama")}</span>
            {" · "}{screening.amaDecline.reason}
            {screening.amaDecline.patientReason && <> · {t("patient_quote", { reason: screening.amaDecline.patientReason })}</>}
            {" · "}{new Date(screening.amaDecline.createdAt).toLocaleDateString(dl)}
          </p>
        </div>
      )}
      <NoticeSlot state={msg} />

      {dialogs}
    </Card>
  );
});
