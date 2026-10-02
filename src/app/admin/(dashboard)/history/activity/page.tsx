"use client";

import { useEffect, useState } from "react";
import {
  Loader2, LogIn, LogOut, User, Lock, Mail, KeyRound, ShieldCheck, XCircle,
  Stethoscope, HeartPulse, Settings, FileText, Send,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActivityRow {
  id: string;
  action: string;
  description: string | null;
  ip: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; icon: any }> = {
  login: { label: "Successful Login", icon: LogIn },
  logout: { label: "Logout", icon: LogOut },
  profile_updated: { label: "Profile Updated", icon: User },
  password_changed: { label: "Password Changed", icon: Lock },
  email_changed: { label: "Email Changed", icon: Mail },
  otp_requested: { label: "OTP Requested", icon: KeyRound },
  otp_verified: { label: "OTP Verified", icon: ShieldCheck },
  failed_login: { label: "Failed Login", icon: XCircle },
  hakim_account_status_changed: { label: "Hakim Account Status Changed", icon: Stethoscope },
  facility_account_status_changed: { label: "Facility Account Status Changed", icon: Stethoscope },
  patient_account_status_changed: { label: "Patient Account Status Changed", icon: HeartPulse },
  settings_updated: { label: "Settings Updated", icon: Settings },
  email_config_updated: { label: "Email Configuration Updated", icon: Mail },
  email_template_updated: { label: "Email Template Updated", icon: FileText },
  email_template_status_changed: { label: "Email Template Status Changed", icon: FileText },
  test_email_sent: { label: "Test Email Sent", icon: Send },
};

export default function ActivityHistoryPage() {
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .get<{ activity: ActivityRow[] }>("/api/admin/history/activity")
      .then((res) => setActivity(res.activity))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Activity History</h1>
        <p className="text-muted-foreground mt-1.5">A full audit trail of actions taken on your admin account.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : activity.length === 0 ? (
        <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
      ) : (
        <Card className="border-border/50 bg-card/60 max-w-2xl divide-y divide-border/40">
          {activity.map((a) => {
            const meta = ACTION_META[a.action] || { label: a.action, icon: ShieldCheck };
            return (
              <div key={a.id} className="flex items-start gap-3 p-4">
                <div className={cn("h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0")}>
                  <meta.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{meta.label}</p>
                  {a.description && <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()}{a.ip ? ` · ${a.ip}` : ""}</p>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
