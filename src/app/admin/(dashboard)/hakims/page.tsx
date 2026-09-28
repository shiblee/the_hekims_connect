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
import { cn } from "@/lib/utils";

interface HakimRow {
  id: string; name: string; email: string; phone: string; specialization: string;
  experience: number; mizaj: string; rating: number; avatarColor: string;
  verified: boolean; active: boolean; lastLoginAt: string | null; createdAt: string;
}

export default function HakimListPage() {
  const [rows, setRows] = useState<HakimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [verified, setVerified] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (verified !== "all") params.set("verified", verified);
    adminApi
      .get<{ hakims: HakimRow[]; total: number; totalPages: number }>(`/api/admin/hakims?${params}`)
      .then((res) => { setRows(res.hakims); setTotal(res.total); setTotalPages(res.totalPages); })
      .finally(() => setLoading(false));
  }, [page, q, status, verified]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Hakim Management</h1>
        <p className="text-muted-foreground mt-1.5">{total} Hakim{total === 1 ? "" : "s"} registered on the portal.</p>
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
        <p className="text-muted-foreground text-sm">No Hakims match these filters.</p>
      ) : (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Hakim</th>
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
                          <span className="text-[10px] font-bold text-white">{initials(h.name)}</span>
                        </div>
                        <span className="font-medium whitespace-nowrap">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{h.email}</div>
                      <div className="text-xs">{h.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{h.specialization}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(h.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{h.lastLoginAt ? new Date(h.lastLoginAt).toLocaleString() : "Never"}</td>
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
                        <Link href={`/admin/hakims/${h.id}`}>View</Link>
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
    </div>
  );
}
