"use client";

import { useEffect, useState } from "react";
import { useDateLocale, useValueLabel } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { avatarGradient, initials, mizajBadge } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays, FileImage, FileText, MessageSquare, Heart, Clock,
  Activity, Droplet, ClipboardList, Plus, ChevronRight, AlertCircle, CheckCircle2, Stethoscope,
} from "lucide-react";

interface Appt {
  id: string; date: string; time: string; type: string; reason: string; status: string;
  facility: { id: string; facilityName: string; specialization: string; avatarColor: string };
}

export function PatientOverview({ onNavigate }: { onNavigate: (v: any) => void }) {
  const patient = useAppStore((s) => s.patient);
  const t = useTranslations("patient.pages");
  const vl = useValueLabel();
  const dl = useDateLocale();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  useEffect(() => {
    api.get<{ appointments: Appt[] }>("/api/appointments").then((r) => setAppts(r.appointments || [])).catch(() => {});
    api.get<{ records: any[] }>("/api/patient/records").then((r) => setRecords(r.records || [])).catch(() => {});
    api.get<{ prescriptions: any[] }>("/api/prescriptions").then((r) => setPrescriptions(r.prescriptions || [])).catch(() => {});
  }, []);

  if (!patient) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appts.filter((a) => a.date >= today && a.status === "scheduled").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const nextAppt = upcoming[0];
  const profileComplete = !!(patient.familyHistory && patient.medicalHistory && patient.dob && patient.bloodGroup && patient.address);

  const statCards = [
    { label: t("stat_upcoming"), value: upcoming.length, icon: CalendarDays, tint: "text-primary", bg: "bg-primary/15" },
    { label: t("stat_records"), value: records.length, icon: FileImage, tint: "text-accent", bg: "bg-accent/15" },
    { label: t("stat_rx"), value: prescriptions.length, icon: FileText, tint: "text-primary", bg: "bg-primary/15" },
    { label: t("stat_total"), value: appts.length, icon: Activity, tint: "text-accent", bg: "bg-accent/15" },
  ];

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <Card className="relative overflow-hidden p-6 border-accent/30 bg-gradient-to-br from-card via-card to-accent/5">
        <div className="absolute -top-16 -end-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-2 border-accent/40 text-accent bg-accent/10">
              <Heart className="me-1 h-3 w-3" /> {t("journey")}
            </Badge>
            <h2 className="font-serif text-2xl font-bold">{t("welcome", { name: patient.name.split(" ")[0] })}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {profileComplete
                ? t("profile_done")
                : t("profile_todo")}
            </p>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onNavigate(profileComplete ? "appointments" : "profile")}>
            {profileComplete ? <><CalendarDays className="me-2 h-4 w-4" /> {t("book")}</> : <><ClipboardList className="me-2 h-4 w-4" /> {t("complete_profile")}</>}
          </Button>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-5 border-border/50 bg-card/60 hover:border-accent/40 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-serif text-3xl font-bold mt-1">{s.value}</p>
              </div>
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", s.bg)}>
                <s.icon className={cn("h-5 w-5", s.tint)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        {/* Next appointment + records */}
        <div className="space-y-5 min-w-0">
          {nextAppt ? (
            <Card className="p-5 border-primary/40 bg-card/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-base font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {t("next_appt")}</h3>
                <Button variant="ghost" size="sm" onClick={() => onNavigate("appointments")} className="text-primary">{t("view_all")} <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center w-16 shrink-0 rounded-lg bg-primary/10 py-3">
                  <span className="text-[10px] text-primary uppercase">{new Date(nextAppt.date).toLocaleDateString(dl, { month: "short" })}</span>
                  <span className="font-serif text-2xl font-bold text-primary leading-none">{new Date(nextAppt.date).getDate()}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">{nextAppt.time}</span>
                </div>
                <div className={cn("h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-semibold text-white shrink-0", avatarGradient(nextAppt.facility.avatarColor))}>
                  {initials(nextAppt.facility.facilityName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{nextAppt.facility.facilityName}</p>
                  <p className="text-xs text-muted-foreground">{nextAppt.facility.specialization}</p>
                  <p className="text-sm text-primary mt-0.5">{nextAppt.type}</p>
                  {nextAppt.reason && <p className="text-xs text-muted-foreground">{nextAppt.reason}</p>}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6 border-dashed border-border bg-card/60 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">{t("no_upcoming")}</p>
              <p className="text-xs text-muted-foreground mb-3">{t("no_upcoming_hint")}</p>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onNavigate("appointments")}><Plus className="h-4 w-4 me-1" /> {t("book_now")}</Button>
            </Card>
          )}

          {/* Recent records */}
          <Card className="p-5 border-border/50 bg-card/60">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-base font-semibold flex items-center gap-2"><FileImage className="h-4 w-4 text-accent" /> {t("recent_records")}</h3>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("records")} className="text-accent">{t("view_all")} <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("no_records")}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {records.slice(0, 8).map((r) => (
                  <div key={r.id} className="aspect-square rounded-lg overflow-hidden bg-background/40 border border-border/30">
                    {r.type === "image" ? (
                      <img src={r.fileData} alt={r.title} className="w-full h-full object-cover" />
                    ) : r.type === "video" ? (
                      <video src={r.fileData} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileText className="h-6 w-6" /></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Health summary */}
        <div className="space-y-5">
          <Card className="p-5 border-border/50 bg-card/60">
            <h3 className="font-serif text-base font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> {t("health")}</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("mizaj")}</span>
                <Badge variant="outline" className={cn("border", mizajBadge(patient.mizaj))}>{patient.mizaj || t("not_assessed")}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("blood")}</span>
                <span className="font-medium flex items-center gap-1"><Droplet className="h-3 w-3 text-red-400" />{patient.bloodGroup || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("gender")}</span>
                <span className="font-medium">{patient.gender ? vl(patient.gender) : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("dob")}</span>
                <span className="font-medium">{patient.dob || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("hw")}</span>
                <span className="font-medium">{patient.height || "—"} / {patient.weight || "—"}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => onNavigate("profile")}>{t("edit_profile")}</Button>
          </Card>

          <Card className="p-5 border-border/50 bg-card/60">
            <h3 className="font-serif text-base font-semibold mb-3">{t("completeness")}</h3>
            <div className="space-y-2">
              {[
                { l: t("c_basic"), d: !!(patient.dob && patient.gender && patient.bloodGroup) },
                { l: t("c_address"), d: !!(patient.address && patient.emergencyContact) },
                { l: t("c_family"), d: !!patient.familyHistory },
                { l: t("c_personal"), d: !!patient.medicalHistory },
                { l: t("c_allergies"), d: !!(patient.allergies || patient.currentMedications) },
              ].map((s) => (
                <div key={s.l} className="flex items-center gap-2 text-sm">
                  {s.d ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-accent shrink-0" />}
                  <span className={s.d ? "text-foreground" : "text-muted-foreground"}>{s.l}</span>
                </div>
              ))}
            </div>
            <Progress value={profileComplete ? 100 : 60} className="h-2 mt-3" />
            <p className="text-xs text-muted-foreground mt-2">{profileComplete ? t("ready") : t("safer")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
