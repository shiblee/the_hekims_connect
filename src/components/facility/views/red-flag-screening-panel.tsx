"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { setFlash } from "@/lib/flash";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, Check } from "lucide-react";

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
}

export const RedFlagScreeningPanel = forwardRef<RedFlagScreeningPanelHandle, { visitId: string }>(function RedFlagScreeningPanel({ visitId }, ref) {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [screening, setScreening] = useState<Screening | null>(null);
  const [present, setPresent] = useState<Record<string, boolean>>({});
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
        for (const a of screenRes.screening?.answers || []) {
          if (a.criterionId) initial[a.criterionId] = a.present;
        }
        setPresent(initial);
      })
      .catch((e) => setLoadError(e.message || "Network error"))
      .finally(() => setLoading(false));
  }, [visitId, reloadTick]);

  const anyPresent = Object.values(present).some(Boolean);
  const alreadyReferred = screening?.outcome === "referred";

  const flaggedSummary = () => {
    const flaggedLabels = criteria.filter((c) => present[c.id]).map((c) => c.label);
    return flaggedLabels.length ? `Positive findings: ${flaggedLabels.join(", ")}` : "";
  };

  const openReferDialog = () => {
    setReferReason(flaggedSummary());
    setReferredTo("");
    setUrgency("Emergency");
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
        outcome,
        ...extra,
      });
      setScreening(res.screening);
      msg.clear();
      if (outcome === "referred") {
        // The panel itself turns into the "Patient Referred — Case Closed" card.
        setReferDialogOpen(false);
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

  const submitReferral = () => {
    if (!referReason.trim()) { dialogMsg.warning("Enter a reason for referral", "It's recorded on the referral and in the visit history."); document.getElementById("referReason")?.focus(); return; }
    if (!referredTo.trim()) { dialogMsg.warning("Enter where the patient is being referred to", "For example Emergency Department or Cardiology."); document.getElementById("referredTo")?.focus(); return; }
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

  useImperativeHandle(ref, () => ({ attemptResolve, openReferDialog }), [anyPresent, screening, present, criteria]);

  if (loadError) return <LoadFailed what="the emergency warning signs" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;
  if (loading) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  if (alreadyReferred && screening?.referral) {
    const r = screening.referral;
    return (
      <Card className="p-5 border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Patient Referred — Case Closed</h2>
            <p className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
          </div>
          <Badge variant="outline" className="ml-auto border-destructive/40 text-destructive shrink-0">{r.urgency}</Badge>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Referred to:</span> <span className="font-medium">{r.referredTo}</span></p>
          <p><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
          {r.notes && <p><span className="text-muted-foreground">Notes:</span> {r.notes}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-border/50 bg-card/60">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", anyPresent ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")}>
            {anyPresent ? <ShieldAlert className="h-4.5 w-4.5" /> : <ShieldCheck className="h-4.5 w-4.5" />}
          </div>
          <h2 className="font-serif text-lg font-semibold">Emergency Warning Signs</h2>
        </div>
        <Badge
          variant="outline"
          className={cn("shrink-0", anyPresent ? "border-destructive/40 text-destructive" : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400")}
        >
          {anyPresent ? "Positive Findings — Referral Recommended" : "Negative / Cleared for Unani Triage"}
        </Badge>
      </div>

      {screening?.outcome === "continued_ama" && screening.amaDecline && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-3">
          <ShieldQuestion className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Continuing Against Medical Advice</p>
            <p className="text-muted-foreground mt-0.5">
              Referral was recommended ({screening.amaDecline.reason}) but the patient chose to continue treatment on {new Date(screening.amaDecline.createdAt).toLocaleString()}.
            </p>
            {screening.amaDecline.patientReason && (
              <p className="text-muted-foreground mt-0.5">Patient&apos;s reason: {screening.amaDecline.patientReason}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {criteria.map((c) => {
          const checked = !!present[c.id];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPresent((p) => ({ ...p, [c.id]: !p[c.id] }))}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                checked ? "border-destructive/50 bg-destructive/10" : "border-border/50 bg-background/40 hover:border-primary/30"
              )}
            >
              <span className={cn(
                "h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5",
                checked ? "bg-destructive border-destructive text-white" : "border-border/60"
              )}>
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", checked && "text-destructive")}>{c.label}</span>
                {c.description && <span className="block text-xs text-muted-foreground mt-0.5">{c.description}</span>}
              </span>
            </button>
          );
        })}
        {criteria.length === 0 && <p className="text-sm text-muted-foreground">No red flag criteria configured yet.</p>}
      </div>
      {anyPresent && (
        <p className="text-xs text-muted-foreground">
          Positive findings require a referral decision — use the bottom-of-page <span className="font-medium text-foreground">Refer Patient</span> action, or <button type="button" onClick={openAmaDialog} className="text-primary hover:underline font-medium">continue against medical advice</button>.
        </p>
      )}
      <NoticeSlot state={msg} />

      <Dialog open={referDialogOpen} onOpenChange={setReferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refer Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField id="referReason" label="Reason for referral" value={referReason} onChange={(e) => setReferReason(e.target.value)} />
            <FloatingField id="referredTo" label="Referred to (e.g. Emergency Department, Cardiology)" value={referredTo} onChange={(e) => setReferredTo(e.target.value)} />
            <FloatingSelect id="urgency" label="Urgency" value={urgency} onValueChange={setUrgency}>
              <SelectItem value="Emergency">Emergency</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
              <SelectItem value="Routine">Routine</SelectItem>
            </FloatingSelect>
            <Textarea placeholder="Additional notes (optional)" value={referNotes} onChange={(e) => setReferNotes(e.target.value)} className="bg-background/60" rows={3} />
          </div>
          <NoticeSlot state={dialogMsg} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReferral} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm Referral &amp; Close Case
            </Button>
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
            <Textarea
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
    </Card>
  );
});
