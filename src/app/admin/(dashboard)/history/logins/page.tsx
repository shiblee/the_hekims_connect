"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LoginRow {
  id: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
  logoutAt: string | null;
  logoutType: string | null;
}

interface Stats {
  total: number;
  successful: number;
  failed: number;
  lastLogin: string | null;
  lastLogout: string | null;
}

const LOGOUT_LABELS: Record<string, string> = {
  manual: "Manual logout",
  password_change: "Password change",
  timeout: "Session timeout",
  forced: "Forced logout",
};

function formatDuration(loginAt: string, logoutAt: string | null) {
  if (!logoutAt) return "—";
  const mins = Math.round((new Date(logoutAt).getTime() - new Date(loginAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function LoginHistoryPage() {
  const [events, setEvents] = useState<LoginRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .get<{ events: LoginRow[]; stats: Stats }>("/api/admin/history/logins")
      .then((res) => { setEvents(res.events); setStats(res.stats); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Login History</h1>
        <p className="text-muted-foreground mt-1.5">Every sign-in attempt, paired with its logout.</p>
      </div>

      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-3xl">
          <Card className="p-4 border-border/50 bg-card/60">
            <p className="text-sm text-muted-foreground">Total Logins</p>
            <p className="font-serif text-2xl font-bold mt-1">{stats.total}</p>
          </Card>
          <Card className="p-4 border-border/50 bg-card/60">
            <p className="text-sm text-muted-foreground">Failed Attempts</p>
            <p className="font-serif text-2xl font-bold mt-1 text-destructive">{stats.failed}</p>
          </Card>
          <Card className="p-4 border-primary/30 bg-primary/5">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last Login</p>
            <p className="text-sm font-semibold mt-2">{stats.lastLogin ? new Date(stats.lastLogin).toLocaleString() : "—"}</p>
          </Card>
          <Card className="p-4 border-border/50 bg-card/60">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last Logout</p>
            <p className="text-sm font-semibold mt-2">{stats.lastLogout ? new Date(stats.lastLogout).toLocaleString() : "—"}</p>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No login events yet.</p>
      ) : (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Login</th>
                  <th className="px-4 py-3 font-medium">Logout</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">IP Address</th>
                  <th className="px-4 py-3 font-medium">Device</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {e.status !== "success" ? "—" : e.logoutAt ? new Date(e.logoutAt).toLocaleString() : "Active session"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.status === "success" ? formatDuration(e.createdAt, e.logoutAt) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.ip || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.browser} / {e.os}</td>
                    <td className="px-4 py-3">
                      {e.status === "success" ? (
                        e.logoutAt ? (
                          <Badge variant="outline">{LOGOUT_LABELS[e.logoutType || ""] || "Logged out"}</Badge>
                        ) : (
                          <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40"><XCircle className="h-3 w-3 mr-1" /> Failed{e.failureReason ? ` — ${e.failureReason}` : ""}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
