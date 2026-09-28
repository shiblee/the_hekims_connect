"use client";

import { useEffect, useState } from "react";
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

interface Appt {
  id: string; date: string; time: string; type: string; reason: string; status: string;
  hakim: { id: string; name: string; specialization: string; avatarColor: string; mizaj: string };
}

const TYPES = ["Consultation", "Mizaj Assessment", "Follow-up", "Pharmacy Refill", "Emergency"];
const TIME_SLOTS = ["08:00", "09:00", "09:30", "10:30", "11:00", "12:00", "12:30", "14:00", "15:00", "16:00", "17:00"];

export function PatientAppointmentsView() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [hakims, setHakims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ hakimId: "", date: "", time: "09:00", type: "Consultation", reason: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        api.get<{ appointments: Appt[] }>("/api/appointments"),
        api.get<{ hakims: any[] }>("/api/hakims"),
      ]);
      setAppts(a.appointments || []);
      setHakims(h.hakims || []);
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
    if (!form.hakimId) { toast.error("Select a Hakim"); return; }
    if (!form.date) { toast.error("Pick a date"); return; }
    setSaving(true);
    try {
      await api.post("/api/appointments", form);
      toast.success("Appointment booked!");
      setOpen(false);
      setForm({ hakimId: "", date: "", time: "09:00", type: "Consultation", reason: "" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const cancel = async (id: string) => {
    try { await api.patch(`/api/appointments/${id}`, { status: "cancelled" }); toast.success("Appointment cancelled"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">My Appointments</h2>
          <p className="text-sm text-muted-foreground">Book consultations with verified Hakims.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4" /> Book Appointment</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card/60">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 border-dashed border-border bg-card/60 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No {tab} appointments</p>
          <p className="text-sm text-muted-foreground mb-4">Book a consultation to get started.</p>
          <Button onClick={() => setOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 mr-1" /> Book now</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className="p-4 border-border/50 bg-card/60 hover:border-accent/30 transition-colors">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col items-center justify-center w-16 shrink-0 rounded-lg bg-accent/10 py-2">
                  <span className="text-[10px] text-accent uppercase">{new Date(a.date).toLocaleDateString("en-US", { month: "short" })}</span>
                  <span className="font-serif text-xl font-bold text-accent leading-none">{new Date(a.date).getDate()}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{a.time}</span>
                </div>
                <div className={cn("h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-semibold text-white shrink-0", avatarGradient(a.hakim.avatarColor))}>
                  {initials(a.hakim.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{a.hakim.name}</p>
                  <p className="text-xs text-muted-foreground">{a.hakim.specialization}</p>
                  <p className="text-sm text-accent mt-0.5">{a.type}{a.reason ? ` · ${a.reason}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === "scheduled" && <Badge className="text-accent bg-accent/15 border-accent/30">SCHEDULED</Badge>}
                  {a.status === "completed" && <Badge className="text-emerald-300 bg-emerald-500/15 border-emerald-500/30">COMPLETED</Badge>}
                  {a.status === "cancelled" && <Badge className="text-destructive bg-destructive/15 border-destructive/30">CANCELLED</Badge>}
                  {a.status === "scheduled" && a.date >= today && (
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => cancel(a.id)}>Cancel</Button>
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
          <DialogHeader><DialogTitle>Book an Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Choose a Hakim</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {hakims.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setForm({ ...form, hakimId: h.id })}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left",
                      form.hakimId === h.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/40 bg-background/40"
                    )}
                  >
                    <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(h.avatarColor))}>
                      {initials(h.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{h.specialization}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs flex items-center gap-0.5 text-accent"><Star className="h-3 w-3 fill-accent" />{h.rating}</p>
                      <p className="text-[10px] text-muted-foreground">{h.experience}yrs</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-background/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Select value={form.time} onValueChange={(v) => setForm({ ...form, time: v })}>
                  <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Consultation Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason / Symptoms</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe your concern…" className="bg-background/60 min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={book} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
