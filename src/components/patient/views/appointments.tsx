"use client";

import { useEffect, useState } from "react";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CalendarDays, Clock, Plus, Loader2, Stethoscope, Star, Check, X, Droplet } from "lucide-react";
import { sortByLabel } from "@/lib/sort-options";

interface Appt {
  id: string; date: string; time: string; type: string; reason: string; status: string;
  facility: { id: string; facilityName: string; specialization: string; avatarColor: string };
}

const TYPES = ["Consultation", "Mizaj Assessment", "Follow-up", "Pharmacy Refill", "Emergency"];
const TIME_SLOTS = ["08:00", "09:00", "09:30", "10:30", "11:00", "12:00", "12:30", "14:00", "15:00", "16:00", "17:00"];

export function PatientAppointmentsView() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ facilityId: "", date: "", time: "09:00", type: "Consultation", reason: "" });
  const t = useTranslations("patient.pages");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const typeLabel = (ty: string) => (t.has(`t_${ty}`) ? t(`t_${ty}`) : ty);

  const load = async () => {
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        api.get<{ appointments: Appt[] }>("/api/appointments"),
        api.get<{ facilities: any[] }>("/api/facilities"),
      ]);
      setAppts(a.appointments || []);
      setFacilities(h.facilities || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = appts.filter((a) => {
    if (tab === "upcoming") return a.date >= today && a.status === "scheduled";
    if (tab === "past") return a.date < today || a.status === "completed";
    if (tab === "cancelled") return a.status === "cancelled";
    return true;
  }).sort((a, b) => tab === "past" ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time));

  const book = async () => {
    if (!form.facilityId) { toast.error(t("pick_facility")); return; }
    if (!form.date) { toast.error(t("pick_date")); return; }
    setSaving(true);
    try {
      await api.post("/api/appointments", form);
      toast.success(t("booked"));
      setOpen(false);
      setForm({ facilityId: "", date: "", time: "09:00", type: "Consultation", reason: "" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const cancel = async (id: string) => {
    try { await api.patch(`/api/appointments/${id}`, { status: "cancelled" }); toast.success(t("ap_cancelled")); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">{t("ap_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("ap_sub")}</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4" /> {t("book")}</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card/60">
          <TabsTrigger value="upcoming">{t("tab_upcoming")}</TabsTrigger>
          <TabsTrigger value="past">{t("tab_past")}</TabsTrigger>
          <TabsTrigger value="cancelled">{t("tab_cancelled")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline me-2" /> {tc("loading")}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 border-dashed border-border bg-card/60 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">{t(`none_${tab}`)}</p>
          <p className="text-sm text-muted-foreground mb-4">{t("get_started")}</p>
          <Button onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 me-1" /> {t("book_now")}</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className="p-4 border-border/50 bg-card/60 hover:border-accent/30 transition-colors">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col items-center justify-center w-16 shrink-0 rounded-lg bg-accent/10 py-2">
                  <span className="text-[10px] text-accent uppercase">{new Date(a.date).toLocaleDateString(dl, { month: "short" })}</span>
                  <span className="font-serif text-xl font-bold text-accent leading-none">{new Date(a.date).getDate()}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{a.time}</span>
                </div>
                <div className={cn("h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-semibold text-white shrink-0", avatarGradient(a.facility.avatarColor))}>
                  {initials(a.facility.facilityName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{a.facility.facilityName}</p>
                  <p className="text-xs text-muted-foreground">{a.facility.specialization}</p>
                  <p className="text-sm text-accent mt-0.5">{typeLabel(a.type)}{a.reason ? ` · ${a.reason}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === "scheduled" && <Badge className="text-accent bg-accent/15 border-accent/30">{t("scheduled")}</Badge>}
                  {a.status === "completed" && <Badge className="text-emerald-300 bg-emerald-500/15 border-emerald-500/30">{t("completed")}</Badge>}
                  {a.status === "cancelled" && <Badge className="text-destructive bg-destructive/15 border-destructive/30">{t("cancelled")}</Badge>}
                  {a.status === "scheduled" && a.date >= today && (
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => cancel(a.id)}>{tc("cancel")}</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Book dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("book_title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">{t("choose_facility")}</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pe-1">
                {facilities.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setForm({ ...form, facilityId: h.id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-start",
                      form.facilityId === h.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/40 bg-background/40"
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(h.avatarColor))}>
                      {initials(h.facilityName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.facilityName}</p>
                      <p className="text-xs text-muted-foreground truncate">{h.specialization}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-xs flex items-center gap-0.5 text-accent"><Star className="h-3 w-3 fill-accent" />{h.rating}</p>
                      <p className="text-[10px] text-muted-foreground">{t("yrs", { count: h.experience })}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("date")}</Label>
                <Input type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-background/60" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("time")}</Label>
                <Select value={form.time} onValueChange={(v) => setForm({ ...form, time: v })}>
                  <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>{sortByLabel(TYPES, typeLabel).map((ty) => <SelectItem key={ty} value={ty}>{typeLabel(ty)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("reason")}</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("reason_ph")} className="bg-background/60 min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={book} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
