"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Users, Loader2, Phone, MapPin, Droplet, Calendar, Activity, FileText, MessageSquare, Clock } from "lucide-react";

interface PatientRow {
  id: string; name: string; email: string; phone: string | null; dob: string | null; gender: string | null;
  bloodGroup: string | null; mizaj: string | null; avatarColor: string; chronicConditions: string | null;
  address: string | null; appointmentCount: number; lastVisit: string | null;
}

export function PatientsView() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PatientRow | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ patients: PatientRow[] }>(`/api/facility/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setPatients(r.patients || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const openDetail = async (p: PatientRow) => {
    setSelected(p);
    setDetail(null);
    try {
      // Fetch patient's mizaj history + prescriptions via the public-ish endpoints
      const [mizaj, presc] = await Promise.all([
        api.get<{ assessments: any[] }>(`/api/mizaj?patientId=${p.id}`),
        api.get<{ prescriptions: any[] }>(`/api/prescriptions?patientId=${p.id}`),
      ]);
      setDetail({ mizaj: mizaj.assessments || [], prescriptions: presc.prescriptions || [] });
    } catch { setDetail({ mizaj: [], prescriptions: [] }); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold">Patients</h2>
        <p className="text-sm text-muted-foreground">Your patient roster — click any patient for the full clinical profile.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone…" className="pl-9 bg-background/60 max-w-md" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : patients.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No patients found.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p) => (
            <Card key={p.id} className="p-4 border-border/50 bg-card/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => openDetail(p)}>
              <div className="flex items-start gap-3">
                <div className={cn("h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white shrink-0", avatarGradient(p.avatarColor))}>
                  {initials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.phone || "—"}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {p.mizaj && <Badge variant="outline" className={cn("border", mizajBadge(p.mizaj))}>{p.mizaj}</Badge>}
                    {p.bloodGroup && <Badge variant="outline" className="text-red-300 border-red-500/30 bg-red-500/10 text-[10px]">{p.bloodGroup}</Badge>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div><p className="text-muted-foreground">Visits</p><p className="font-semibold">{p.appointmentCount}</p></div>
                <div><p className="text-muted-foreground">Last visit</p><p className="font-semibold">{p.lastVisit || "—"}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white", avatarGradient(selected.avatarColor))}>
                    {initials(selected.name)}
                  </div>
                  <div>
                    <p>{selected.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{selected.email} · {selected.phone || "—"}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 pb-4">
                  {/* Quick facts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { l: "DOB", v: selected.dob || "—", i: Calendar },
                      { l: "Gender", v: selected.gender || "—", i: Users },
                      { l: "Blood", v: selected.bloodGroup || "—", i: Droplet },
                      { l: "Mizaj", v: selected.mizaj || "—", i: Activity },
                    ].map((f) => (
                      <div key={f.l} className="rounded-lg bg-background/50 p-2.5">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><f.i className="h-3 w-3" />{f.l}</p>
                        <p className="text-sm font-medium">{f.v}</p>
                      </div>
                    ))}
                  </div>

                  {selected.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">{selected.address}</p>
                    </div>
                  )}

                  {selected.chronicConditions && (
                    <Card className="p-3 border-accent/30 bg-accent/5">
                      <p className="text-xs font-medium text-accent mb-1 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Chronic Conditions</p>
                      <p className="text-sm">{selected.chronicConditions}</p>
                    </Card>
                  )}

                  {/* Mizaj history */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Mizaj Assessments</p>
                    {detail?.mizaj?.length ? (
                      <div className="space-y-2">
                        {detail.mizaj.map((m: any) => (
                          <div key={m.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-primary">{m.result}</p>
                              <span className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
                            </div>
                            {m.pulse && <p className="text-xs text-muted-foreground">Pulse: {m.pulse}</p>}
                            {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No assessments yet.</p>}
                  </div>

                  {/* Prescriptions */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Prescriptions</p>
                    {detail?.prescriptions?.length ? (
                      <div className="space-y-2">
                        {detail.prescriptions.map((pr: any) => (
                          <div key={pr.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium">{pr.therapyType}</p>
                              <span className="text-[10px] text-muted-foreground">{new Date(pr.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="space-y-1">
                              {pr.items.map((it: any, i: number) => (
                                <div key={i} className="text-xs text-muted-foreground">• {it.name} — {it.dose} {it.frequency} ({it.instructions})</div>
                              ))}
                            </div>
                            {pr.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{pr.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No prescriptions yet.</p>}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
