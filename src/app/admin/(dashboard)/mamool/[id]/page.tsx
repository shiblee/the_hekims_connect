"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, BookMarked, CheckCircle2, Copy, History, Leaf, Loader2, Pill, Power, Send, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn, formatDateTime } from "@/lib/utils";
import { matchedAlias, searchEntries } from "@/lib/complaint-search";
import { STATUS_STYLE, type RegimenStatus } from "@/components/admin/mamool-shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingMultiSelect, FloatingTextarea } from "@/components/shared/floating-field";

interface CatComplaint { id: string; label: string; labelLocal: string | null; synonyms: string; category: string }
interface CatMedicine { id: string; label: string; kind: string; synonyms: string; category: string; forms: string[] }
interface Catalog { complaints: CatComplaint[]; medicines: CatMedicine[]; forms: string[]; timings: string[] }
interface MedLine { tagId: string; form: string; dose: string; timing: string; duration: string; adjuvant: string; instructions: string; notes: string }
interface Draft { name: string; description: string; clinicalNotes: string; complaints: { complaintId: string; required: boolean }[]; medicines: MedLine[] }
interface Full {
  id: string; code: string; name: string; description: string | null; clinicalNotes: string | null; status: RegimenStatus; active: boolean;
  version: number; approvedVersion: number | null; createdByName: string; updatedByName: string | null; createdAt: string; updatedAt: string;
  complaints: { complaintId: string; required: boolean }[];
  medicines: (Omit<MedLine, "form" | "dose" | "timing" | "duration" | "adjuvant" | "instructions" | "notes"> & Record<"form" | "dose" | "timing" | "duration" | "adjuvant" | "instructions" | "notes", string | null> & { tag: { active: boolean } })[];
  reviews: { id: string; version: number; action: string; byName: string; comment: string | null; createdAt: string }[];
  versions: { version: number; approvedByName: string; reason: string | null; createdAt: string }[];
}

const EMPTY: Draft = { name: "", description: "", clinicalNotes: "", complaints: [], medicines: [] };
const toDraft = (r: Full): Draft => ({
  name: r.name, description: r.description ?? "", clinicalNotes: r.clinicalNotes ?? "",
  complaints: r.complaints.map((c) => ({ complaintId: c.complaintId, required: c.required })),
  medicines: r.medicines.map((m) => ({ tagId: m.tagId, form: m.form ?? "", dose: m.dose ?? "", timing: m.timing ?? "", duration: m.duration ?? "", adjuvant: m.adjuvant ?? "", instructions: m.instructions ?? "", notes: m.notes ?? "" })),
});
const ACTION_LABEL: Record<string, string> = { created: "Created", edited: "Edited", submitted: "Sent for clinical approval", approved: "Approved", rejected: "Rejected", activated: "Activated", deactivated: "Deactivated" };

type Pending = { kind: "approve" | "reject" | "save-approved" } | null;

