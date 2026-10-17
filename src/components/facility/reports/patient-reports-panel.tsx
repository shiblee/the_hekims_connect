"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { reportCategory } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { AddReportDialog } from "@/components/facility/reports/add-report-dialog";
import { ReportViewerDialog } from "@/components/facility/reports/report-viewer-dialog";
import { FolderOpen, Loader2, Paperclip, Plus } from "lucide-react";

interface ReportRow {
  id: string; category: string; title: string; reportDate: string | null; source: string | null;
  resultFlag: string; status: string; uploadedByName: string; createdAt: string;
  files: { id: string; mimeType: string }[];
}

/** The patient the current page is about: /facility/patients/<id>[/record], /facility/mizaj, /facility/asbab or /facility/tashkhees ?patientId=<id>. */
function useCurrentPatientId(): string | null {
  const pathname = usePathname();
  const params = useSearchParams();
  const m = pathname.match(/^\/facility\/patients\/([^/]+)/);
  if (m && m[1] !== "register") return m[1];
  if (["/facility/mizaj", "/facility/asbab", "/facility/tashkhees"].some((p) => pathname.startsWith(p))) return params.get("patientId");
  return null;
}

/**
 * Sidebar "Patient Reports" — every report clinic staff (reception, junior
 * or senior doctor) have added for the patient on screen. Unreviewed reports
 * are marked so the doctor sees at a glance what still needs looking at.
 */
export function PatientReportsPanel() {
  const patientId = useCurrentPatientId();
  // Tagged with the patient it belongs to, so switching patients never shows
  // the previous patient's list while the new one loads.
  const [loaded, setLoaded] = useState<{ patientId: string; reports: ReportRow[] } | null>(null);
  const reports = loaded && loaded.patientId === patientId ? loaded.reports : null;
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!patientId) return;
    api.get<{ reports: ReportRow[] }>(`/api/facility/patients/${patientId}/reports`)
      .then((r) => setLoaded({ patientId, reports: r.reports }))
      .catch(() => setLoaded({ patientId, reports: [] }));
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (!patientId) {
    return (
      <div className="mt-6 mx-3 rounded-xl border border-dashed border-sidebar-border p-3 text-center">
        <FolderOpen className="h-4 w-4 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-1.5">Open a patient to see and add their reports.</p>
      </div>
    );
  }

  const pending = reports?.filter((r) => r.status !== "reviewed").length ?? 0;

  return (
    <div className="mt-6 px-3">
      <div className="flex items-center justify-between gap-2 px-1 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          Patient Reports
          {reports && reports.length > 0 && <span className="rounded-full bg-sidebar-accent px-1.5 text-[10px] text-foreground normal-case tracking-normal">{reports.length}</span>}
        </p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdding(true)} aria-label="Add report">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {pending > 0 && (
        <p className="px-1 mb-2 text-[11px] text-amber-600 dark:text-amber-400">{pending} awaiting doctor review</p>
      )}

      {reports === null ? (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : reports.length === 0 ? (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-sidebar-border p-3 text-center hover:border-primary/40 transition-colors">
          <Paperclip className="h-4 w-4 mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground mt-1.5">No reports yet — add lab, imaging or other reports here.</p>
        </button>
      ) : (
        <div className="space-y-1.5">
          {reports.map((r) => {
            const cat = reportCategory(r.category);
            const unreviewed = r.status !== "reviewed";
            const flagged = r.resultFlag === "abnormal" || r.resultFlag === "critical";
            const date = r.reportDate || r.createdAt;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setViewing(r.id)}
                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
              >
                <span className={cn("relative h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cat.tint)}>
                  <cat.icon className="h-4 w-4" />
                  {unreviewed && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-sidebar" aria-label="Awaiting review" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={cn("block text-sm truncate", unreviewed ? "font-semibold" : "font-medium")}>{r.title}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })}
                    {r.files.length > 1 && ` · ${r.files.length} pages`}
                    {flagged && (
                      <span className={cn("font-semibold", r.resultFlag === "critical" ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                        {" · "}{r.resultFlag === "critical" ? "Critical" : "Abnormal"}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <AddReportDialog patientId={patientId} open={adding} onOpenChange={setAdding} onSaved={load} />
      <ReportViewerDialog
        reportIds={(reports || []).map((r) => r.id)}
        openId={viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        onChanged={load}
      />
    </div>
  );
}
