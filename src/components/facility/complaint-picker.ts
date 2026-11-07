"use client";

import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { isSameTerm, matchedAlias, searchEntries } from "@/lib/complaint-search";
import type { NoticeState } from "@/components/shared/inline-notice";

/**
 * Shared chief-complaint picking for registration, the doctor's complaint list
 * and screening: one search, one way to add a complaint that isn't listed.
 * A new complaint is usable on the visit straight away as "pending review";
 * the master list only changes when an Admin reviewer approves it.
 */
export interface PickComplaint {
  id: string; // master id, or "req:<id>" for this clinic's pending request
  label: string;
  labelLocal?: string | null;
  synonyms?: unknown;
  category?: string | null;
  active?: boolean;
  pending?: boolean;
}

export interface ComplaintConfigResponse {
  complaints: PickComplaint[];
  frequent?: string[];
  pending?: { id: string; term: string; status: string }[];
}

/** Master complaints (active) plus this clinic's pending requests, as one pickable list. */
export function pickableComplaints(cfg: ComplaintConfigResponse): PickComplaint[] {
  return [
    ...(cfg.complaints || []).filter((c) => c.active !== false),
    ...(cfg.pending || []).map((r) => ({ id: `req:${r.id}`, label: r.term, pending: true })),
  ];
}

/** Search results; with nothing typed, the clinic's most-used complaints. */
export function complaintResults(options: PickComplaint[], query: string, exclude: (c: PickComplaint) => boolean, frequent: string[] = [], limit = 10) {
  const pool = options.filter((c) => !exclude(c));
  if (!query.trim()) {
    const byId = new Map(pool.map((c) => [c.id, c]));
    return frequent.map((id) => byId.get(id)).filter((c): c is PickComplaint => !!c);
  }
  return searchEntries(pool, query, limit);
}

export function useComplaintPickerText() {
  const t = useTranslations("clinic.complaint_pick");
  return {
    t,
    /** Second line under a result: why it matched, its category, or "pending review". */
    describe: (c: PickComplaint, query: string) => {
      if (c.pending) return t("pending");
      const alias = matchedAlias(c, query);
      return [alias ? t("also_called", { alias }) : null, c.category].filter(Boolean).join(" · ") || null;
    },
    pendingChip: (c: PickComplaint) => (c.pending ? "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300 border-dashed" : undefined),
  };
}

type RequestResponse =
  | { kind: "match"; complaint: { id: string; label: string } }
  | { kind: "request"; request: { id: string; term: string; status: string } }
  | { kind: "rejected"; term: string; note: string | null };

/** Ask for a complaint that isn't listed. Returns what to select, or null (message already shown). */
export async function requestNewComplaint(term: string, notice: NoticeState, t: ReturnType<typeof useTranslations>): Promise<PickComplaint | null> {
  try {
    const r = await api.post<RequestResponse>("/api/facility/master-requests", { listKey: "chief_complaint", term });
    if (r.kind === "match") {
      notice.info(t("exists", { term, label: r.complaint.label }));
      return { id: r.complaint.id, label: r.complaint.label };
    }
    if (r.kind === "request") {
      notice.success(t("sent", { term: r.request.term }));
      return { id: `req:${r.request.id}`, label: r.request.term, pending: true };
    }
    notice.warning(r.note ? t("rejected", { term: r.term, note: r.note }) : t("rejected_plain", { term: r.term }));
    return null;
  } catch (e: any) {
    notice.error(t("failed", { term, error: e?.message || "" }));
    return null;
  }
}

/** Offer "add as new" only when the typed words don't already mean a listed (or chosen) complaint. */
export function canRequestNew(query: string, options: PickComplaint[]): boolean {
  const q = query.trim();
  return q.length >= 2 && !options.some((c) => isSameTerm(q, c));
}
