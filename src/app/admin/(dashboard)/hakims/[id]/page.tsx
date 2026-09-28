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

interface HakimDetail {
  id: string; name: string; email: string; phone: string; license: string | null;
  specialization: string; experience: number; mizaj: string; rating: number; bio: string | null;
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

export default function HakimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hakim, setHakim] = useState<HakimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.get<{ hakim: HakimDetail }>(`/api/admin/hakims/${id}`)
      .then((res) => setHakim(res.hakim))
      .catch(() => toast.error("Could not load Hakim"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const toggleActive = async () => {
    if (!hakim) return;
    setUpdating(true);
    try {
      const res = await adminApi.patch<{ hakim: { active: boolean } }>(`/api/admin/hakims/${id}`, { active: !hakim.active });
      setHakim({ ...hakim, active: res.hakim.active });
      toast.success(res.hakim.active ? "Hakim account activated" : "Hakim account suspended");
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
  if (!hakim) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <p className="text-muted-foreground">Hakim not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/hakims" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Hakim list
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className={cn("h-16 w-16 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0", avatarGradient(hakim.avatarColor))}>
            <span className="font-serif text-lg font-bold text-white">{initials(hakim.name)}</span>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">{hakim.name}</h1>
            <p className="text-muted-foreground">{hakim.specialization}</p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={updating}
          className={hakim.active ? "text-destructive hover:text-destructive" : "text-emerald-400 hover:text-emerald-400"}
          onClick={toggleActive}
        >
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : hakim.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
          {hakim.active ? "Suspend account" : "Reactivate account"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {hakim.verified ? (
          <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Email Verified</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Unverified</Badge>
        )}
        {hakim.active ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400"><ShieldCheck className="h-3 w-3 mr-1" /> Active</Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive"><ShieldOff className="h-3 w-3 mr-1" /> Suspended</Badge>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8 max-w-2xl">
        <StatCard label="Appointments" value={hakim._count.appointments} />
        <StatCard label="Prescriptions" value={hakim._count.prescriptions} />
        <StatCard label="Mizaj Assessments" value={hakim._count.mizajAssessments} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 max-w-4xl">
        <Card className="p-6 border-border/50 bg-card/60">
          <h2 className="font-serif text-lg font-semibold mb-4">Contact Information</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {hakim.email}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {hakim.phone}</div>
          </dl>
        </Card>
        <Card className="p-6 border-border/50 bg-card/60">
          <h2 className="font-serif text-lg font-semibold mb-4">Professional Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground" /> {hakim.specialization}</div>
            <div className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" /> {hakim.experience} years experience · {hakim.rating.toFixed(1)}★ rating</div>
            {hakim.license && <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> License: {hakim.license}</div>}
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Registered {formatDate(hakim.createdAt)}</div>
          </dl>
        </Card>
        {hakim.bio && (
          <Card className="p-6 border-border/50 bg-card/60 lg:col-span-2">
            <h2 className="font-serif text-lg font-semibold mb-2">Bio</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{hakim.bio}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
