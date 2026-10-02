"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Star, Calendar, ShieldCheck, ShieldOff,
  CheckCircle2, XCircle, Loader2, Ban, Undo2, Clock, Hospital, Hash,
  MapPin, Navigation, Siren, Ambulance, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";

interface OperatingHourRow {
  dayOfWeek: number;
  isOpen: boolean;
  openingTime: string | null;
  closingTime: string | null;
}

interface SubscriptionRow {
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface FacilityDetail {
  id: string; facilityName: string; email: string; phone: string; license: string | null;
  specialization: string; experience: number; rating: number; bio: string | null;
  avatarColor: string; verified: boolean; active: boolean;
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
  registeredFacilityName: string | null; facilityType: string | null; hfrNumber: string | null;
  establishmentDate: string | null; alternateContactNumber: string | null;
  addressLine1: string | null; addressLine2: string | null; locality: string | null;
  city: string | null; district: string | null; state: string | null; country: string | null;
  pincode: string | null; latitude: number | null; longitude: number | null;
  bedCapacity: number | null; dailyOpdCount: number | null; dailyAdmissions: number | null;
  isOperational: boolean; is24x7: boolean; emergencyServices: boolean; ambulanceAvailable: boolean;
  specializations: string | null; services: string | null;
  profileCompleted: boolean; profileCompletedAt: string | null;
  operatingHours: OperatingHourRow[];
  subscriptions: SubscriptionRow[];
  _count: { appointments: number; prescriptions: number; mizajAssessments: number };
}

const DAY_LABELS: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const [historyOpen, setHistoryOpen] = useState(false);

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
            <span className="font-serif text-lg font-bold text-white">{initials(facility.facilityName)}</span>
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">{facility.facilityName}</h1>
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

