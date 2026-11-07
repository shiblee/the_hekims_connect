"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, GitMerge, Inbox, Loader2, Plus, ShieldCheck, XCircle } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingTextarea } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";

interface RequestRow {
  id: string;
  listKey: "chief_complaint" | "allergy" | "medication";
  kind: string | null;
  term: string;
  terms: string[];
  status: "pending" | "approved" | "merged" | "rejected";
  clinics: { id: string; name: string; requestedByName: string; at: string; visits: number }[];
  visits: number;
  createdAt: string;
  resolvedLabel: string | null;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  similar: { id: string; label: string; category: string }[];
}
interface TargetRow { id: string; label: string; group: string | null }

const LIST_LABEL = (r: { listKey: string; kind: string | null }) =>
  r.listKey === "allergy" ? "Allergy" : r.listKey === "medication" ? (r.kind === "medication" ? "Allopathic medicine" : "Unani medicine / herb") : "Chief complaint";
const LIST_NOUN = (r: { listKey: string; kind: string | null }) => (r.listKey === "allergy" ? "allergy" : r.listKey === "medication" ? "medicine" : "chief complaint");

const STATUS: Record<RequestRow["status"], { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Pending", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Clock },
  approved: { label: "Added as new", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  merged: { label: "Merged", cls: "border-primary/40 bg-primary/10 text-primary", icon: GitMerge },
  rejected: { label: "Not added", cls: "border-destructive/40 bg-destructive/10 text-destructive", icon: XCircle },
};

type Mode = { kind: "approve" | "merge" | "reject"; row: RequestRow } | null;

/**
 * Admin → Requests. Terms clinicians typed that weren't in a master list
 * (chief complaints for now). Until reviewed they stay on the visit as the
 * clinician's words and drive no clinical rules. Reviewing:
 *  - Merge: it's an existing complaint in other words → becomes a synonym (search learns it).
 *  - Add as new: a genuine Unani complaint missing from the list.
 *  - Don't add: a diagnosis, a sign, a typo… with a reason the clinic sees.
 * Identical requests from several clinics are reviewed once; their visits are re-linked.
 */
export default function MasterRequestsPage() {
  const [tab, setTab] = useState<"pending" | "resolved">("pending");
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", labelLocal: "", category: "", kind: "supplement", synonyms: "", targetId: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.get<{ requests: RequestRow[]; categories: string[]; targets: Record<string, TargetRow[]> }>(`/api/admin/master-requests?status=${tab}`);
      setRows(r.requests);
      setCategories(r.categories);
      setTargets(r.targets || {});
    } catch (e: any) {
      toast.error(e.message || "Could not load requests");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const open = (kind: "approve" | "merge" | "reject", row: RequestRow, targetId = "") => {
    setForm({ label: kind === "approve" ? row.term : "", labelLocal: "", category: "", kind: row.kind || "supplement", synonyms: "", targetId: targetId || row.similar[0]?.id || "", note: "" });
    setMode({ kind, row });
  };

  const submit = async () => {
    if (!mode) return;
    const body =
      mode.kind === "approve" ? { action: "approve", label: form.label, labelLocal: form.labelLocal || null, category: form.category, kind: form.kind, synonyms: form.synonyms.split(",").map((s) => s.trim()).filter(Boolean) }
        : mode.kind === "merge" ? { action: "merge", targetId: form.targetId }
          : { action: "reject", note: form.note };
    setSaving(true);
    try {
      const r = await adminApi.post<{ resolved: number; visits: number; entry?: { label: string } }>(`/api/admin/master-requests/${mode.row.id}`, body);
      const what = mode.kind === "reject" ? "Marked as not added" : mode.kind === "merge" ? `Merged into "${r.entry?.label}"` : `Added "${r.entry?.label}" to the list`;
      toast.success(`${what} · ${r.resolved} clinic request${r.resolved === 1 ? "" : "s"}${r.visits ? `, ${r.visits} visit${r.visits === 1 ? "" : "s"} updated` : ""}`);
      setMode(null);
      load();
      window.dispatchEvent(new Event("master-requests-changed"));
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const targetOptions = useMemo(() => (mode ? targets[mode.row.listKey] ?? [] : []).map((c) => ({ value: c.id, label: c.group ? `${c.label} — ${c.group}` : c.label })), [targets, mode]);
  const isComplaint = mode?.row.listKey === "chief_complaint";
  const canSubmit = mode?.kind === "approve" ? !!form.label.trim() && (!isComplaint || !!form.category.trim())
    : mode?.kind === "merge" ? !!form.targetId : !!form.note.trim();

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Chief complaints, allergies and current medicines clinicians typed that aren’t in the lists yet. Until you review them they stay on the visit as written. Unlisted complaints drive no clinical rules; unlisted allergies and medicines are still checked by medicine safety.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/50 bg-card/40 p-1">
          {(["pending", "resolved"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {k === "pending" ? "To review" : "Reviewed"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground border-dashed">
          <Inbox className="h-8 w-8 opacity-40" />
          {tab === "pending" ? "Nothing to review — everything clinicians used is in the lists." : "No reviewed requests yet."}
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const st = STATUS[r.status];
            return (
              <Card key={r.id} className="p-4 sm:p-5 gap-3 border-border/50 bg-card/60">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-semibold">“{r.term}”</p>
                      {r.terms.length > 1 && <span className="text-xs text-muted-foreground">also typed as {r.terms.filter((t) => t !== r.term).map((t) => `“${t}”`).join(", ")}</span>}
                      <Badge variant="outline" className={cn("gap-1", st.cls)}><st.icon className="h-3 w-3" /> {st.label}</Badge>
                      <Badge variant="outline" className="text-[11px]">{LIST_LABEL(r)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.clinics.map((c) => `${c.name} (${c.requestedByName.endsWith("(owner)") ? "owner" : c.requestedByName})`).join(" · ")} · {r.visits} visit{r.visits === 1 ? "" : "s"} · first asked {formatDate(r.createdAt)}
                    </p>
                    {r.status !== "pending" && (
                      <p className="mt-1 text-sm">
                        {r.status === "rejected" ? <>Reason: <span className="text-muted-foreground">{r.reviewNote}</span></> : <>Now: <span className="font-medium">{r.resolvedLabel}</span></>}
                        <span className="text-xs text-muted-foreground"> · {r.reviewedByName}{r.reviewedAt ? `, ${formatDate(r.reviewedAt)}` : ""}</span>
                      </p>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => open("reject", r)}><XCircle className="h-4 w-4" /> Don’t add</Button>
                      <Button size="sm" variant="outline" onClick={() => open("merge", r)}><GitMerge className="h-4 w-4" /> Merge into existing</Button>
                      <Button size="sm" onClick={() => open("approve", r)}><Plus className="h-4 w-4" /> Add as new</Button>
                    </div>
                  )}
                </div>
                {r.status === "pending" && r.similar.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap border-t border-border/50 pt-3">
                    <span className="text-xs text-muted-foreground me-1">Closest in the list:</span>
                    {r.similar.map((s) => (
                      <button key={s.id} type="button" onClick={() => open("merge", r, s.id)} title="Merge into this complaint"
                        className="rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-primary/50 hover:text-primary transition-colors">
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!mode} onOpenChange={(o) => { if (!o) setMode(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode?.kind === "approve" ? `Add as a new ${LIST_NOUN(mode.row)}` : mode?.kind === "merge" ? `Merge into an existing ${LIST_NOUN(mode.row)}` : "Don’t add to the list"}
            </DialogTitle>
            <DialogDescription>
              {mode?.kind === "approve" && (isComplaint
                ? "Only for a genuine complaint missing from the list. Use the English name with the classical Unani name in brackets, e.g. “Vertigo (Duwar)”. What the clinic typed is kept as a synonym."
                : `Only for a genuine ${LIST_NOUN(mode.row)} missing from the list. Use the standard name; what the clinic typed is kept as a synonym.`)}
              {mode?.kind === "merge" && `“${mode.row.term}” becomes a synonym of the chosen entry, so search finds it next time. Visits that used it are changed to that name.`}
              {mode?.kind === "reject" && (isComplaint
                ? "For a diagnosis, a sign found on examination, a typo or anything that isn’t a presenting complaint. Visits keep the words as written; the clinic sees your reason if they type it again."
                : "For a typo or something that doesn’t belong in this list. Visits keep the words as written and medicine safety still reads them; the clinic sees your reason if they type it again.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {mode?.kind === "approve" && (
              <>
                <FloatingField id="reqLabel" label="Name" required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
                {isComplaint && <FloatingCombobox id="reqCategory" label="Category" required value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))} options={categories} />}
                {isComplaint && <FloatingField id="reqLocal" label="Local name (optional)" value={form.labelLocal} onChange={(e) => setForm((f) => ({ ...f, labelLocal: e.target.value }))} />}
                {mode.row.listKey === "medication" && (
                  <FloatingCombobox id="reqKind" label="Type" required keepOrder value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                    options={[{ value: "supplement", label: "Unani medicine / herb" }, { value: "medication", label: "Allopathic medicine" }]} />
                )}
                <FloatingField id="reqSyn" label="Other words for it, comma-separated (optional)" value={form.synonyms} onChange={(e) => setForm((f) => ({ ...f, synonyms: e.target.value }))} />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {isComplaint ? "A new complaint has no symptom list or red-flag links yet — add them in Meta → Complaints and Humoral Matrix." : "A new entry has no safety profile yet (interactions, cautions) — add it in Meta so prescriptions are checked against it."}
                </p>
              </>
            )}
            {mode?.kind === "merge" && (
              <FloatingCombobox id="reqTarget" label={`Existing ${LIST_NOUN(mode.row)}`} required value={form.targetId} onValueChange={(v) => setForm((f) => ({ ...f, targetId: v }))} options={targetOptions} />
            )}
            {mode?.kind === "reject" && (
              <FloatingTextarea id="reqNote" label="Reason (shown to the clinic)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} />
            )}
          </div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setMode(null)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !canSubmit} variant={mode?.kind === "reject" ? "destructive" : "default"}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode?.kind === "approve" ? "Add to list" : mode?.kind === "merge" ? "Merge" : "Don’t add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
