"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { FilePlus2, Plus, Loader2, Trash2, FileText, Leaf, Activity, Pill, Stethoscope } from "lucide-react";

const THERAPIES = [
  { value: "Ilaj-bil-Dawa", label: "Ilaj-bil-Dawa (Pharmacotherapy)", icon: Pill },
  { value: "Ilaj-bil-Ghadha", label: "Ilaj-bil-Ghadha (Dietotherapy)", icon: Leaf },
  { value: "Ilaj-bil-Tadbeer", label: "Ilaj-bil-Tadbeer (Regimental)", icon: Activity },
  { value: "Ilaj-bil-Yad", label: "Ilaj-bil-Yad (Surgery)", icon: Stethoscope },
];

export function PrescriptionsView() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patientId: "", therapyType: "Ilaj-bil-Dawa", notes: "", items: [{ name: "", dose: "", frequency: "", instructions: "" }] });

  const load = async () => {
    setLoading(true);
    try {
      const [pr, pa] = await Promise.all([
        api.get<{ prescriptions: any[] }>("/api/prescriptions"),
        api.get<{ patients: any[] }>("/api/facility/patients"),
      ]);
      setPrescriptions(pr.prescriptions || []);
      setPatients(pa.patients || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addItem = () => setForm({ ...form, items: [...form.items, { name: "", dose: "", frequency: "", instructions: "" }] });
  const updateItem = (i: number, field: string, val: string) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    setForm({ ...form, items });
  };
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) });

  const save = async () => {
    if (!form.patientId) { toast.error("Select a patient"); return; }
    if (!form.items.length || !form.items[0].name) { toast.error("Add at least one remedy"); return; }
    setSaving(true);
    try {
      await api.post("/api/prescriptions", { ...form, items: form.items.filter((i) => i.name) });
      toast.success("Prescription created");
      setOpen(false);
      setForm({ patientId: "", therapyType: "Ilaj-bil-Dawa", notes: "", items: [{ name: "", dose: "", frequency: "", instructions: "" }] });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">Prescriptions</h2>
          <p className="text-sm text-muted-foreground">Classical Unani formulations prescribed to your patients.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> New Prescription</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : prescriptions.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No prescriptions yet. Create your first one.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {prescriptions.map((pr) => (
            <Card key={pr.id} className="p-4 border-border/50 bg-card/60">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white", avatarGradient(pr.patient?.avatarColor))}>
                    {initials(pr.patient?.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{pr.patient?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(pr.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">{pr.therapyType}</Badge>
              </div>
              <div className="space-y-1.5 mb-3">
                {pr.items.map((it: any, i: number) => (
                  <div key={i} className="text-xs">
                    <p className="font-medium">{it.name} <span className="text-muted-foreground">— {it.dose}</span></p>
                    <p className="text-muted-foreground">{it.frequency} · {it.instructions}</p>
                  </div>
                ))}
              </div>
              {pr.notes && <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">{pr.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>New Prescription</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Patient</Label>
                  <Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}>
                    <SelectTrigger className="bg-background/60"><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Therapy Type</Label>
                  <Select value={form.therapyType} onValueChange={(v) => setForm({ ...form, therapyType: v })}>
                    <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                    <SelectContent>{THERAPIES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Remedies</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Add remedy</Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start rounded-lg bg-background/40 p-2">
                      <Input className="col-span-12 sm:col-span-4 h-9 bg-background/60" placeholder="Remedy name" value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} />
                      <Input className="col-span-6 sm:col-span-2 h-9 bg-background/60" placeholder="Dose (5g)" value={it.dose} onChange={(e) => updateItem(i, "dose", e.target.value)} />
                      <Input className="col-span-6 sm:col-span-3 h-9 bg-background/60" placeholder="Frequency" value={it.frequency} onChange={(e) => updateItem(i, "frequency", e.target.value)} />
                      <Input className="col-span-10 sm:col-span-2 h-9 bg-background/60" placeholder="Instructions" value={it.instructions} onChange={(e) => updateItem(i, "instructions", e.target.value)} />
                      <Button size="icon" variant="ghost" className="col-span-2 sm:col-span-1 h-9 text-destructive" onClick={() => removeItem(i)} disabled={form.items.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Duration, follow-up advice…" className="bg-background/60 min-h-[60px]" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              Create Prescription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
