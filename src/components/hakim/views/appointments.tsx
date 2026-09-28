"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CalendarDays, Clock, Check, X, Loader2, Search, Phone, Droplet } from "lucide-react";

interface Appt {
  id: string; date: string; time: string; type: string; reason: string; status: string; notes: string | null;
  patient: { id: string; name: string; avatarColor: string; mizaj: string; bloodGroup: string; phone: string };
}

export function AppointmentsView() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ appointments: Appt[] }>("/api/appointments");
      let list = r.appointments || [];
      const today = new Date().toISOString().slice(0, 10);
      if (tab === "today") list = list.filter((a) => a.date === today);
      if (tab === "upcoming") list = list.filter((a) => a.date >= today && a.status === "scheduled");
      if (tab === "completed") list = list.filter((a) => a.status === "completed");
      if (tab === "cancelled") list = list.filter((a) => a.status === "cancelled");
      if (search) list = list.filter((a) => a.patient.name.toLowerCase().includes(search.toLowerCase()) || a.type.toLowerCase().includes(search.toLowerCase()));
      list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setAppts(list);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, search]);

  const update = async (id: string, status: string) => {
    try { await api.patch(`/api/appointments/${id}`, { status }); toast.success(`Marked as ${status}`); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold">Appointments</h2>
        <p className="text-sm text-muted-foreground">Manage your consultation queue.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-card/60">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or type…" className="pl-9 bg-background/60" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : appts.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No appointments in this view.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appts.map((a) => {
            const urgent = /pain|urgent|emergency/i.test(a.reason || a.type);
            return (
              <Card key={a.id} className="p-4 border-border/50 bg-card/60 hover:border-primary/30 transition-colors">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-16 shrink-0 rounded-lg bg-background/50 py-2">
                    <span className="text-[10px] text-muted-foreground uppercase">{new Date(a.date).toLocaleDateString("en-US", { month: "short" })}</span>
                    <span className="font-serif text-xl font-bold leading-none">{new Date(a.date).getDate()}</span>
                    <span className="text-[10px] text-primary mt-0.5">{a.time}</span>
                  </div>
                  <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(a.patient.avatarColor))}>
                    {initials(a.patient.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{a.patient.name}</p>
                      <Badge variant="outline" className={cn("border", mizajBadge(a.patient.mizaj))}>{a.patient.mizaj || "Unknown"}</Badge>
                      {a.patient.bloodGroup && <Badge variant="outline" className="text-red-300 border-red-500/30 bg-red-500/10"><Droplet className="h-3 w-3 mr-0.5" />{a.patient.bloodGroup}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.type}{a.reason ? ` · ${a.reason}` : ""}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" />{a.patient.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "scheduled" && (
                      <>
                        {urgent && <Badge className="text-accent bg-accent/15 border-accent/30">URGENT</Badge>}
                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => update(a.id, "completed")}><Check className="h-3.5 w-3.5 mr-1" /> Complete</Button>
                        <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => update(a.id, "cancelled")}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    {a.status === "completed" && <Badge className="text-emerald-300 bg-emerald-500/15 border-emerald-500/30">COMPLETED</Badge>}
                    {a.status === "cancelled" && <Badge className="text-destructive bg-destructive/15 border-destructive/30">CANCELLED</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