      <Tabs defaultValue="overview" className="max-w-4xl">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <Card className="p-6 border-border/50 bg-card/60">
              <h2 className="font-serif text-lg font-semibold mb-4">Contact Information</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {facility.email}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {facility.phone}</div>
                {facility.alternateContactNumber && (
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {facility.alternateContactNumber} (alternate)</div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Last login:{" "}
                  <button type="button" className="hover:text-primary hover:underline transition-colors" onClick={() => setHistoryOpen(true)}>
                    {facility.lastLoginAt ? formatDateTime(facility.lastLoginAt) : "Never"}
                  </button>
                </div>
              </dl>
            </Card>
            <Card className="p-6 border-border/50 bg-card/60">
              <h2 className="font-serif text-lg font-semibold mb-4">Facility Identity</h2>
              <dl className="space-y-3 text-sm">
                {facility.facilityType && <div className="flex items-center gap-2"><Hospital className="h-4 w-4 text-muted-foreground" /> {facility.facilityType}</div>}
                {facility.hfrNumber && <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /> HFR: {facility.hfrNumber}</div>}
                {facility.establishmentDate && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Established {formatDate(facility.establishmentDate)}</div>}
                <div className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" /> {facility.experience} years experience · {facility.rating.toFixed(1)}★ rating</div>
                {facility.license && <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> License: {facility.license}</div>}
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Registered {formatDate(facility.createdAt)}</div>
              </dl>
            </Card>
            <Card className="p-6 border-border/50 bg-card/60 lg:col-span-2">
              <h2 className="font-serif text-lg font-semibold mb-3">Profile Status</h2>
              {facility.profileCompleted ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>
                  {facility.profileCompletedAt && <span className="text-muted-foreground">on {formatDateTime(facility.profileCompletedAt)}</span>}
                </div>
              ) : (
                <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Incomplete</Badge>
              )}
            </Card>
            {facility.bio && (
              <Card className="p-6 border-border/50 bg-card/60 lg:col-span-2">
                <h2 className="font-serif text-lg font-semibold mb-2">Bio</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{facility.bio}</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="location">
          <Card className="p-6 border-border/50 bg-card/60">
            <h2 className="font-serif text-lg font-semibold mb-4">Facility Address</h2>
            {facility.addressLine1 ? (
              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>
                    {[facility.addressLine1, facility.addressLine2, facility.locality].filter(Boolean).join(", ")}
                    <br />
                    {[facility.city, facility.district, facility.state, facility.pincode].filter(Boolean).join(", ")}
                    {facility.country ? `, ${facility.country}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  {facility.latitude && facility.longitude ? `${facility.latitude}, ${facility.longitude}` : "Coordinates not set"}
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No address on file.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="capacity">
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <StatCard label="Beds" value={facility.bedCapacity ?? "—"} />
            <StatCard label="Daily OPD" value={facility.dailyOpdCount ?? "—"} />
            <StatCard label="Daily Admissions" value={facility.dailyAdmissions ?? "—"} />
          </div>
          <div className="flex gap-2">
            {facility.isOperational ? (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Operational</Badge>
            ) : (
              <Badge variant="outline" className="border-destructive/40 text-destructive">Not operational</Badge>
            )}
            {facility.is24x7 && <Badge variant="outline">Open 24×7</Badge>}
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="p-6 border-border/50 bg-card/60">
            <h2 className="font-serif text-lg font-semibold mb-4">Operating Hours</h2>
            {facility.is24x7 ? (
              <Badge className="bg-primary/15 text-primary border-primary/30">Open 24×7</Badge>
            ) : facility.operatingHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schedule on file.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="py-2 font-medium">Day</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Opening</th>
                    <th className="py-2 font-medium">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {DAY_ORDER.map((d) => {
                    const row = facility.operatingHours.find((h) => h.dayOfWeek === d);
                    return (
                      <tr key={d} className="border-b border-border/30 last:border-0">
                        <td className="py-2">{DAY_LABELS[d]}</td>
                        <td className="py-2">{row?.isOpen ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Open</Badge> : <Badge variant="outline" className="text-muted-foreground">Closed</Badge>}</td>
                        <td className="py-2 text-muted-foreground">{row?.isOpen ? row.openingTime || "—" : "—"}</td>
                        <td className="py-2 text-muted-foreground">{row?.isOpen ? row.closingTime || "—" : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <div className="space-y-5">
            <Card className="p-6 border-border/50 bg-card/60">
              <h2 className="font-serif text-lg font-semibold mb-3">Specializations</h2>
              <div className="flex flex-wrap gap-1.5">
                {parseList(facility.specializations).length === 0 ? (
                  <p className="text-sm text-muted-foreground">None on file.</p>
                ) : parseList(facility.specializations).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
            </Card>
            <Card className="p-6 border-border/50 bg-card/60">
              <h2 className="font-serif text-lg font-semibold mb-3">Services</h2>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {parseList(facility.services).length === 0 ? (
                  <p className="text-sm text-muted-foreground">None on file.</p>
                ) : parseList(facility.services).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
              <div className="flex gap-2">
                {facility.emergencyServices && <Badge className="bg-primary/15 text-primary border-primary/30"><Siren className="h-3 w-3 mr-1" /> Emergency services</Badge>}
                {facility.ambulanceAvailable && <Badge className="bg-primary/15 text-primary border-primary/30"><Ambulance className="h-3 w-3 mr-1" /> Ambulance</Badge>}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <Card className="p-6 border-primary/30 bg-primary/5">
            {facility.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscription on file.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-serif text-lg font-bold">{facility.subscriptions[0].plan} Plan</span>
                  <Badge className={cn(facility.subscriptions[0].status === "ACTIVE" ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground")}>
                    {facility.subscriptions[0].status}
                  </Badge>
                </div>
                <div className="text-sm space-y-1 mt-3">
                  <p><span className="text-muted-foreground">Started:</span> {formatDate(facility.subscriptions[0].startDate)}</p>
                  <p><span className="text-muted-foreground">Expires:</span> {formatDate(facility.subscriptions[0].endDate)}</p>
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <LoginHistoryDialog
        role="facility"
        id={facility.id}
        name={facility.facilityName}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
