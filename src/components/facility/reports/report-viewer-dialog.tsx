"use client";

import { useEffect, useState } from "react";
import { InlineNotice, LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { reportCategory, resultFlag, type ReportExtraction } from "@/lib/reports";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ReportValuesTable } from "@/components/facility/reports/report-values-table";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Download, ExternalLink, FileText, Loader2, RotateCcw, Sparkles, Trash2, ZoomIn, ZoomOut,
} from "lucide-react";

interface ReportDetail {
  id: string; category: string; title: string; reportDate: string | null; source: string | null; resultFlag: string;
  findings: string | null; extraction: string | null; status: string; uploadedByName: string;
  reviewedByName: string | null; reviewedAt: string | null; reviewNote: string | null; createdAt: string;
  files: { id: string; fileName: string; mimeType: string; size: number }[];
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);

/**
 * Review a patient's reports one after another: the document on the left
 * (zoomable photo or embedded PDF, page thumbnails), details, Hakeem Insight
 * values and the review action on the right, with previous/next.
 */
export function ReportViewerDialog({ reportIds, openId, onOpenChange, onChanged }: {
  reportIds: string[];
  openId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [currentId, setCurrentId] = useState<string | null>(openId);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Delete asks for confirmation in place, not in a browser pop-up.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const msg = useNotice();

  useEffect(() => { if (openId) setCurrentId(openId); }, [openId]);

  // Load the report and its files (as blob URLs, since files need the auth header).
  useEffect(() => {
    if (!currentId || !openId) return;
    let cancelled = false;
    const urls: string[] = [];
    setReport(null); setFileUrls({}); setPage(0); setZoom(false); setNote(""); setLoadError(null); setConfirmDelete(false);
    api.get<{ report: ReportDetail }>(`/api/facility/reports/${currentId}`)
      .then(async ({ report: r }) => {
        if (cancelled) return;
        setReport(r);
        for (const f of r.files) {
          const blob = await api.blob(`/api/facility/reports/${r.id}/files/${f.id}`).catch(() => null);
          if (cancelled || !blob) continue;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setFileUrls((m) => ({ ...m, [f.id]: url }));
        }
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "Network error"); });
    return () => { cancelled = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [currentId, openId, reloadTick]);

  const idx = currentId ? reportIds.indexOf(currentId) : -1;
  const go = (d: -1 | 1) => { const next = reportIds[idx + d]; if (next) setCurrentId(next); };

  // Arrow keys move between reports while the viewer is open.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setStatus = async (status: "reviewed" | "pending_review") => {
    if (!report) return;
    setBusy(true);
    try {
      await api.patch(`/api/facility/reports/${report.id}`, { status, reviewNote: note });
      const { report: r } = await api.get<{ report: ReportDetail }>(`/api/facility/reports/${report.id}`);
      setReport(r);
      onChanged();
      if (status === "reviewed") {
        // "Mark as reviewed & next" — move straight on to the next report.
        const next = reportIds[idx + 1];
        msg.success(`"${r.title}" marked as reviewed`, next ? "Showing the next report." : "That was the last report in the list.");
        if (next) setCurrentId(next);
      } else {
        msg.info("Review reopened", "The report is back in the pending-review list.");
      }
    } catch (e: any) {
      msg.error(status === "reviewed" ? "The report wasn't marked as reviewed" : "The review wasn't reopened", `${e.message || "Network error"}. Try again.`, { retry: () => setStatus(status) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!report) return;
    setBusy(true);
    try {
      await api.delete(`/api/facility/reports/${report.id}`);
      setConfirmDelete(false);
      msg.success(`"${report.title}" deleted`);
      onChanged();
      const next = reportIds[idx + 1] || reportIds[idx - 1];
      if (next && next !== report.id) setCurrentId(next); else onOpenChange(false);
    } catch (e: any) {
      msg.error("The report wasn't deleted", `${e.message || "Network error"}. Try again.`, { retry: remove });
    } finally {
      setBusy(false);
    }
  };

  const extraction: ReportExtraction | null = (() => { try { return report?.extraction ? JSON.parse(report.extraction) : null; } catch { return null; } })();
  const file = report?.files[page];
  const url = file ? fileUrls[file.id] : undefined;
  const cat = report ? reportCategory(report.category) : null;
  const flag = report ? resultFlag(report.resultFlag) : null;

  return (
    <Dialog open={openId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="font-serif flex items-center gap-2 min-w-0">
              {cat && <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cat.tint)}><cat.icon className="h-4 w-4" /></span>}
              <span className="truncate">{report?.title || "Report"}</span>
            </DialogTitle>
            {reportIds.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Previous report"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-xs text-muted-foreground tabular-nums">{idx + 1} of {reportIds.length}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => go(1)} disabled={idx >= reportIds.length - 1} aria-label="Next report"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {!report ? (
          loadError
            ? <div className="p-4"><LoadFailed what="this report" detail={loadError} onRetry={() => setReloadTick((t) => t + 1)} /></div>
            : <div className="flex items-center gap-2 text-muted-foreground text-sm p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading report…</div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px]">
            {/* Document */}
            <div className="bg-muted/30 border-b lg:border-b-0 lg:border-r border-border/50 p-4 space-y-3 min-w-0">
              <div className={cn("relative rounded-lg bg-background/60 h-[58vh] overflow-auto flex", !zoom && "items-center justify-center")}>
                {!url ? (
                  <div className="m-auto flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading file…</div>
                ) : file!.mimeType === "application/pdf" ? (
                  <iframe src={url} title={file!.fileName} className="h-full w-full rounded-lg" />
                ) : (
                  <img
                    src={url} alt={file!.fileName}
                    onClick={() => setZoom((z) => !z)}
                    className={cn("cursor-zoom-in", zoom ? "max-w-none w-[180%] cursor-zoom-out" : "max-h-full max-w-full object-contain")}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2 overflow-x-auto">
                  {report.files.map((f, i) => (
                    <button key={f.id} type="button" onClick={() => { setPage(i); setZoom(false); }}
                      className={cn("h-14 w-11 shrink-0 rounded-md border overflow-hidden bg-background/60 flex items-center justify-center",
                        i === page ? "border-primary ring-1 ring-primary" : "border-border/50 hover:border-primary/40")}>
                      {f.mimeType.startsWith("image/") && fileUrls[f.id]
                              ? <img src={fileUrls[f.id]} alt="" className="h-full w-full object-cover" />
                        : <FileText className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  ))}
                </div>
                {url && (
                  <div className="flex items-center gap-1">
                    {file!.mimeType.startsWith("image/") && (
                      <Button size="sm" variant="ghost" onClick={() => setZoom((z) => !z)}>{zoom ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />} {zoom ? "Fit" : "Zoom"}</Button>
                    )}
                    <Button size="sm" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a></Button>
                    <Button size="sm" variant="ghost" asChild><a href={url} download={file!.fileName}><Download className="h-3.5 w-3.5" /> Download</a></Button>
                  </div>
                )}
              </div>
            </div>

            {/* Details & review */}
            <div className="p-5 space-y-4 min-w-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="font-normal">{cat?.label}</Badge>
                  {flag && report.resultFlag !== "unknown" && <Badge variant="outline" className={cn("font-medium", flag.className)}>{flag.label}</Badge>}
                  {report.status === "reviewed"
                    ? <Badge variant="outline" className="font-normal text-emerald-600 dark:text-emerald-400 border-emerald-500/40">Reviewed</Badge>
                    : <Badge variant="outline" className="font-normal text-amber-600 dark:text-amber-400 border-amber-500/40">Awaiting review</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {[fmtDate(report.reportDate), report.source].filter(Boolean).join(" · ") || "No date or lab recorded"}
                </p>
                <p className="text-xs text-muted-foreground">Added by {report.uploadedByName} · {fmtDate(report.createdAt)}</p>
              </div>

              {extraction && (extraction.summary || (extraction.values?.length ?? 0) > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Hakeem Insight reading</p>
                  {extraction.summary && <p className="text-sm">{extraction.summary}</p>}
                  {(extraction.values?.length ?? 0) > 0 && <ReportValuesTable values={extraction.values!} />}
                  <p className="text-[11px] text-muted-foreground">Transcribed from the document — the document itself is the source of truth.</p>
                </div>
              )}

              {report.findings && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key findings</p>
                  <p className="text-sm whitespace-pre-wrap">{report.findings}</p>
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
                {report.status === "reviewed" ? (
                  <>
                    <p className="text-sm flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Reviewed by {report.reviewedByName}{report.reviewedAt && ` · ${fmtDate(report.reviewedAt)}`}</p>
                    {report.reviewNote && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.reviewNote}</p>}
                    <Button size="sm" variant="ghost" onClick={() => setStatus("pending_review")} disabled={busy}><RotateCcw className="h-3.5 w-3.5" /> Mark as not reviewed</Button>
                  </>
                ) : (
                  <>
                    <Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (optional)" className="min-h-[60px] bg-background/60" />
                    <Button size="sm" className="w-full" onClick={() => setStatus("reviewed")} disabled={busy}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark as reviewed{idx < reportIds.length - 1 ? " & next" : ""}
                    </Button>
                  </>
                )}
              </div>

              <NoticeSlot state={msg} />
              {confirmDelete ? (
                <InlineNotice
                  tone="error"
                  title={`Delete "${report.title}"?`}
                  detail="The report and all its files are removed for everyone. This can't be undone."
                  action={
                    <div className="flex flex-col gap-1.5">
                      <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep</Button>
                    </div>
                  }
                />
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Delete report
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
