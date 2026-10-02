"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";

interface FacilityRow {
  id: string; facilityName: string; email: string; phone: string; specialization: string;
  experience: number; rating: number; avatarColor: string;
  verified: boolean; active: boolean; lastLoginAt: string | null; createdAt: string;
}

export default function FacilityListPage() {
  const [rows, setRows] = useState<FacilityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [verified, setVerified] = useState("all");
  const [loading, setLoading] = useState(true);
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (verified !== "all") params.set("verified", verified);
    adminApi
      .get<{ facilities: FacilityRow[]; total: number; totalPages: number }>(`/api/admin/facilities?${params}`)
      .then((res) => { setRows(res.facilities); setTotal(res.total); setTotalPages(res.totalPages); })
      .finally(() => setLoading(false));
  }, [page, q, status, verified]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Facility Management</h1>
        <p className="text-muted-foreground mt-1.5">{total} Facilit{total === 1 ? "y" : "ies"} registered on the portal.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="h-10 pl-10 bg-card/60"
            placeholder="Search by name, email, phone…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-40 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verified} onValueChange={(v) => { setVerified(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-44 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verification</SelectItem>
            <SelectItem value="true">Verified</SelectItem>
            <SelectItem value="false">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Facilities match these filters.</p>
      ) : (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Facility</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Specialization</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0", avatarGradient(h.avatarColor))}>
                          <span className="text-[10px] font-bold text-white">{initials(h.facilityName)}</span>
                        </div>
                        <span className="font-medium whitespace-nowrap">{h.facilityName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{h.email}</div>
                      <div className="text-xs">{h.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{h.specialization}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(h.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <button
                        type="button"
                        className="hover:text-primary hover:underline transition-colors"
                        onClick={() => setHistoryTarget({ id: h.id, name: h.facilityName })}
                      >
                        {h.lastLoginAt ? formatDateTime(h.lastLoginAt) : "Never"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {h.verified ? (
                          <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Unverified</Badge>
                        )}
                        {h.active ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">Suspended</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/facilities/${h.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {historyTarget && (
        <LoginHistoryDialog
          role="facility"
          id={historyTarget.id}
          name={historyTarget.name}
          open={!!historyTarget}
          onOpenChange={(o) => { if (!o) setHistoryTarget(null); }}
        />
      )}
    </div>
  );
}
