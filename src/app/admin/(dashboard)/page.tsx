"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail, User, ShieldCheck, LogIn, CheckCircle2, XCircle, Clock, ArrowRight,
  LogOut, Lock, KeyRound, ListChecks, Stethoscope, HeartPulse, Settings, FileText, Send,
} from "lucide-react";
import { useAdminStore } from "@/lib/admin-store";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LoginStats { total: number; successful: number; failed: number; lastLogin: string | null; lastLogout: string | null }
interface ActivityRow { id: string; action: string; description: string | null; createdAt: string }

const ACTION_META: Record<string, { label: string; icon: any }> = {
  login: { label: "Successful Login", icon: LogIn },
  logout: { label: "Logout", icon: LogOut },
  profile_updated: { label: "Profile Updated", icon: User },
  password_changed: { label: "Password Changed", icon: Lock },
  email_changed: { label: "Email Changed", icon: Mail },
  otp_requested: { label: "OTP Requested", icon: KeyRound },
  otp_verified: { label: "OTP Verified", icon: ShieldCheck },
  hakim_account_status_changed: { label: "Hakim Account Status Changed", icon: Stethoscope },
  facility_account_status_changed: { label: "Facility Account Status Changed", icon: Stethoscope },
  patient_account_status_changed: { label: "Patient Account Status Changed", icon: HeartPulse },
  settings_updated: { label: "Settings Updated", icon: Settings },
  email_config_updated: { label: "Email Configuration Updated", icon: Mail },
  email_template_updated: { label: "Email Template Updated", icon: FileText },
  email_template_status_changed: { label: "Email Template Status Changed", icon: FileText },
  test_email_sent: { label: "Test Email Sent", icon: Send },
};

export default function AdminDashboardPage() {
  const admin = useAdminStore((s) => s.admin);
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  useEffect(() => {
    adminApi.get<{ stats: LoginStats }>("/api/admin/history/logins").then((r) => setStats(r.stats)).catch(() => {});
    adminApi.get<{ activity: ActivityRow[] }>("/api/admin/history/activity").then((r) => setActivity(r.activity.slice(0, 5))).catch(() => {});
  }, []);

  if (!admin) return null;

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Welcome back, {admin.name}</h1>
        <p className="text-muted-foreground mt-1.5">Here's your administrator overview.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <Card className="p-6 border-border/50 bg-card/60">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
            <User className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Admin Name</p>
          <p className="font-serif text-lg font-semibold mt-0.5">{admin.name}</p>
        </Card>
        <Card className="p-6 border-border/50 bg-card/60">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
            <Mail className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-serif text-lg font-semibold mt-0.5">{admin.email}</p>
        </Card>
        <Card className="p-6 border-border/50 bg-card/60">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Session</p>
          <p className="font-serif text-lg font-semibold mt-0.5">Active</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-lg font-semibold">Login Statistics</h2>
            <Link href="/admin/history/logins" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {stats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-background/40 p-4 border border-border/40">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><LogIn className="h-3.5 w-3.5" /> Total Logins</p>
                <p className="font-serif text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="rounded-lg bg-background/40 p-4 border border-border/40">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Successful</p>
                <p className="font-serif text-2xl font-bold mt-1 text-primary">{stats.successful}</p>
              </div>
              <div className="rounded-lg bg-background/40 p-4 border border-border/40">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Failed Attempts</p>
                <p className="font-serif text-2xl font-bold mt-1 text-destructive">{stats.failed}</p>
              </div>
              <div className="rounded-lg bg-primary/5 p-4 border border-primary/30">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last Login</p>
                <p className="text-sm font-semibold mt-2">{stats.lastLogin ? new Date(stats.lastLogin).toLocaleString() : "—"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </Card>

        <Card className="p-6 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4" /> Recent Activity</h2>
            <Link href="/admin/history/activity" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => {
                const meta = ACTION_META[a.action] || { label: a.action, icon: ShieldCheck };
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0")}>
                      <meta.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{meta.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
