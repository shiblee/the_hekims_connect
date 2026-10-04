"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { mizajBadge } from "@/lib/avatar";
import { formatAge } from "@/lib/age";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Users, Loader2, UserPlus, IdCard } from "lucide-react";

interface PatientRow {
  id: string; patientCode: string | null; name: string; email: string; phone: string | null; dob: string | null; gender: string | null;
  bloodGroup: string | null; mizaj: string | null; photo: string | null; avatarColor: string; chronicConditions: string | null;
  address: string | null; appointmentCount: number; lastVisit: string | null;
}

export function PatientsView() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ patients: PatientRow[] }>(`/api/facility/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setPatients(r.patients || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-xl font-bold">Patients</h2>
          <p className="text-sm text-muted-foreground">Your patient roster — click any patient for the full clinical profile.</p>
        </div>
        <Button onClick={() => router.push("/facility/patients/register")}>
          <UserPlus className="h-4 w-4" /> Register Patient
        </Button>
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
            <Card key={p.id} className="p-4 border-border/50 bg-card/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => router.push(`/facility/patients/${p.id}`)}>
              <div className="flex items-start gap-3">
                <EntityAvatar name={p.name} photo={p.photo} avatarColor={p.avatarColor} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium truncate">{p.name}</p>
                    {p.patientCode && (
                      <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[9px] px-1.5 py-0 flex items-center gap-1 shrink-0">
                        <IdCard className="h-2.5 w-2.5" /> {p.patientCode}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.gender, formatAge(p.dob) !== "—" ? formatAge(p.dob) : null, p.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
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
    </div>
  );
}