export default function MamoolEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [regimen, setRegimen] = useState<Full | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState<string>(JSON.stringify(EMPTY));
  const [busy, setBusy] = useState(false);
  const [cq, setCq] = useState("");
  const [mq, setMq] = useState("");
  const [dialog, setDialog] = useState<Pending>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        adminApi.get<Catalog>("/api/admin/mamool/catalog"),
        isNew ? Promise.resolve(null) : adminApi.get<{ regimen: Full }>(`/api/admin/mamool/${id}`),
      ]);
      setCatalog(c);
      if (r) { setRegimen(r.regimen); const d = toDraft(r.regimen); setDraft(d); setSaved(JSON.stringify(d)); }
    } catch (e: any) { toast.error(e.message || "Could not load"); }
  }, [id, isNew]);
  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(draft) !== saved;
  const complaintById = useMemo(() => new Map((catalog?.complaints ?? []).map((c) => [c.id, c])), [catalog]);
  const medById = useMemo(() => new Map((catalog?.medicines ?? []).map((m) => [m.id, m])), [catalog]);
  const status = regimen?.status ?? "draft";
  const upd = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const updMed = (i: number, patch: Partial<MedLine>) => setDraft((d) => ({ ...d, medicines: d.medicines.map((m, n) => (n === i ? { ...m, ...patch } : m)) }));
  const move = (i: number, dir: -1 | 1) => setDraft((d) => {
    const j = i + dir; if (j < 0 || j >= d.medicines.length) return d;
    const m = [...d.medicines]; [m[i], m[j]] = [m[j], m[i]]; return { ...d, medicines: m };
  });

  const complaintResults = cq.trim() ? searchEntries((catalog?.complaints ?? []).filter((c) => !draft.complaints.some((x) => x.complaintId === c.id)), cq, 10) : [];
  const medResults = mq.trim() ? searchEntries(catalog?.medicines ?? [], mq, 12) : [];

  const save = async (reason?: string) => {
    if (!draft.name.trim()) { toast.error("Enter the regimen name"); return false; }
    setBusy(true);
    try {
      if (isNew) {
        const r = await adminApi.post<{ regimen: { id: string; code: string } }>("/api/admin/mamool", draft);
        toast.success(`Saved as draft ${r.regimen.code}`);
        router.replace(`/admin/mamool/${r.regimen.id}`);
        return true;
      }
      const r = await adminApi.patch<{ regimen: Full }>(`/api/admin/mamool/${id}`, { ...draft, reason });
      setRegimen(r.regimen); const d = toDraft(r.regimen); setDraft(d); setSaved(JSON.stringify(d));
      toast.success(status === "approved" ? `Saved as draft v${r.regimen.version} — clinics keep v${r.regimen.approvedVersion} until it's approved` : "Saved as draft");
      return true;
    } catch (e: any) { toast.error(e.message || "Could not save"); return false; } finally { setBusy(false); }
  };

  const action = async (a: "submit" | "approve" | "reject" | "activate" | "deactivate" | "duplicate", c?: string) => {
    setBusy(true);
    try {
      const r = await adminApi.post<{ id?: string }>(`/api/admin/mamool/${id}/action`, { action: a, comment: c });
      if (a === "duplicate" && r.id) { toast.success("Copy created as a draft"); router.push(`/admin/mamool/${r.id}`); return; }
      toast.success({ submit: "Sent for clinical approval", approve: "Approved — clinics can now use this version", reject: "Rejected", activate: "Activated", deactivate: "Deactivated — clinics no longer see it" }[a as "submit"]);
      setDialog(null); setComment("");
      await load();
    } catch (e: any) { toast.error(e.message || "Could not update"); } finally { setBusy(false); }
  };

  if (!catalog || (!isNew && !regimen)) {
    return <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  const st = STATUS_STYLE[status];

  return (
    <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-16 py-8">
      <Link href="/admin/mamool" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Mamool-e-Matab</Link>
      <div className="mt-2 mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><BookMarked className="h-6 w-6 text-primary" /> {isNew ? "New treatment regimen" : regimen!.name}</h1>
          {!isNew && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{regimen!.code}</span> · <span>v{regimen!.version}</span>
              <Badge variant="outline" className={st.cls}>{st.label}</Badge>
              <Badge variant="outline" className={regimen!.active ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : ""}>{regimen!.active ? "Active" : "Inactive"}</Badge>
              {regimen!.approvedVersion ? <span>Clinics use v{regimen!.approvedVersion}</span> : <span>Not yet available to clinics</span>}
            </div>
          )}
        </div>
        {!isNew && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => action("duplicate")} disabled={busy}><Copy className="h-4 w-4" /> Duplicate</Button>
            <Button variant="outline" size="sm" onClick={() => action(regimen!.active ? "deactivate" : "activate")} disabled={busy}><Power className="h-4 w-4" /> {regimen!.active ? "Deactivate" : "Activate"}</Button>
          </div>
        )}
      </div>

      {status === "approved" && !isNew && <p className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">Changes are saved as a new draft (v{regimen!.version + 1}). Clinics keep using approved v{regimen!.approvedVersion} until the new version is approved.</p>}
      {status === "rejected" && regimen!.reviews.find((r) => r.action === "rejected")?.comment && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Rejected: {regimen!.reviews.find((r) => r.action === "rejected")?.comment}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 min-w-0">
          <Card className="p-5 gap-4 border-border/50">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What is this regimen?</h2>
            <FloatingField id="rgName" label="Regimen name" required value={draft.name} onChange={(e) => upd({ name: e.target.value })} maxLength={160} />
            <FloatingTextarea id="rgDesc" label="Description (optional)" value={draft.description} onChange={(e) => upd({ description: e.target.value })} rows={2} maxLength={2000} />
            <FloatingTextarea id="rgNotes" label="Clinical notes for the Hakim (optional)" value={draft.clinicalNotes} onChange={(e) => upd({ clinicalNotes: e.target.value })} rows={3} maxLength={4000} />
          </Card>

          <Card className="p-5 gap-3 border-border/50">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Which chief complaints is it for?</h2>
            <FloatingMultiSelect
              id="rgComplaints" label="Chief complaints"
              selected={draft.complaints.map((c) => ({ id: c.complaintId, label: complaintById.get(c.complaintId)?.label ?? "(removed complaint)", category: "", labelLocal: null as string | null, synonyms: "" }))}
              onRemove={(cid) => upd({ complaints: draft.complaints.filter((c) => c.complaintId !== cid) })}
              query={cq} onQueryChange={setCq} keepOrder
              results={complaintResults.map((c) => ({ id: c.id, label: c.label, category: c.category, labelLocal: c.labelLocal, synonyms: c.synonyms }))}
              describe={(c) => { const a = matchedAlias(c, cq); return [a ? `Also called “${a}”` : null, c.category].filter(Boolean).join(" · "); }}
              onPick={(cid) => upd({ complaints: [...draft.complaints, { complaintId: cid, required: false }] })}
            />
            {draft.complaints.length > 0 && (
              <div className="rounded-lg border border-border/60 divide-y divide-border">
                {draft.complaints.map((c) => (
                  <label key={c.complaintId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer">
                    <span>{complaintById.get(c.complaintId)?.label ?? "(removed complaint)"}</span>
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={c.required} onChange={(e) => upd({ complaints: draft.complaints.map((x) => (x.complaintId === c.complaintId ? { ...x, required: e.target.checked } : x)) })} />
                      Required
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Suggested to the doctor when the patient has <b>any</b> of these complaints. Tick “Required” to suggest it only when the patient has <b>all</b> the ticked complaints.</p>
          </Card>

          <Card className="p-5 gap-3 border-border/50">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Which medicines does it contain?</h2>
            <FloatingMultiSelect
              id="rgMedSearch" label="Add a medicine from the medicine list"
              selected={[]} onRemove={() => {}}
              query={mq} onQueryChange={setMq} keepOrder
              results={medResults.map((m) => ({ id: m.id, label: m.label, kind: m.kind, category: m.category, synonyms: m.synonyms }))}
              renderIcon={(m) => (m.kind === "medication" ? <Pill className="h-3 w-3 text-sky-600" /> : <Leaf className="h-3 w-3 text-primary" />)}
              describe={(m) => [draft.medicines.some((x) => x.tagId === m.id) ? "Already in this regimen" : null, m.category].filter(Boolean).join(" · ")}
              onPick={(tid) => { const m = medById.get(tid); upd({ medicines: [...draft.medicines, { tagId: tid, form: m?.forms[0] ?? "", dose: "", timing: "", duration: "", adjuvant: "", instructions: "", notes: "" }] }); }}
            />
            {draft.medicines.length === 0 ? <p className="text-sm text-muted-foreground">No medicines yet.</p> : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[68rem] text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>{["#", "Medicine", "Form", "Dose", "Timing", "Duration", "Badraqa", "Instructions", "Reviewer note", ""].map((h, i) => <th key={i} className="px-2 py-1.5 text-start font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {draft.medicines.map((m, i) => {
                      const med = medById.get(m.tagId);
                      const forms = [...new Set([...(med?.forms ?? []), ...catalog.forms, ...(m.form ? [m.form] : [])])];
                      const timings = [...new Set([...catalog.timings, ...(m.timing ? [m.timing] : [])])];
                      const dup = draft.medicines.filter((x) => x.tagId === m.tagId).length > 1;
                      return (
                        <tr key={i} className={cn(dup && "bg-amber-500/5")}>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-col">
                              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-muted-foreground disabled:opacity-30 hover:text-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => move(i, 1)} disabled={i === draft.medicines.length - 1} aria-label="Move down" className="text-muted-foreground disabled:opacity-30 hover:text-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 font-medium min-w-40">
                            <span className="inline-flex items-center gap-1.5">{med?.kind === "medication" ? <Pill className="h-3.5 w-3.5 text-sky-600" /> : <Leaf className="h-3.5 w-3.5 text-primary" />}{med?.label ?? "(no longer in the medicine list)"}</span>
                            {dup && <span className="block text-[11px] text-amber-700 dark:text-amber-400">Listed twice</span>}
                          </td>
                          <td className="px-2 py-1.5"><select value={m.form} onChange={(e) => updMed(i, { form: e.target.value })} className="h-8 w-32 rounded-md border border-input bg-background px-1.5 text-sm" aria-label="Form"><option value="">—</option>{forms.sort().map((f) => <option key={f} value={f}>{f}</option>)}</select></td>
                          <td className="px-2 py-1.5"><Input value={m.dose} onChange={(e) => updMed(i, { dose: e.target.value })} className="h-8 w-28" aria-label="Dose" maxLength={120} /></td>
                          <td className="px-2 py-1.5"><select value={m.timing} onChange={(e) => updMed(i, { timing: e.target.value })} className="h-8 w-36 rounded-md border border-input bg-background px-1.5 text-sm" aria-label="Timing"><option value="">—</option>{timings.map((f) => <option key={f} value={f}>{f}</option>)}</select></td>
                          <td className="px-2 py-1.5"><Input value={m.duration} onChange={(e) => updMed(i, { duration: e.target.value })} className="h-8 w-24" aria-label="Duration" maxLength={80} placeholder="e.g. 14 days" /></td>
                          <td className="px-2 py-1.5"><Input value={m.adjuvant} onChange={(e) => updMed(i, { adjuvant: e.target.value })} className="h-8 w-28" aria-label="Badraqa" maxLength={160} /></td>
                          <td className="px-2 py-1.5"><Input value={m.instructions} onChange={(e) => updMed(i, { instructions: e.target.value })} className="h-8 w-44" aria-label="Instructions" maxLength={1000} /></td>
                          <td className="px-2 py-1.5"><Input value={m.notes} onChange={(e) => updMed(i, { notes: e.target.value })} className="h-8 w-40" aria-label="Reviewer note" maxLength={1000} /></td>
                          <td className="px-2 py-1.5"><button type="button" onClick={() => upd({ medicines: draft.medicines.filter((_, n) => n !== i) })} aria-label={`Remove ${med?.label ?? "medicine"}`} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Only medicines from the medicine list. When a doctor applies the regimen, each medicine becomes its own prescription line and the usual safety check (allergies, interactions, pregnancy) runs on it.</p>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {dirty && <span className="me-auto text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span>}
            <Button variant="outline" onClick={() => router.push("/admin/mamool")} disabled={busy}>Back</Button>
            {!isNew && status === "pending" && !dirty && (
              <>
                <Button variant="outline" onClick={() => { setComment(""); setDialog({ kind: "reject" }); }} disabled={busy}><XCircle className="h-4 w-4" /> Reject</Button>
                <Button onClick={() => { setComment(""); setDialog({ kind: "approve" }); }} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
              </>
            )}
            {!isNew && (status === "draft" || status === "rejected") && !dirty && (
              <Button variant="outline" onClick={() => action("submit")} disabled={busy}><Send className="h-4 w-4" /> Send for clinical approval</Button>
            )}
            <Button onClick={() => (status === "approved" && !isNew ? (setComment(""), setDialog({ kind: "save-approved" })) : save())} disabled={busy || (!dirty && !isNew)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save draft
            </Button>
          </div>
        </div>

        {!isNew && (
          <Card className="p-4 gap-3 border-border/50 h-fit">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /> History</h2>
            <ul className="space-y-2.5 text-sm">
              {regimen!.reviews.map((r) => (
                <li key={r.id} className="border-s-2 border-border ps-2.5">
                  <p className="font-medium">{ACTION_LABEL[r.action] ?? r.action} <span className="text-xs font-normal text-muted-foreground">v{r.version}</span></p>
                  <p className="text-xs text-muted-foreground">{r.byName} · {formatDateTime(r.createdAt)}</p>
                  {r.comment && <p className="text-xs mt-0.5">{r.comment}</p>}
                </li>
              ))}
            </ul>
            {regimen!.versions.length > 0 && (
              <>
                <h3 className="pt-2 border-t border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved versions</h3>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {regimen!.versions.map((v) => <li key={v.version}>v{v.version} · {v.approvedByName} · {formatDateTime(v.createdAt)}</li>)}
                </ul>
              </>
            )}
          </Card>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.kind === "approve" ? "Approve this regimen" : dialog?.kind === "reject" ? "Reject this regimen" : "Save a new version"}</DialogTitle>
            <DialogDescription>
              {dialog?.kind === "approve" && "Only a qualified Unani reviewer should approve. Once approved, this version is what doctors see and apply. They can still edit or remove any medicine for their patient."}
              {dialog?.kind === "reject" && "The regimen goes back for changes. Your reason is kept in its history."}
              {dialog?.kind === "save-approved" && `This starts v${(regimen?.version ?? 0) + 1} as a draft. Clinics keep using approved v${regimen?.approvedVersion} until the new version is approved.`}
            </DialogDescription>
          </DialogHeader>
          <FloatingTextarea id="rgComment" label={dialog?.kind === "reject" ? "Reason (required)" : dialog?.kind === "approve" ? "Review comment (optional)" : "What changed and why (optional)"} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
            <Button disabled={busy || (dialog?.kind === "reject" && !comment.trim())} variant={dialog?.kind === "reject" ? "destructive" : "default"}
              onClick={async () => {
                if (dialog?.kind === "approve") await action("approve", comment);
                else if (dialog?.kind === "reject") await action("reject", comment);
                else if (await save(comment)) setDialog(null);
              }}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog?.kind === "approve" ? "Approve" : dialog?.kind === "reject" ? "Reject" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
