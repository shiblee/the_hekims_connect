"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useDateLocale, useListFormat } from "@/lib/i18n/use-date-locale";
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
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const msg = useNotice();
  const dialogMsg = useNotice();
  const t = useTranslations("clinic.prescriptions");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const list = useListFormat();
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
      setLoadError(null);
    } catch (e: any) { setLoadError(e.message || tc("network_error")); } finally { setLoading(false); }
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
    const missing = [!form.patientId && t("need_patient"), !form.items.some((i) => i.name.trim()) && t("need_remedy")].filter(Boolean) as string[];
    if (missing.length) {
      dialogMsg.warning(t("before", { items: list(missing) }), t("before_hint"));
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/prescriptions", { ...form, items: form.items.filter((i) => i.name) });
      msg.success(t("created"), t("created_for", { name: patients.find((p) => p.id === form.patientId)?.name ?? t("the_patient") }));
      setOpen(false);
      setForm({ patientId: "", therapyType: "Ilaj-bil-Dawa", notes: "", items: [{ name: "", dose: "", frequency: "", instructions: "" }] });
      load();
    } catch (e: any) {
      dialogMsg.error(t("not_created"), t("still_filled", { error: e.message || tc("network_error") }), { retry: save });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => { dialogMsg.clear(); setOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> {t("new")}</Button>
      </div>
      <NoticeSlot state={msg} />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline me-2" /> {tc("loading")}</div>
      ) : loadError ? (
        <LoadFailed what={t("what")} detail={loadError} onRetry={load} />
      ) : prescriptions.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("none")}</p>
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
                    <p className="text-[11px] text-muted-foreground">{new Date(pr.createdAt).toLocaleDateString(dl)}</p>
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
          <DialogHeader><DialogTitle>{t("new")}</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("patient")}</Label>
                  <Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}>
                    <SelectTrigger className="bg-background/60"><SelectValue placeholder={t("select_patient")} /></SelectTrigger>
                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("therapy")}</Label>
                  <Select value={form.therapyType} onValueChange={(v) => setForm({ ...form, therapyType: v })}>
                    <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                    <SelectContent>{THERAPIES.map((th) => <SelectItem key={th.value} value={th.value}>{th.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>{t("remedies")}</Label>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 me-1" /> {t("add_remedy")}</Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start rounded-lg bg-background/40 p-2">
                      <Input className="col-span-12 sm:col-span-4 h-9 bg-background/60" placeholder={t("remedy_name")} value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} />
                      <Input className="col-span-6 sm:col-span-2 h-9 bg-background/60" placeholder={t("dose")} value={it.dose} onChange={(e) => updateItem(i, "dose", e.target.value)} />
                      <Input className="col-span-6 sm:col-span-3 h-9 bg-background/60" placeholder={t("frequency")} value={it.frequency} onChange={(e) => updateItem(i, "frequency", e.target.value)} />
                      <Input className="col-span-10 sm:col-span-2 h-9 bg-background/60" placeholder={t("instructions")} value={it.instructions} onChange={(e) => updateItem(i, "instructions", e.target.value)} />
                      <Button size="icon" variant="ghost" className="col-span-2 sm:col-span-1 h-9 text-destructive" onClick={() => removeItem(i)} disabled={form.items.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("notes")}</Label>
                <Textarea maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("notes_ph")} className="bg-background/60 min-h-[60px]" />
              </div>
            </div>
          </ScrollArea>
          <NoticeSlot state={dialogMsg} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
