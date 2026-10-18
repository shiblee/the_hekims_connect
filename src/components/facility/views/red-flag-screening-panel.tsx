"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
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
}>(function RedFlagScreeningPanel({ visitId, onReferralChange }, ref) {
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
      .catch((e) => setLoadError(e.message || "Network error"))
      .finally(() => setLoading(false));
  }, [visitId, reloadTick]);

  const anyPresent = Object.values(present).some(Boolean) || custom.length > 0;
  const alreadyReferred = screening?.outcome === "referred";

  const flaggedSummary = () => {
    const flaggedLabels = [...criteria.filter((c) => present[c.id]).map((c) => c.label), ...custom];
    return flaggedLabels.length ? `Positive findings: ${flaggedLabels.join(", ")}` : "";
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
        msg.success("Recorded — continuing treatment against medical advice", "The patient's decision and acknowledgement are saved on this visit.");
      } else {
        // Clearing happens on "Proceed", which then opens Stage 3 — say it there.
        setFlash({ tone: "success", title: "Red flag screening cleared for Unani triage", detail: "No red flags were marked, so the visit continues to Mizaj & Morphometry." });
      }
      return true;
    } catch (e: any) {
      const notice = [
        outcome === "referred" ? "The referral wasn't saved" : outcome === "continued_ama" ? "The decision wasn't saved" : "The red flag screening wasn't saved",
        `${e.message || "Network error"}. Nothing you entered was lost — try again.`,
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
      dialogMsg.error("The referral wasn't updated", `${e.message || "Network error"}. Your changes are still here — try again.`, { retry: saveReferralEdit, retryLabel: "Save again" });
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
      msg.info("Referral removed", anyPresentRef() ? "Warning signs are still marked — choose Refer Patient or continue against advice before moving on." : "The emergency check will be confirmed when you proceed.");
    } catch (e: any) {
      dialogMsg.error("The referral wasn't removed", `${e.message || "Network error"}. Try again.`, { retry: removeReferral, retryLabel: "Try again" });
    } finally {
      setSaving(false);
    }
  };

  const submitReferral = () => {
    if (!referReason.trim()) { dialogMsg.warning("Enter a reason for referral", "It's recorded on the referral and in the visit history."); document.getElementById("referReason")?.focus(); return; }
    if (!referredTo.trim()) { dialogMsg.warning("Enter where the patient is being referred to", "For example Emergency Department or Cardiology."); document.getElementById("referredTo")?.focus(); return; }
    if (editingReferral) { saveReferralEdit(); return; }
    submitScreening("referred", { referral: { reason: referReason, referredTo, urgency, notes: referNotes || undefined } });
  };

  const submitAma = () => {
    if (!amaReason.trim()) { dialogMsg.warning("Enter why referral was recommended", "This documents the advice the patient declined."); return; }
    if (!amaAcknowledged) { dialogMsg.warning("Confirm the patient was informed of the risks", "Tick the acknowledgement box above to continue."); return; }
    submitScreening("continued_ama", { amaDecline: { reason: amaReason, patientReason: amaPatientReason || undefined, acknowledged: true } });
  };

  const attemptResolve = async (): Promise<boolean> => {
    if (!anyPresent) {
      if (screening?.outcome === "cleared") return true;
      return submitScreening("cleared");
    }
    if (screening?.outcome === "referred" || screening?.outcome === "continued_ama") return true;
    openReferDialog();
    return false;
  };

  useImperativeHandle(ref, () => ({ attemptResolve, openReferDialog, openEditReferral }), [anyPresent, screening, present, criteria, custom]);

  if (loadError) return <LoadFailed what="the emergency warning signs" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;
  if (loading) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
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
              <span className="text-lg font-semibold leading-tight">{editingReferral ? "Edit referral" : "Refer patient"}</span>
            </DialogTitle>
          </DialogHeader>

          {/* What triggered it */}
          {flaggedLabels.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1.5 flex items-center gap-1"><TriangleAlert className="h-3 w-3" /> Warning signs present</p>
              <div className="flex flex-wrap gap-1.5">
                {flaggedLabels.map((l) => <span key={l} className="rounded-full bg-destructive/10 border border-destructive/30 text-destructive px-2.5 py-0.5 text-[13px] font-medium">{l}</span>)}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground rounded-lg border border-dashed border-border/70 px-3 py-2">No emergency warning signs are marked — describe why the patient is being referred.</p>
          )}

          <FloatingTextarea id="referReason" label="Reason for referral" required value={referReason} onChange={(e) => setReferReason(e.target.value)} rows={2} />

          {/* Destination with one-tap suggestions */}
          <div className="space-y-2">
            <FloatingField id="referredTo" label="Refer to" required value={referredTo} onChange={(e) => setReferredTo(e.target.value)} />
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
            <p className="text-sm font-medium mb-2">How urgent?</p>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  aria-pressed={urgency === u.value}
                  className={cn(
                    "rounded-lg border-2 px-2.5 py-2 text-left transition-colors",
                    urgency === u.value ? u.tone : "border-border/60 hover:border-border",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold"><span className={cn("h-2 w-2 rounded-full", u.dot)} />{u.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{u.when}</span>
                </button>
              ))}
            </div>
          </div>

          <FloatingTextarea id="referNotes" label="Notes for the receiving doctor (optional)" value={referNotes} onChange={(e) => setReferNotes(e.target.value)} rows={2} />

          {/* What happens next */}
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {referredTo.trim()
                ? <>Refer to <span className="font-semibold text-foreground">{referredTo.trim()}</span> · <span className="font-semibold text-foreground">{urgency}</span>. </>
                : null}
              {editingReferral ? "Saving updates this visit\u2019s referral record." : "Confirming saves the referral to this visit and closes today\u2019s Unani consultation for it."}
            </span>
          </div>

          {/* Remove — edit mode only, confirmed in place */}
          {editingReferral && confirmRemove && (
            <InlineNotice
              tone="error"
              title="Remove this referral?"
              detail="The referral record is deleted and this visit goes back to needing an emergency decision. This can't be undone."
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={saving}>Keep</Button>
                  <Button size="sm" variant="destructive" onClick={removeReferral} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
                  </Button>
                </div>
              }
            />
          )}
          <NoticeSlot state={dialogMsg} />
          <DialogFooter className="sm:justify-between gap-2">
            {editingReferral ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto" onClick={() => setConfirmRemove(true)} disabled={saving || confirmRemove}>
                <Trash2 className="h-4 w-4" /> Remove referral
              </Button>
            ) : <span />}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReferDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitReferral} disabled={saving} className={URGENCY.find((u) => u.value === urgency)?.button}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingReferral ? <Pencil className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {editingReferral ? "Save changes" : "Confirm referral & close case"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={amaDialogOpen} onOpenChange={setAmaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Continue Against Medical Advice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Referral is clinically recommended based on the flagged findings. Use this only when the patient has been informed and still declines referral.
            </div>
            <FloatingField id="amaReason" label="Why referral was recommended" value={amaReason} onChange={(e) => setAmaReason(e.target.value)} />
            <Textarea maxLength={500}
              placeholder="Patient's stated reason for declining (optional)"
              value={amaPatientReason}
              onChange={(e) => setAmaPatientReason(e.target.value)}
              className="bg-background/60"
              rows={3}
            />
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox checked={amaAcknowledged} onCheckedChange={(v) => setAmaAcknowledged(!!v)} className="mt-0.5" />
              <span className="text-sm">
                I confirm the patient was informed of the risks of declining this referral, and they have chosen to continue treatment.
              </span>
            </label>
          </div>
          <NoticeSlot state={dialogMsg} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmaDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitAma} disabled={saving || !amaAcknowledged} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm &amp; Continue Treatment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // After a referral the signs are locked (the visit's emergency decision is made);
  // the referral itself is shown — and edited — on the line under the signature card.
  const locked = alreadyReferred && !!screening?.referral;


  return (
    <Card className={cn("p-4 gap-3 border-border/50 bg-card transition-colors", anyPresent && "border-destructive/40")}>
      <SectionHeading
        icon={anyPresent ? ShieldAlert : ShieldCheck}
        tone={anyPresent ? "danger" : "success"}
        title="Emergency Warning Signs"
        right={
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold",
            anyPresent || locked ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", anyPresent ? "bg-destructive animate-pulse" : "bg-emerald-500")} />
            {locked ? `Referred · ${presentCount ? `${presentCount} ${presentCount === 1 ? "sign" : "signs"}` : "no signs marked"}` : anyPresent ? `${presentCount} ${presentCount === 1 ? "sign" : "signs"} present` : "All clear · none present"}
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
          {presentCount === 0 && <span className="text-sm text-muted-foreground">No warning signs were marked.</span>}
          <span className="text-[13px] text-muted-foreground ml-auto">Locked after referral — to change, remove the referral (Edit on the referral line).</span>
        </div>
      ) : (
      <FloatingMultiSelect
        id="warningSignSearch"
        label="Search emergency warning signs"
        tone="destructive"
        labelIcon={TriangleAlert}
        itemIcon={TriangleAlert}
        placeholder="Type a sign — e.g. chest pain, bleeding, breathless…"
        openOnFocus
        emptyHint={criteria.length > 6 ? `Common signs · type to search all ${criteria.length}` : "Warning signs"}
        selected={[
          ...criteria.filter((c) => present[c.id]).map((c) => ({ id: c.id, label: c.label, description: c.description })),
          ...custom.map((label) => ({ id: `other:${label}`, label, description: "Added by staff" })),
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
        createLabel={(q) => `Add "${q}" as another warning sign`}
      />
      )}

      {anyPresent && !locked && screening?.outcome !== "continued_ama" && (
        <p className="text-[13px] text-destructive">
          Referral recommended — use <span className="font-semibold">Refer Patient</span> at the bottom of the page, or{" "}
          <button type="button" onClick={openAmaDialog} className="underline underline-offset-2 hover:text-destructive/80">continue against advice</button>.
        </p>
      )}

      {screening?.outcome === "continued_ama" && screening.amaDecline && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px]">
          <ShieldQuestion className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-amber-700 dark:text-amber-400">Continuing against medical advice</span>
            {" · "}{screening.amaDecline.reason}
            {screening.amaDecline.patientReason && <> · Patient: “{screening.amaDecline.patientReason}”</>}
            {" · "}{new Date(screening.amaDecline.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}
      <NoticeSlot state={msg} />

      {dialogs}
    </Card>
  );
});
