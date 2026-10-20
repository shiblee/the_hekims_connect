"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingTextarea } from "@/components/shared/floating-field";
import { Check, Loader2, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";

interface Sign { text: string; weight?: number; match: Record<string, unknown> }
interface Entry {
  id: string; key: string; label: string; localName: string | null; category: string | null; description: string | null; icd: string | null;
  organs: string; mizaj: string; suMizajType: string | null; sabab: string; appliesTo: string; signs: string; against: string; dontMiss: string;
  investigations: string; sources: string; reviewStatus: "draft" | "approved" | "rejected"; reviewedBy: string | null; reviewedAt: string | null;
  active: boolean; used: number;
}
const parse = <T,>(s: string | null | undefined, fb: T): T => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
const STATUS = {
  draft: { label: "Unverified", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  approved: { label: "Approved", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Rejected", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
} as const;

/** Describes what a sign matches, in plain words, for reviewers. */
function matchText(m: Record<string, any>): string {
  const p: string[] = [];
  if (m.complaints?.length) p.push(`complaint: ${m.complaints.join(", ")}`);
  if (m.categories?.length) p.push(`category: ${m.categories.join(", ")}`);
  if (m.symptoms?.length) p.push(`symptom: ${m.symptoms.join(", ")}`);
  if (m.regions?.length) p.push(`region: ${m.regions.join(", ")}`);
  if (m.exam?.length) p.push(`Dala'il: ${m.exam.map((e: any) => `${e.s}${e.q ? ` (${e.q})` : ""} = "${e.o}"`).join(", ")}`);
  if (m.life?.length) p.push(`Asbab: ${m.life.map((e: any) => `${e.s} = "${e.o}"`).join(", ")}`);
  if (m.worse?.length) p.push(`worse with: ${m.worse.join(", ")}`);
  if (m.better?.length) p.push(`better with: ${m.better.join(", ")}`);
  if (m.text?.length) p.push(`mentions: ${m.text.join(", ")}`);
  if (m.vitals?.length) p.push(`vitals: ${m.vitals.join(", ")}`);
  if (m.conditions?.length) p.push(`history: ${m.conditions.join(", ")}`);
  if (m.sex) p.push(m.sex);
  if (m.minAge != null) p.push(`age ≥ ${m.minAge}`);
  if (m.maxAge != null) p.push(`age ≤ ${m.maxAge}`);
  return p.join(" · ");
}

interface Draft {
  id: string | null; label: string; localName: string; category: string; description: string; icd: string; suMizajType: string;
  mizaj: string; organs: string; sabab: string; investigations: string; advanced: string;
}
const toDraft = (e?: Entry): Draft => ({
  id: e?.id ?? null, label: e?.label ?? "", localName: e?.localName ?? "", category: e?.category ?? "", description: e?.description ?? "", icd: e?.icd ?? "",
  suMizajType: e?.suMizajType ?? "", mizaj: parse<string[]>(e?.mizaj, []).join(", "), organs: parse<string[]>(e?.organs, []).join(", "),
  sabab: parse<string[]>(e?.sabab, []).join("\n"), investigations: parse<string[]>(e?.investigations, []).join("\n"),
  advanced: JSON.stringify({ appliesTo: parse(e?.appliesTo, {}), signs: parse(e?.signs, []), against: parse(e?.against, []), dontMiss: parse(e?.dontMiss, []), sources: parse(e?.sources, []) }, null, 2),
});

/** Admin → Meta → Tashkhees & Ilaj → Amraz: the disease catalogue behind the Stage 5 differential, with physician review. */
export function AmrazAdmin() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "rejected">("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<Entry | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.get<{ entries: Entry[] }>("/api/admin/amraz").then((r) => { setRows(r.entries); setView((v) => (v ? r.entries.find((x) => x.id === v.id) ?? null : v)); }).catch((e) => toast.error(e.message || "Could not load the catalogue"));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (rows || []).filter((r) => (filter === "all" || r.reviewStatus === filter) && (!q.trim() || `${r.label} ${r.localName ?? ""} ${r.category ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, filter, q]);
  const counts = { all: rows?.length ?? 0, draft: rows?.filter((r) => r.reviewStatus === "draft").length ?? 0, approved: rows?.filter((r) => r.reviewStatus === "approved").length ?? 0, rejected: rows?.filter((r) => r.reviewStatus === "rejected").length ?? 0 };

  const review = async (e: Entry, review: "approved" | "rejected" | "draft") => {
    setBusy(true);
    try { await adminApi.patch(`/api/admin/amraz/${e.id}`, { review }); toast.success(review === "approved" ? "Approved" : review === "rejected" ? "Rejected — it won't be suggested" : "Reopened for review"); await load(); }
    catch (err: any) { toast.error(err.message || "Could not update"); } finally { setBusy(false); }
  };
  const toggle = async (e: Entry) => {
    try { await adminApi.patch(`/api/admin/amraz/${e.id}`, { active: !e.active }); load(); } catch (err: any) { toast.error(err.message || "Could not update"); }
  };
  const save = async () => {
    if (!edit || !edit.label.trim()) { toast.error("Name is required"); return; }
    let adv: any;
    try { adv = JSON.parse(edit.advanced || "{}"); } catch { toast.error("Signs and matching (JSON) isn't valid JSON"); return; }
    const list = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
    const body = {
      label: edit.label, localName: edit.localName, category: edit.category, description: edit.description, icd: edit.icd, suMizajType: edit.suMizajType || null,
      mizaj: list(edit.mizaj, /,/), organs: list(edit.organs, /,/), sabab: list(edit.sabab, /\n/), investigations: list(edit.investigations, /\n/),
      appliesTo: adv.appliesTo ?? {}, signs: adv.signs ?? [], against: adv.against ?? [], dontMiss: adv.dontMiss ?? [], sources: adv.sources ?? [],
    };
    setBusy(true);
    try {
      if (edit.id) await adminApi.patch(`/api/admin/amraz/${edit.id}`, body); else await adminApi.post("/api/admin/amraz", body);
      toast.success(edit.id ? "Saved" : "Added (unverified)"); setEdit(null); await load();
    } catch (err: any) { toast.error(err.message || "Could not save"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 gap-2 border-border/50">
        <p className="text-sm font-semibold">Amraz (disease) catalogue</p>
        <p className="text-sm text-muted-foreground">The diseases the Stage 5 differential can suggest, with the findings that support or argue against each. Drafted entries show to Hakims as <b>Unverified</b> until a physician approves them here. Rejected entries are never suggested. Editing an approved entry sends it back for review.</p>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/60 bg-card/60 p-1">
          {(["all", "draft", "approved", "rejected"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {k === "all" ? "All" : STATUS[k].label} <span className="tabular-nums opacity-70">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 max-w-xs">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input id="amrazSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search diseases" className="h-9 w-full rounded-lg border border-input bg-background ps-8 pe-3 text-sm" />
        </div>
        <Button size="sm" className="ms-auto" onClick={() => setEdit(toDraft())}><Plus className="h-4 w-4" /> Add disease</Button>
      </div>

      {!rows ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : (
        <Card className="p-0 gap-0 border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="text-start px-3 py-2">Disease</th><th className="text-start px-3 py-2">Group</th><th className="text-start px-3 py-2">Typical Mizaj</th><th className="text-start px-3 py-2">Status</th><th className="text-end px-3 py-2">Chosen</th><th className="px-3 py-2">Active</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => setView(r)}>
                    <td className="px-3 py-2"><span className="font-medium">{r.label}</span>{r.localName && <span className="ms-2 text-muted-foreground">{r.localName}</span>}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                    <td className="px-3 py-2 text-muted-foreground">{parse<string[]>(r.mizaj, []).join(", ")}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={STATUS[r.reviewStatus].cls}>{STATUS[r.reviewStatus].label}</Badge></td>
                    <td className="px-3 py-2 text-end tabular-nums">{r.used}</td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}><Switch checked={r.active} onCheckedChange={() => toggle(r)} /></td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No diseases match.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Review view */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.label}{view.localName ? ` · ${view.localName}` : ""}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={STATUS[view.reviewStatus].cls}>{STATUS[view.reviewStatus].label}</Badge>
                  {view.reviewedBy && <span className="text-xs text-muted-foreground">by {view.reviewedBy}{view.reviewedAt ? ` · ${new Date(view.reviewedAt).toLocaleDateString()}` : ""}</span>}
                  <span className="text-xs text-muted-foreground">{view.category}{view.icd ? ` · ICD ${view.icd}` : ""}</span>
                </div>
                {view.description && <p>{view.description}</p>}
                <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div><dt className="inline text-muted-foreground">Typical Mizaj: </dt><dd className="inline">{parse<string[]>(view.mizaj, []).join(", ") || "—"}{view.suMizajType ? ` (${view.suMizajType})` : ""}</dd></div>
                  <div><dt className="inline text-muted-foreground">Organs: </dt><dd className="inline">{parse<string[]>(view.organs, []).join(", ") || "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Sabab: </dt><dd className="inline">{parse<string[]>(view.sabab, []).join("; ") || "—"}</dd></div>
                </dl>
                <Block title="Suggested when the visit has">{matchText(parse(view.appliesTo, {})) || "—"}</Block>
                <Block title="Supporting findings">{parse<Sign[]>(view.signs, []).map((s, i) => <li key={i}><b>{s.text}</b> <span className="text-muted-foreground">(+{s.weight ?? 2}) — {matchText(s.match)}</span></li>)}</Block>
                <Block title="Findings against">{parse<Sign[]>(view.against, []).map((s, i) => <li key={i}><b>{s.text}</b> <span className="text-muted-foreground">(−{s.weight ?? 2}) — {matchText(s.match)}</span></li>)}</Block>
                <Block title="Don't miss">{parse<{ label: string; why: string }[]>(view.dontMiss, []).map((d, i) => <li key={i}><b>{d.label}</b> <span className="text-muted-foreground">— {d.why}</span></li>)}</Block>
                <Block title="Investigations">{parse<string[]>(view.investigations, []).map((x, i) => <li key={i}>{x}</li>)}</Block>
                <Block title="Sources">{parse<{ title: string; url?: string }[]>(view.sources, []).map((x, i) => <li key={i}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{x.title}</a> : x.title}</li>)}</Block>
              </div>
              <DialogFooter className="border-t pt-4 sm:justify-between gap-2">
                <Button variant="outline" onClick={() => { setEdit(toDraft(view)); setView(null); }}><Pencil className="h-4 w-4" /> Edit</Button>
                <div className="flex gap-2">
                  {view.reviewStatus !== "draft" && <Button variant="outline" disabled={busy} onClick={() => review(view, "draft")}><RotateCcw className="h-4 w-4" /> Reopen</Button>}
                  {view.reviewStatus !== "rejected" && <Button variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => review(view, "rejected")}><X className="h-4 w-4" /> Reject</Button>}
                  {view.reviewStatus !== "approved" && <Button disabled={busy} onClick={() => review(view, "approved")}><Check className="h-4 w-4" /> Approve</Button>}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {edit && (
            <>
              <DialogHeader><DialogTitle>{edit.id ? "Edit disease" : "Add disease"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FloatingField id="mzLabel" label="Name" required value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
                  <FloatingField id="mzLocal" label="Urdu / Arabic name" value={edit.localName} onChange={(e) => setEdit({ ...edit, localName: e.target.value })} />
                  <FloatingField id="mzCat" label="Group" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
                  <FloatingField id="mzIcd" label="Nearest ICD-10 (reference)" value={edit.icd} onChange={(e) => setEdit({ ...edit, icd: e.target.value })} />
                  <FloatingField id="mzMizaj" label="Typical Mizaj (comma-separated)" value={edit.mizaj} onChange={(e) => setEdit({ ...edit, mizaj: e.target.value })} />
                  <FloatingField id="mzOrgans" label="Organs (comma-separated)" value={edit.organs} onChange={(e) => setEdit({ ...edit, organs: e.target.value })} />
                </div>
                <label className="grid gap-1 text-sm"><span className="font-medium">Typical type</span>
                  <select id="mzType" value={edit.suMizajType} onChange={(e) => setEdit({ ...edit, suMizajType: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                    <option value="">Either</option><option value="Sada">Sada</option><option value="Maddi">Maddi</option>
                  </select>
                </label>
                <FloatingTextarea id="mzDesc" label="Description" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                <FloatingTextarea id="mzSabab" label="Sabab — one per line" rows={3} value={edit.sabab} onChange={(e) => setEdit({ ...edit, sabab: e.target.value })} />
                <FloatingTextarea id="mzInv" label="Investigations — one per line" rows={3} value={edit.investigations} onChange={(e) => setEdit({ ...edit, investigations: e.target.value })} />
                <FloatingTextarea id="mzAdv" label="Signs and matching (JSON: appliesTo, signs, against, dontMiss, sources)" rows={12} maxLength={40000} value={edit.advanced} onChange={(e) => setEdit({ ...edit, advanced: e.target.value })} className="font-mono text-xs" />
                {edit.id && <p className="text-xs text-muted-foreground">Saving changes to an approved entry sends it back to Unverified for review.</p>}
              </div>
              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
                <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div className="rounded-lg border border-border/50 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {empty ? <p className="text-muted-foreground">—</p> : Array.isArray(children) ? <ul className="space-y-1">{children}</ul> : <p>{children}</p>}
    </div>
  );
}
