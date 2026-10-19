"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Loader2, Ban, Undo2, LayoutGrid, IdCard, MapPin, Gauge, Stethoscope, Sparkles,
  Mail, Phone, Hash, CalendarDays, History, Users, Activity, IndianRupee, CalendarClock, Lock, CircleCheck, CircleDashed,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { FacilityDetailContext, HEALTH_STYLE, type FacilityDetail, type FacilityInsights } from "./facility-detail-context";
import { DAY, ScoreRing, Trend, ago, inr } from "./detail-ui";

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutGrid, hint: "Activity & health" },
  { key: "details", label: "Identity & contact", icon: IdCard, hint: "Name, type, HFR, login" },
  { key: "location", label: "Location", icon: MapPin, hint: "Address" },
  { key: "capacity", label: "Capacity & schedule", icon: Gauge, hint: "Beds, OPD, hours" },
  { key: "services", label: "Services", icon: Stethoscope, hint: "Specializations & services" },
  { key: "plan", label: "Plan", icon: Sparkles, hint: "Subscription" },
];

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/60 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function planInfo(f: FacilityDetail) {
  const sub = f.subscriptions[0];
  if (!sub) return { label: "No plan", tone: "muted" as const, detail: "" };
  const days = Math.ceil((Date.parse(sub.endDate) - Date.now()) / DAY);
  if (days < 0 || sub.status === "EXPIRED") return { label: "Plan expired", tone: "bad" as const, detail: `Ended ${formatDate(sub.endDate)}` };
  if (sub.status === "CANCELLED") return { label: "Plan cancelled", tone: "bad" as const, detail: "" };
  return sub.plan === "FREE"
    ? { label: "Free trial", tone: days <= 14 ? "warn" as const : "info" as const, detail: `${days} day${days === 1 ? "" : "s"} left` }
    : { label: "Premium", tone: "good" as const, detail: `Until ${formatDate(sub.endDate)}` };
}

