"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Pencil, ListChecks } from "lucide-react";

/**
 * One slim line under the signature card summarising the visit's referral —
 * urgency, destination, reason, notes, visit and time — with earlier
 * referrals (if any) tucked behind a "+N earlier" toggle.
 */
export function ReferralLine({ visits, onEdit, editHref, className }: { onEdit?: () => void; editHref?: string; className?: string; visits: { id: string; visitCode?: string; referral?: { reason: string; referredTo: string; urgency: string; notes: string | null; createdAt: string } | null }[] }) {
  const [open, setOpen] = useState(false);
  const row = (v: (typeof visits)[number], first: boolean) => {
    const r = v.referral!;
    const when = `${daysAgo(r.createdAt)}, ${new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    const full = `Referred (${r.urgency}) to ${r.referredTo}. Reason: ${r.reason}.${r.notes ? ` Notes: ${r.notes}.` : ""} ${v.visitCode ? `Visit ${v.visitCode}, ` : ""}${when}`;
    return (
      <div key={v.id} title={full} className="flex items-center gap-2 min-w-0 text-sm">
        {first ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive text-white px-2 py-0.5 text-[13px] font-semibold shrink-0">
            <ShieldAlert className="h-3 w-3" /> Referred · {r.urgency}
          </span>
        ) : (
          <span className="rounded-full border border-destructive/30 text-destructive px-2 py-0.5 text-xs font-medium shrink-0">{r.urgency}</span>
        )}
        <span className="shrink-0"><span className="text-muted-foreground">to</span> <span className="font-semibold">{r.referredTo}</span></span>
        <span className="truncate min-w-0 text-muted-foreground">
          · <span className="text-foreground">{r.reason}</span>
          {r.notes && <> · Notes: <span className="text-foreground">{r.notes}</span></>}
        </span>
        <span className="ml-auto shrink-0 text-[13px] text-muted-foreground whitespace-nowrap">{v.visitCode ? `${v.visitCode} · ` : ""}{when}</span>
      </div>
    );
  };
  return (
    <div className={cn("rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 space-y-1.5", className ?? "mb-6 -mt-3")}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{row(visits[0], true)}</div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
        {!onEdit && editHref && (
          <Link href={editHref} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium text-destructive hover:underline">
            <Pencil className="h-3 w-3" /> Edit in Clinical Record
          </Link>
        )}
        {visits.length > 1 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 text-[13px] font-medium text-destructive hover:underline">
            {open ? "Hide" : `+${visits.length - 1} earlier`}
          </button>
        )}
      </div>
      {open && <div className="border-t border-destructive/20 pt-1.5 space-y-1">{visits.slice(1).map((v) => row(v, false))}</div>}
    </div>
  );
}

/**
 * Stage 2 (triage) findings the main doctor needs on the later stages:
 * emergency warning signs and other symptoms, as one read-only line.
 */
export function TriageFindingsLine({ visit, editHref, className }: {
  visit: {
    redFlagScreening?: { outcome: string; answers: { criterionLabel: string; present: boolean }[] } | null;
    acuteSymptomAssessment?: { symptoms: string } | null;
    amaDecline?: { createdAt: string } | null;
  };
  editHref?: string;
  className?: string;
}) {
  const ws = visit.redFlagScreening;
  const signs = (ws?.answers || []).filter((a) => a.present).map((a) => a.criterionLabel);
  let symptoms: string[] = [];
  try { symptoms = JSON.parse(visit.acuteSymptomAssessment?.symptoms || "[]"); } catch { symptoms = []; }
  const decided = ws && ["cleared", "referred", "continued_ama"].includes(ws.outcome);

  return (
    <div className={cn("rounded-xl border px-3 py-2 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-sm", signs.length ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-card", className ?? "mb-6 -mt-3")}>
      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">From triage</span>

      <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
        {signs.length ? <ShieldAlert className="h-4 w-4 text-destructive shrink-0" /> : decided ? <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <ShieldQuestion className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
        <span className="text-muted-foreground">Warning signs:</span>
        {signs.length ? signs.map((sgn) => (
          <span key={sgn} className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[13px] font-medium text-destructive">{sgn}</span>
        )) : (
          <span className={decided ? "font-medium text-emerald-700 dark:text-emerald-400" : "font-medium text-amber-700 dark:text-amber-400"}>{ws ? (decided ? "None marked" : "Not yet decided") : "Not assessed"}</span>
        )}
        {visit.amaDecline && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[13px] font-medium text-amber-700 dark:text-amber-400">Declined referral</span>}
      </span>

      <span className="hidden sm:block h-4 w-px bg-border" aria-hidden />

      <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <ListChecks className="h-4 w-4 text-primary shrink-0" />
        <span className="text-muted-foreground">Other symptoms:</span>
        {symptoms.length ? symptoms.map((sy) => (
          <span key={sy} className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[13px] font-medium text-primary">{sy}</span>
        )) : <span className="font-medium text-muted-foreground">{visit.acuteSymptomAssessment ? "None noted" : "Not assessed"}</span>}
      </span>

      {editHref && (
        <Link href={editHref} className="ml-auto shrink-0 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
          <Pencil className="h-3 w-3" /> Edit in Clinical Record
        </Link>
      )}
    </div>
  );
}
