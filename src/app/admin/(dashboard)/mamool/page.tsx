"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownUp, BookMarked, ChevronLeft, ChevronRight, Copy, Eye, Loader2, MoreHorizontal, Pencil, Plus, Power, Search } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_STYLE, type RegimenStatus } from "@/components/admin/mamool-shared";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RegimenRow {
  id: string; code: string; name: string; status: RegimenStatus; active: boolean;
  version: number; approvedVersion: number | null; complaints: string[]; medicines: number;
  createdByName: string; updatedByName: string | null; updatedAt: string;
}

type SortKey = "code" | "name" | "medicines" | "updatedAt";
type Sort = { key: SortKey; dir: 1 | -1 };

function SortHead({ k, sort, onSort, children }: { k: SortKey; sort: Sort; onSort: (s: Sort) => void; children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-start font-semibold">
      <button type="button" onClick={() => onSort({ key: k, dir: sort.key === k ? (sort.dir === 1 ? -1 : 1) : 1 })} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}<ArrowDownUp className={cn("h-3 w-3", sort.key === k ? "opacity-100" : "opacity-30")} />
      </button>
    </th>
  );
}
const PAGE = 20;

/**
 * Admin → Mamool-e-Matab. Treatment Regimens: a reviewed set of medicines from the
 * medicine list, linked to chief complaints. Clinics only ever see the last approved
 * version of an active regimen, in the prescription's Mamool-e-Matab picker.
 */
export default function MamoolListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<RegimenRow[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | RegimenStatus>("all");
  const [activeF, setActiveF] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<Sort>({ key: "updatedAt", dir: -1 });
  const [page, setPage] = useState(0);

  const load = () => adminApi.get<{ regimens: RegimenRow[] }>("/api/admin/mamool").then((r) => setRows(r.regimens)).catch((e) => { toast.error(e.message || "Could not load regimens"); setRows([]); });
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = (rows ?? []).filter((r) =>
      (status === "all" || r.status === status) &&
      (activeF === "all" || (activeF === "active") === r.active) &&
      (!n || r.name.toLowerCase().includes(n) || r.code.toLowerCase().includes(n) || r.complaints.some((c) => c.toLowerCase().includes(n))));
    return [...list].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [rows, q, status, activeF, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1); // filters can shrink the list below the current page
  const pageRows = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  const act = async (r: RegimenRow, action: "activate" | "deactivate" | "duplicate") => {
    try {
      const res = await adminApi.post<{ id?: string }>(`/api/admin/mamool/${r.id}/action`, { action });
      if (action === "duplicate" && res.id) { toast.success(`Copied ${r.code}`); router.push(`/admin/mamool/${res.id}`); return; }
      toast.success(action === "activate" ? "Activated" : "Deactivated — clinics no longer see it");
      load();
    } catch (e: any) { toast.error(e.message || "Could not update"); }
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><BookMarked className="h-7 w-7 text-primary" /> Mamool-e-Matab</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">Treatment regimens: a reviewed set of medicines from the medicine list, linked to chief complaints. Doctors see the last approved version of active regimens in the prescription and can edit or remove any medicine before saving.</p>
        </div>
        <Button asChild><Link href="/admin/mamool/new"><Plus className="h-4 w-4" /> New regimen</Link></Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search by name, code or complaint…" className="ps-9" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Approval status">
          <option value="all">All approval statuses</option>
          {(Object.keys(STATUS_STYLE) as RegimenStatus[]).map((k) => <option key={k} value={k}>{STATUS_STYLE[k].label}</option>)}
        </select>
        <select value={activeF} onChange={(e) => { setActiveF(e.target.value as typeof activeF); setPage(0); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Active status">
          <option value="all">Active and inactive</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
        </select>
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} regimen{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {!rows ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground border-dashed">
          <BookMarked className="h-8 w-8 opacity-40" />
          {rows.length ? "No regimen matches these filters." : "No regimens yet — create the first one."}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SortHead k="code" sort={sort} onSort={setSort}>ID</SortHead><SortHead k="name" sort={sort} onSort={setSort}>Regimen</SortHead>
                  <th className="px-3 py-2 text-start font-semibold">Chief complaints</th>
                  <SortHead k="medicines" sort={sort} onSort={setSort}>Medicines</SortHead>
                  <th className="px-3 py-2 text-start font-semibold">Created by</th>
                  <th className="px-3 py-2 text-start font-semibold">Approval</th>
                  <th className="px-3 py-2 text-start font-semibold">Active</th>
                  <SortHead k="updatedAt" sort={sort} onSort={setSort}>Last updated</SortHead>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((r) => {
                  const st = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/admin/mamool/${r.id}`)}>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.code}</td>
                      <td className="px-3 py-2.5 font-medium">{r.name}<span className="block text-[11px] font-normal text-muted-foreground">v{r.version}{r.approvedVersion && r.approvedVersion !== r.version ? ` · clinics use v${r.approvedVersion}` : ""}</span></td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-xs"><span className="line-clamp-2">{r.complaints.join(", ") || "—"}</span></td>
                      <td className="px-3 py-2.5">{r.medicines}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.createdByName}</td>
                      <td className="px-3 py-2.5"><Badge variant="outline" className={st.cls}>{st.label}</Badge></td>
                      <td className="px-3 py-2.5">{r.active ? <span className="text-emerald-600 dark:text-emerald-400">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.updatedAt)}</td>
                      <td className="px-3 py-2.5 text-end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/mamool/${r.id}`)}><Eye className="h-4 w-4" /> View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/admin/mamool/${r.id}?edit=1`)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => act(r, "duplicate")}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => act(r, r.active ? "deactivate" : "activate")}><Power className="h-4 w-4" /> {r.active ? "Deactivate" : "Activate"}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Page {cur + 1} of {pages}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