const PILL = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  bad: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  muted: "border-border bg-muted/50 text-muted-foreground",
};
function Pill({ tone, icon: Icon, children }: { tone: keyof typeof PILL; icon?: typeof Users; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", PILL[tone])}>{Icon && <Icon className="h-3 w-3" />}{children}</span>;
}

export default function FacilityDetailLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [insights, setInsights] = useState<FacilityInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<"" | "active" | "verified">("");
  const [confirm, setConfirm] = useState<"" | "suspend" | "reactivate" | "verify" | "unverify">("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    adminApi.get<{ facility: FacilityDetail }>(`/api/admin/facilities/${id}`)
      .then((res) => setFacility(res.facility))
      .catch(() => toast.error("Could not load Facility"))
      .finally(() => setLoading(false));
  }, [id]);
  const reloadInsights = useCallback(() => {
    adminApi.get<FacilityInsights>(`/api/admin/facilities/${id}/insights`).then(setInsights).catch(() => {});
  }, [id]);

  useEffect(() => { reload(); reloadInsights(); }, [reload, reloadInsights]);

  const update = async (field: "active" | "verified", value: boolean) => {
    if (!facility) return;
    setUpdating(field);
    try {
      const res = await adminApi.patch<{ facility: FacilityDetail }>(`/api/admin/facilities/${id}`, { [field]: value });
      setFacility(res.facility);
      reloadInsights();
      toast.success(field === "active" ? (value ? "Account reactivated — the clinic has been emailed" : "Account suspended — the clinic has been emailed") : (value ? "Marked as verified" : "Verification removed"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally { setUpdating(""); setConfirm(""); }
  };

  if (loading && !facility) {
    return <div className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6 lg:px-16"><div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading facility…</div></div>;
  }
  if (!facility) {
    return <div className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6 lg:px-16"><p className="text-muted-foreground">Facility not found.</p></div>;
  }

  const plan = planInfo(facility);
  const m = insights?.metrics;
  const place = [facility.city, facility.state].filter(Boolean).join(", ");
  const contacts: { icon: typeof Mail; label: string; href?: string; title: string }[] = [
    facility.email && { icon: Mail, label: facility.email, href: `mailto:${facility.email}`, title: "Email" },
    facility.phone && { icon: Phone, label: facility.phone, href: `tel:${facility.phone}`, title: "Phone" },
    facility.alternateContactNumber && { icon: Phone, label: facility.alternateContactNumber, href: `tel:${facility.alternateContactNumber}`, title: "Alternate contact" },
    facility.hfrNumber && { icon: Hash, label: facility.hfrNumber, title: "HFR number" },
    { icon: CalendarDays, label: `Joined ${formatDate(facility.createdAt)}`, title: "Registered on" },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href?: string; title: string }[];

  const CONFIRM = {
    suspend: { title: `Suspend ${facility.facilityName}?`, body: "The clinic and its staff can't sign in until you reactivate it. Their data stays as it is, and the clinic is emailed that the account is suspended.", action: "Suspend account", run: () => update("active", false), danger: true },
    reactivate: { title: `Reactivate ${facility.facilityName}?`, body: "The clinic and its staff can sign in again, and the clinic is emailed that the account is active.", action: "Reactivate", run: () => update("active", true), danger: false },
    verify: { title: "Mark this clinic as verified?", body: "Do this after checking their registration details and HFR number. Verification counts toward their engagement score.", action: "Mark verified", run: () => update("verified", true), danger: false },
    unverify: { title: "Remove verification?", body: "The clinic will show as not verified until you verify it again.", action: "Remove verification", run: () => update("verified", false), danger: true },
  } as const;
  const c = confirm ? CONFIRM[confirm] : null;

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-16">
      <Link href="/admin/facilities" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All facilities
      </Link>

      {/* Hero */}
      <Card className="relative mb-4 gap-0 overflow-hidden border-border bg-card/60 p-0">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/[0.03] to-transparent" />
        <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ring-4 ring-background sm:h-20 sm:w-20", avatarGradient(facility.avatarColor))}>
              <span className="font-serif text-xl font-bold text-white sm:text-2xl">{initials(facility.facilityName)}</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">{facility.facilityName}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {facility.facilityType || "Type not set"}{place && <> · <MapPin className="mb-0.5 inline h-3.5 w-3.5" /> {place}</>}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {!facility.active ? <Pill tone="bad" icon={Ban}>Suspended</Pill> : insights?.locked ? <Pill tone="warn" icon={Lock}>Locked · failed sign-ins</Pill> : <Pill tone="good" icon={CircleCheck}>Active</Pill>}
                {facility.verified ? <Pill tone="info" icon={ShieldCheck}>Verified</Pill> : <Pill tone="muted" icon={ShieldAlert}>Not verified</Pill>}
                {facility.profileCompleted ? <Pill tone="good" icon={BadgeCheck}>Profile complete</Pill> : <Pill tone="warn" icon={CircleDashed}>Profile incomplete</Pill>}
                <Pill tone={plan.tone} icon={Sparkles}>{plan.label}{plan.detail && ` · ${plan.detail}`}</Pill>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {contacts.map((x) => {
                  const inner = <><x.icon className="h-3.5 w-3.5 text-muted-foreground" />{x.label}</>;
                  return x.href
                    ? <a key={x.title} href={x.href} title={x.title} className="inline-flex items-center gap-1.5 hover:text-primary hover:underline">{inner}</a>
                    : <span key={x.title} title={x.title} className="inline-flex items-center gap-1.5">{inner}</span>;
                })}
                <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex items-center gap-1.5 hover:text-primary hover:underline" title="Sign-in history">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />Last sign-in {facility.lastLoginAt ? ago(facility.lastLoginAt).toLowerCase() : "never"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {facility.verified ? (
              <Button variant="outline" disabled={!!updating} onClick={() => setConfirm("unverify")}>{updating === "verified" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Remove verification</Button>
            ) : (
              <Button disabled={!!updating} onClick={() => setConfirm("verify")}>{updating === "verified" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify clinic</Button>
            )}
            <Button
              variant="outline" disabled={!!updating} onClick={() => setConfirm(facility.active ? "suspend" : "reactivate")}
              className={facility.active ? "text-destructive hover:text-destructive" : "text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"}
            >
              {updating === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : facility.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
              {facility.active ? "Suspend" : "Reactivate"}
            </Button>
          </div>
        </div>

        {/* Key figures */}
        <div className="relative grid grid-cols-2 gap-2.5 border-t border-border bg-background/30 p-4 sm:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 sm:col-span-1">
            {insights ? <ScoreRing score={insights.score} band={insights.health} /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Engagement</p>
              <p className={cn("text-base font-bold", insights && HEALTH_STYLE[insights.health].text)}>{insights ? HEALTH_STYLE[insights.health].label : "…"}</p>
            </div>
          </div>
          <Stat icon={Users} label="Patients" value={m ? m.patients.toLocaleString("en-IN") : "…"} hint={m ? `${m.newPatients30} new in 30 days` : undefined} />
          <Stat icon={Stethoscope} label="Visits · 30 days" value={m ? m.visits30 : "…"} hint={m && <Trend now={m.visits30} prev={m.visitsPrev30} />} />
          <Stat icon={IndianRupee} label="Revenue · 30 days" value={m ? inr(m.revenue30) : "…"} hint={m && <Trend now={m.revenue30} prev={m.revenuePrev30} money />} />
          <Stat icon={CalendarClock} label="Upcoming" value={m ? m.upcoming : "…"} hint={m ? `appointments · ${m.appointments} booked in all` : undefined} />
          <Stat icon={Users} label="Staff" value={insights ? insights.staff.filter((s) => s.active).length : "…"} hint={insights ? `${insights.staff.length} added in total` : undefined} />
          <Stat icon={Activity} label="Last active" value={m ? ago(m.lastActivityAt) : "…"} hint={m?.lastActivityAt ? formatDateTime(m.lastActivityAt) : "No sign-in or visit yet"} />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <nav className="h-fit md:sticky md:top-6 md:self-start">
          <Card className="gap-0 border-border bg-card/60 p-2">
            {SECTIONS.map((s) => {
              const on = pathname?.endsWith(`/${s.key}`);
              return (
                <Link key={s.key} href={`/admin/facilities/${id}/${s.key}`} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors", on ? "bg-primary text-primary-foreground" : "hover:bg-muted/60")}>
                  <s.icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0"><span className="block truncate font-medium">{s.label}</span><span className={cn("block truncate text-[11px]", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.hint}</span></span>
                </Link>
              );
            })}
          </Card>
        </nav>

        <div className="min-w-0">
          <FacilityDetailContext.Provider value={{ facility, setFacility, reload, insights, reloadInsights }}>
            {children}
          </FacilityDetailContext.Provider>
        </div>
      </div>

      <LoginHistoryDialog role="facility" id={facility.id} name={facility.facilityName} open={historyOpen} onOpenChange={setHistoryOpen} />

      <AlertDialog open={!!c} onOpenChange={(o) => { if (!o && !updating) setConfirm(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c?.title}</AlertDialogTitle>
            <AlertDialogDescription>{c?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!!updating} onClick={(e) => { e.preventDefault(); c?.run(); }} className={c?.danger ? "bg-destructive text-white hover:bg-destructive/90" : ""}>
              {updating && <Loader2 className="h-4 w-4 animate-spin" />}{c?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
