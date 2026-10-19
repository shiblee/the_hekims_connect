"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatWidget } from "@/components/shared/chat-widget";
import {
  Users, CalendarDays, MessageSquare, Activity, TrendingUp,
  Clock, Star, Award, ArrowUpRight, ArrowRight, ChevronRight, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";

interface Appointment {
  id: string; date: string; time: string; type: string; reason: string; status: string;
  patient: { id: string; name: string; avatarColor: string; mizaj: string; bloodGroup: string };
}

export function Overview({ stats, onNavigate }: { stats: any; onNavigate: (v: any) => void }) {
  const facility = useAppStore((s) => s.facility);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const t = useTranslations("clinic.overview");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    api.get<{ appointments: Appointment[] }>(`/api/appointments?date=${today}`).then((r) => {
      setAppointments(r.appointments || []);
    }).catch(() => {});
    api.get<{ patients: any[] }>("/api/facility/patients").then((r) => {
      setRecentPatients((r.patients || []).slice(0, 6));
    }).catch(() => {});
  }, []);

  if (!facility) return null;

  const statCards = [
    { label: t("todays_appts"), value: stats?.todaysAppointments ?? 0, icon: CalendarDays, tint: "text-primary", bg: "bg-primary/15", sub: t("all_time", { count: stats?.totalAppointments ?? 0 }) },
    { label: t("total_patients"), value: stats?.totalPatients ?? 0, icon: Users, tint: "text-accent", bg: "bg-accent/15", sub: t("active_n", { count: stats?.activePatientsCount ?? 0 }) },
    { label: t("unread"), value: stats?.unreadMessages ?? 0, icon: MessageSquare, tint: "text-primary", bg: "bg-primary/15", sub: t("total_n", { count: stats?.totalMessages ?? 0 }) },
    { label: t("mizaj"), value: stats?.mizajAssessments ?? 0, icon: Activity, tint: "text-accent", bg: "bg-accent/15", sub: t("prescriptions_n", { count: stats?.prescriptionsCount ?? 0 }) },
  ];

  const chartData = stats?.weekly || [];
  const consultationPct = stats?.consultationProgress ?? 0;
  const lastPatient = recentPatients[0];

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      {/* Main column */}
      <div className="space-y-5 min-w-0">
        {/* Stat cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="p-5 border-border/50 bg-card/60 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-serif text-3xl font-bold mt-1">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                </div>
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", s.bg)}>
                  <s.icon className={cn("h-5 w-5", s.tint)} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Healing progress chart */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-base font-semibold">{t("analytics")}</h3>
              <p className="text-xs text-muted-foreground">{t("analytics_sub")}</p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">{t("weekly")}</Badge>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "oklch(0.68 0.015 165)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.68 0.015 165)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "oklch(0.72 0.13 175 / 0.08)" }}
                  contentStyle={{ background: "oklch(0.205 0.01 165)", border: "1px solid oklch(0.3 0.012 165)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name={t("appointments")}>
                  {chartData.map((_: any, i: number) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? "oklch(0.78 0.14 80)" : "oklch(0.72 0.13 175)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Active appointments */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold">{t("active_appts")}</h3>
            <button onClick={() => onNavigate("appointments")} className="text-xs text-primary hover:underline flex items-center">
              {t("view_all")} <ChevronRight className="h-3 w-3 rtl:rotate-180" />
            </button>
          </div>
          <div className="space-y-2.5">
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("no_appts_today")}</p>
            ) : (
              appointments.slice(0, 5).map((a) => {
                const urgent = /pain|urgent|emergency/i.test(a.reason || a.type);
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg bg-background/40 p-3 border border-border/30 hover:border-primary/30 transition-colors">
                    <div className="flex flex-col items-center justify-center w-14 shrink-0">
                      <span className="font-serif text-sm font-bold">{a.time}</span>
                      <span className="text-[10px] text-muted-foreground">{a.date.slice(5)}</span>
                    </div>
                    <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(a.patient.avatarColor))}>
                      {initials(a.patient.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.patient.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.type}{a.reason ? ` · ${a.reason}` : ""}</p>
                    </div>
                    <Badge variant="outline" className={urgent ? "text-accent bg-accent/15 border-accent/30" : "text-primary bg-primary/15 border-primary/30"}>
                      {urgent ? t("urgent") : t("scheduled")}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Daily consultation cap */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-base font-semibold">{t("cap")}</h3>
              <p className="text-xs text-muted-foreground">{t("cap_sub", { done: stats?.monthlyCompleted ?? 0, cap: stats?.consultationCap ?? 100 })}</p>
            </div>
            <div className="text-end">
              <p className="font-serif text-3xl font-bold text-primary">{consultationPct}%</p>
              <p className="text-xs text-emerald-400 flex items-center justify-end gap-1">
                <TrendingUp className="h-3 w-3" /> {t("ahead")}
              </p>
            </div>
          </div>
          <Progress value={consultationPct} className="h-2.5" />
        </Card>
      </div>

      {/* Right panel */}
      <div className="space-y-5">
        {/* Profile card */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex flex-col items-center text-center">
            <div className={cn("h-16 w-16 rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white text-lg", avatarGradient(facility.avatarColor))}>
              {initials(facility.facilityName)}
            </div>
            <p className="font-serif font-semibold mt-3">{facility.facilityName}</p>
            <p className="text-xs text-muted-foreground">{facility.specialization}</p>
            <div className="grid grid-cols-3 gap-2 mt-4 w-full">
              <div className="rounded-lg bg-background/50 p-2">
                <p className="text-[10px] text-muted-foreground">{t("rating")}</p>
                <p className="text-sm font-semibold text-primary flex items-center justify-center gap-0.5"><Star className="h-3 w-3 fill-primary" />{facility.rating}</p>
              </div>
              <div className="rounded-lg bg-background/50 p-2">
                <p className="text-[10px] text-muted-foreground">{t("exp")}</p>
                <p className="text-sm font-semibold text-accent">{t("years_short", { count: facility.experience })}</p>
              </div>
              <div className="rounded-lg bg-background/50 p-2">
                <p className="text-[10px] text-muted-foreground">{t("license")}</p>
                <p className="text-sm font-semibold text-primary">{facility.license ? t("verified") : "—"}</p>
              </div>
            </div>
            {facility.bio && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{facility.bio}</p>}
          </div>
        </Card>

        {/* Active patients */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("active_patients")}</h3>
            <button onClick={() => onNavigate("patients")} className="text-xs text-primary hover:underline">{t("view_all")}</button>
          </div>
          <div className="flex -space-x-2">
            {recentPatients.slice(0, 5).map((p) => (
              <div key={p.id} className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white ring-2 ring-card", avatarGradient(p.avatarColor))} title={p.name}>
                {initials(p.name)}
              </div>
            ))}
            {recentPatients.length === 0 && <p className="text-xs text-muted-foreground">{t("no_active")}</p>}
          </div>
        </Card>

        {/* Mini chat with latest patient */}
        {lastPatient && (
          <Card className="border-border/50 bg-card/60 overflow-hidden h-[420px] flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("chat_with", { name: lastPatient.name })}</p>
            </div>
            <div className="flex-1 min-h-0">
              <ChatWidget partnerId={lastPatient.id} partnerType="patient" partnerName={lastPatient.name} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
