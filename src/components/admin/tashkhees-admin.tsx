"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { TASHKHEES_LISTS, type TashkheesListKey } from "@/lib/tashkhees";
import { AsbabAdmin } from "@/components/admin/asbab-admin";
import { useUrlParam } from "@/hooks/use-url-param";
import { TashkheesEngineAdmin } from "@/components/admin/tashkhees-engine-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField } from "@/components/shared/floating-field";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus } from "lucide-react";

interface Row { id: string; list: string; label: string; localName: string | null; description: string | null; sortOrder: number; active: boolean }

/** Admin → Meta → Tashkhees & Ilaj: the Dala'il examination questions and the Stage 5 option lists. */
export function TashkheesAdmin() {
  // Each sub-tab has its own URL: ?tab=dalail | engine | lists
  const [part, setPartRaw] = useUrlParam("tab", "dalail", ["dalail", "engine", "lists"] as const);
  // Switching sub-tab drops the previous tab's own params (section / list).
  const setPart = (v: "dalail" | "engine" | "lists") => {
    const url = new URL(window.location.href);
    url.searchParams.delete("section"); url.searchParams.delete("list");
    window.history.replaceState(window.history.state, "", url);
    setPartRaw(v);
  };
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-border/60 bg-card/60 p-1">
        {([["dalail", "Dala'il Examination"], ["engine", "Tashkhees Engine"], ["lists", "Option Lists"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setPart(k)}
            className={cn("rounded-md px-4 py-1.5 text-sm transition-colors", part === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      {part === "dalail" ? <AsbabAdmin framework="dalail" /> : part === "engine" ? <TashkheesEngineAdmin /> : <OptionLists />}
    </div>
  );
}

function OptionLists() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [list, setList] = useUrlParam<TashkheesListKey>("list", "mizaj", TASHKHEES_LISTS.map((l) => l.key));
  const [dialog, setDialog] = useState<{ id: string | null; label: string; localName: string; description: string; active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.get<{ options: Row[] }>("/api/admin/tashkhees-options").then((r) => setRows(r.options)).catch((e) => toast.error(e.message || "Could not load lists"));
  useEffect(() => { load(); }, []);

  const items = (rows || []).filter((r) => r.list === list);
  const meta = TASHKHEES_LISTS.find((l) => l.key === list)!;

  const move = async (i: number, d: -1 | 1) => {
    if (!items[i + d]) return;
    const order = [...items];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await Promise.all(order.map((r, n) => (r.sortOrder === n ? null : adminApi.patch(`/api/admin/tashkhees-options/${r.id}`, { sortOrder: n }))));
    load();
  };
  const toggle = async (r: Row) => {
    try { await adminApi.patch(`/api/admin/tashkhees-options/${r.id}`, { active: !r.active }); load(); }
    catch (e: any) { toast.error(e.message || "Could not update"); }
  };
  const save = async () => {
    if (!dialog || !dialog.label.trim()) return;
    setSaving(true);
    try {
      const body = { label: dialog.label, localName: dialog.localName, description: dialog.description };
      if (dialog.id) await adminApi.patch(`/api/admin/tashkhees-options/${dialog.id}`, { ...body, active: dialog.active });
      else await adminApi.post("/api/admin/tashkhees-options", { ...body, list });
      setDialog(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!rows) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-6">
      <Card className="p-3 border-border/50 bg-card/60 h-fit gap-1">
        {TASHKHEES_LISTS.map((l) => {
          const on = l.key === list;
          return (
            <button key={l.key} type="button" onClick={() => setList(l.key)}
              className={cn("w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                on ? "bg-primary text-primary-foreground font-medium" : "hover:bg-background/60")}>
              <span className="leading-snug">{l.label}</span>
              <Badge variant={on ? "outline" : "secondary"} className={cn("shrink-0", on && "border-primary-foreground/40 text-primary-foreground")}>{rows.filter((r) => r.list === l.key && r.active).length}</Badge>
            </button>
          );
        })}
      </Card>
      <Card className="p-6 border-border/50 bg-card/60">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-lg font-semibold">{meta.label}</h2>
            <p className="text-sm text-muted-foreground">{meta.hint}</p>
          </div>
          <Button size="sm" onClick={() => setDialog({ id: null, label: "", localName: "", description: "", active: true })}><Plus className="h-3.5 w-3.5" /> Add New</Button>
        </div>
        <div className="space-y-1.5">
          {items.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
              <div className="flex flex-col -my-1">
                <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", !r.active && "line-through text-muted-foreground")}>{r.label}{r.localName && <span className="font-normal text-muted-foreground"> · {r.localName}</span>}</p>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDialog({ id: r.id, label: r.label, localName: r.localName || "", description: r.description || "", active: r.active })}><Pencil className="h-3.5 w-3.5" /></Button>
              <span className={cn("text-xs font-medium w-14 text-right", r.active ? "text-emerald-500" : "text-muted-foreground")}>{r.active ? "Active" : "Inactive"}</span>
              <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        </div>
        <p className="text-[11px] text-muted-foreground">Disabling an item hides it from new dossiers — dossiers already saved keep their wording.</p>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{dialog?.id ? "Edit" : "Add"} · {meta.label}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <FloatingField id="tkLabel" label="Name" required value={dialog.label} onChange={(e) => setDialog((d) => d && { ...d, label: e.target.value })} />
              <FloatingField id="tkLocal" label="Unani / local name (optional)" value={dialog.localName} onChange={(e) => setDialog((d) => d && { ...d, localName: e.target.value })} />
              <FloatingField id="tkDesc" label="Description (optional)" value={dialog.description} onChange={(e) => setDialog((d) => d && { ...d, description: e.target.value })} />
              {dialog.id && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
                  <span className={cn("text-sm font-medium", dialog.active ? "text-emerald-500" : "text-muted-foreground")}>{dialog.active ? "Active" : "Inactive"}</span>
                  <Switch checked={dialog.active} onCheckedChange={(v) => setDialog((d) => d && { ...d, active: v })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !dialog?.label.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {dialog?.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
