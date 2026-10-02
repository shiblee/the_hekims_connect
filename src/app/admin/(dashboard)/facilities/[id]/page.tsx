"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Stethoscope, Star, Calendar, ShieldCheck, ShieldOff,
  CheckCircle2, XCircle, Loader2, Ban, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn, formatDate } from "@/lib/utils";

interface FacilityDetail {
  id: string; name: string; email: string; phone: string; license: string | null;
  specialization: string; experience: number; rating: number; bio: string | null;
  avatarColor: string; verified: boolean; active: boolean;
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
  _count: { appointments: number; prescriptions: number; mizajAssessments: number };
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4 border-border/50 bg-card/60">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.get<{ facility: FacilityDetail }>(`/api/admin/facilities/${id}`)
      .then((res) => setFacility(res.facility))
      .catch(() => toast.error("Could not load Facility"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const toggleActive = async () => {
    if (!facility) return;
    setUpdating(true);
    try {
      const res = await adminApi.patch<{ facility: { active: boolean } }>(`/api/admin/facilities/${id}`, { active: !facility.active });
      setFacility({ ...facility, active: res.facility.active });
      toast.success(res.facility.active ? "Facility account activated" : "Facility account suspended");
    } catch (err: any) {
      toast.error(err.message || "Could not update account status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }
  if (!facility) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <p className="text-muted-foreground">Facility not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/facilities" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Facility list
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className={cn("h-16 w-16 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0", avatarGradient(facility.avatarColor))}>
            <span className="font-serif text-lg font-bold text-white">{initials(facility.name)}</span>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">{facility.name}</h1>
            <p className="text-muted-foreground">{facility.specialization}</p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={updating}
          className={facility.active ? "text-destructive hover:text-destructive" : "text-emerald-400 hover:text-emerald-400"}
          onClick={toggleActive}
        >
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : facility.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
          {facility.active ? "Suspend account" : "Reactivate account"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {facility.verified ? (
          <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Email Verified</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Unverified</Badge>
        )}
        {facility.active ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400"><ShieldCheck className="h-3 w-3 mr-1" /> Active</Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive"><ShieldOff className="h-3 w-3 mr-1" /> Suspended</Badge>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8 max-w-2xl">
        <StatCard label="Appointments" value={facility._count.appointments} />
        <StatCard label="Prescriptions" value={facility._count.prescriptions} />
        <StatCard label="Mizaj Assessments" value={facility._count.mizajAssessments} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 max-w-4xl">
        <Card className="p-6 border-border/50 bg-card/60">
          <h2 className="font-serif text-lg font-semibold mb-4">Contact Information</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {facility.email}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {facility.phone}</div>
          </dl>
        </Card>
        <Card className="p-6 border-border/50 bg-card/60">
          <h2 className="font-serif text-lg font-semibold mb-4">Professional Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground" /> {facility.specialization}</div>
            <div className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" /> {facility.experience} years experience · {facility.rating.toFixed(1)}★ rating</div>
            {facility.license && <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> License: {facility.license}</div>}
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Registered {formatDate(facility.createdAt)}</div>
          </dl>
        </Card>
        {facility.bio && (
          <Card className="p-6 border-border/50 bg-card/60 lg:col-span-2">
            <h2 className="font-serif text-lg font-semibold mb-2">Bio</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{facility.bio}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
