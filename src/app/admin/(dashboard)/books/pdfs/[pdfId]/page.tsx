"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Languages, Loader2, RefreshCw, CheckCircle2, History, Save, Eye, PenLine, AlertTriangle,
  RotateCcw, MoreHorizontal, FilePlus2, MessageSquareWarning, Columns2, FileText, ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi, adminFetchBlob } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PdfViewer } from "@/components/admin/books/pdf-viewer";
import { TranslationText } from "@/components/admin/books/translation-text";
import { ProcessingBadge, ReviewBadge } from "@/components/admin/books/status-badges";
import type { ProcessingStatus, ReviewStatus } from "@/lib/book-translation-core";
import { cn, formatDateTime } from "@/lib/utils";

type Who = { id: string; name: string } | null;
interface VersionRow {
  id: string; versionNumber: number; sourceVersion: number; method: string; basedOnVersion: number | null; modelIdentifier: string | null;
  instructions: string | null; processingStatus: ProcessingStatus; reviewStatus: ReviewStatus; reviewNote: string | null; errorMessage: string | null;
  createdAt: string; generatedAt: string | null; editedAt: string | null; confirmedAt: string | null;
  createdBy: Who; editedBy: Who; confirmedBy: Who;
  pagesTotal: number; pagesDone: number; pagesFailed: number; pagesEdited: number;
}
interface PdfDetail {
  id: string; pdfCode: string; title: string; currentVersion: number;
  book: { id: string; title: string; bookCode: string };
  files: { version: number; originalFilename: string; fileSize: number; pageCount: number; createdAt: string; uploadedBy: Who }[];
  translations: VersionRow[];
}
interface PageRow { pageNumber: number; status: "pending" | "done" | "failed"; generatedText: string | null; reviewedText: string | null; error: string | null }
interface TranslationDetail extends Omit<VersionRow, "pagesTotal" | "pagesDone" | "pagesFailed" | "pagesEdited"> { pages: PageRow[] }
interface Checks { totalPages: number; missingPages: number[]; missingLabel: string; markers: number }

const isRunning = (s?: string) => s === "queued" || s === "processing";

export default function TranslationWorkspacePage() {
  const { pdfId } = useParams<{ pdfId: string }>();
  const search = useSearchParams();
  const [pdf, setPdf] = useState<PdfDetail | null>(null);
  const [ai, setAi] = useState<{ ok: boolean; reason: string | null }>({ ok: false, reason: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trans, setTrans] = useState<TranslationDetail | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileVersion, setFileVersion] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [view, setView] = useState<"page" | "all">("page");
  const [mobileTab, setMobileTab] = useState<"original" | "english">("original");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(search.get("history") === "1");
  const [regenOpen, setRegenOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);

  const dirtyCount = Object.keys(drafts).length;

  const loadPdf = useCallback(async () => {
    const res = await adminApi.get<{ pdf: PdfDetail; ai: { ok: boolean; reason: string | null } }>(`/api/admin/books/pdfs/${pdfId}`);
    setPdf(res.pdf); setAi(res.ai);
    setSelectedId((cur) => cur ?? res.pdf.translations[0]?.id ?? null);
    return res.pdf;
  }, [pdfId]);

  const loadTranslation = useCallback(async (id: string) => {
    const res = await adminApi.get<{ translation: TranslationDetail; checks: Checks }>(`/api/admin/books/translations/${id}`);
    setTrans(res.translation); setChecks(res.checks);
    return res.translation;
  }, []);

  useEffect(() => {
    loadPdf().catch((err) => toast.error(err.message || "Could not load the PDF")).finally(() => setLoading(false));
  }, [loadPdf]);

  useEffect(() => {
    if (!selectedId) { setTrans(null); setChecks(null); return; }
    loadTranslation(selectedId).catch((err) => toast.error(err.message || "Could not load the translation"));
  }, [selectedId, loadTranslation]);

  // The original file the selected version was made from (older versions keep their own file).
  const wantedFile = trans?.sourceVersion ?? pdf?.currentVersion ?? null;
  useEffect(() => {
    if (!wantedFile || wantedFile === fileVersion) return;
    setFileData(null);
    adminFetchBlob(`/api/admin/books/pdfs/${pdfId}/file?version=${wantedFile}`)
      .then((b) => b.arrayBuffer())
      .then((buf) => { setFileData(buf); setFileVersion(wantedFile); })
      .catch((err) => toast.error(err.message || "Could not load the PDF file"));
  }, [wantedFile, fileVersion, pdfId]);

  // Follow progress while Gemini is working.
  useEffect(() => {
    if (!trans || !isRunning(trans.processingStatus)) return;
    const t = setInterval(async () => {
      try {
        const next = await loadTranslation(trans.id);
        if (!isRunning(next.processingStatus)) {
          await loadPdf();
          if (next.processingStatus === "generated") toast.success("Translation ready for review");
          else toast.warning(next.errorMessage || "The translation finished with problems");
        }
      } catch { /* try again on the next tick */ }
    }, 3000);
    return () => clearInterval(t);
  }, [trans?.id, trans?.processingStatus, loadTranslation, loadPdf]);

  // Unsaved proofreading: warn before leaving the page.
  useEffect(() => {
    if (!dirtyCount) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyCount]);

  const version = pdf?.translations.find((t) => t.id === selectedId) ?? null;
  const currentFile = pdf?.files.find((f) => f.version === pdf.currentVersion);
  const pageCount = trans?.pages.length || currentFile?.pageCount || 0;
  const pageRow = trans?.pages.find((p) => p.pageNumber === page) ?? null;
  const textOf = (p: PageRow) => drafts[p.pageNumber] ?? p.reviewedText ?? p.generatedText ?? "";
  const running = isRunning(trans?.processingStatus);
  const confirmed = trans?.reviewStatus === "confirmed";
  const outdated = !!trans && !!pdf && trans.sourceVersion !== pdf.currentVersion;
  const readOnly = !trans || running || confirmed;
  const done = trans?.pages.filter((p) => p.status === "done").length ?? 0;
  const anyActive = pdf?.translations.some((t) => isRunning(t.processingStatus));
  const hasEdits = (version?.pagesEdited ?? 0) > 0 || dirtyCount > 0;

  const switchVersion = (id: string) => {
    if (id === selectedId) return;
    if (dirtyCount && !window.confirm("You have unsaved proofreading. Switch version and lose it?")) return;
    setDrafts({}); setMode("preview"); setSelectedId(id);
  };

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (err: any) { toast.error(err.message || "Something went wrong"); }
    finally { setBusy(null); }
  };

  const startTranslation = () => act("translate", async () => {
    const res = await adminApi.post<{ translation: { id: string } }>(`/api/admin/books/pdfs/${pdfId}/translations`, { instructions: instructions.trim() || null });
    setRegenOpen(false); setInstructions(""); setDrafts({}); setMode("preview");
    await loadPdf();
    setSelectedId(res.translation.id);
    toast.success("Translation started — pages appear as they are done");
  });

  const saveDraft = () => act("save", async () => {
    if (!trans) return;
    const pages = Object.entries(drafts).map(([n, text]) => ({ pageNumber: Number(n), text }));
    await adminApi.patch(`/api/admin/books/translations/${trans.id}`, { pages });
    setDrafts({});
    await Promise.all([loadTranslation(trans.id), loadPdf()]);
    toast.success("Draft saved");
  });

  const runAction = (action: string, body: Record<string, unknown> = {}, message?: string) => act(action, async () => {
    if (!trans) return;
    const res = await adminApi.post<{ translation?: { id: string } }>(`/api/admin/books/translations/${trans.id}/action`, { action, ...body });
    await loadPdf();
    if (res.translation) { setDrafts({}); setSelectedId(res.translation.id); }
    else await loadTranslation(trans.id);
    if (message) toast.success(message);
  });

  const openConfirm = async () => {
    if (dirtyCount) { toast.error("Save your proofreading first"); return; }
    if (trans) await loadTranslation(trans.id);
    setAcceptWarnings(false); setConfirmOpen(true);
  };

  const doConfirm = async () => {
    await runAction("confirm", { acceptWarnings }, "Translation confirmed");
    setConfirmOpen(false); setMode("preview");
  };

  const pageNav = useMemo(() => trans?.pages.map((p) => p.status) ?? [], [trans]);

  if (loading) return <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!pdf) return <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10 text-sm text-muted-foreground">PDF not found. <Link href="/admin/books" className="text-primary hover:underline">Back to books</Link></div>;

  const englishPanel = (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card/60 overflow-hidden min-h-[60vh]">
      {/* Panel toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">English</span>
          {trans && <span className="text-muted-foreground">· {view === "page" ? `page ${page}` : "all pages"}</span>}
        </div>
        {trans && (
          <div className="flex flex-wrap items-center gap-1">
            <Tabs value={view} onValueChange={(v) => setView(v as "page" | "all")}>
              <TabsList className="h-8">
                <TabsTrigger value="page" className="text-xs px-2"><FileText className="h-3.5 w-3.5" /> This page</TabsTrigger>
                <TabsTrigger value="all" className="text-xs px-2"><ScrollText className="h-3.5 w-3.5" /> All pages</TabsTrigger>
              </TabsList>
            </Tabs>
            {!readOnly && view === "page" && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as "preview" | "edit")}>
                <TabsList className="h-8">
                  <TabsTrigger value="preview" className="text-xs px-2"><Eye className="h-3.5 w-3.5" /> Read</TabsTrigger>
                  <TabsTrigger value="edit" className="text-xs px-2"><PenLine className="h-3.5 w-3.5" /> Proofread</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!trans ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
            <Languages className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">English translation is not available yet. Click <strong>Translate to English</strong> to generate the translation.</p>
            <Button size="lg" onClick={startTranslation} disabled={!ai.ok || busy === "translate"}>
              {busy === "translate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />} Translate to English
            </Button>
            {!ai.ok && ai.reason && <p className="max-w-sm text-xs text-amber-700 dark:text-amber-400">{ai.reason}</p>}
            {currentFile && <p className="text-xs text-muted-foreground">{currentFile.pageCount} pages · sent to Gemini a few pages at a time</p>}
          </div>
        ) : view === "all" ? (
          <div className="space-y-6">
            {trans.pages.map((p) => (
              <section key={p.pageNumber}>
                <button type="button" onClick={() => { setPage(p.pageNumber); setView("page"); }} className="mb-2 flex w-full items-center gap-2 border-b border-border/50 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary">
                  Page {p.pageNumber} {p.reviewedText !== null || drafts[p.pageNumber] !== undefined ? <Badge variant="outline" className="text-[10px]">proofread</Badge> : null}
                </button>
                {textOf(p) ? <TranslationText text={textOf(p)} /> : <PageStatusNote page={p} running={running} />}
              </section>
            ))}
          </div>
        ) : !pageRow ? (
          <p className="text-sm text-muted-foreground">This version has no page {page}.</p>
        ) : mode === "edit" && !readOnly ? (
          <div className="flex h-full flex-col gap-2">
            <Textarea
              aria-label={`English translation of page ${page}`}
              dir="ltr"
              value={textOf(pageRow)}
              onChange={(e) => {
                const v = e.target.value;
                setDrafts((d) => {
                  const original = pageRow.reviewedText ?? pageRow.generatedText ?? "";
                  const next = { ...d };
                  if (v === original) delete next[page]; else next[page] = v;
                  return next;
                });
              }}
              className="min-h-[50vh] flex-1 font-mono text-sm leading-relaxed"
              placeholder={pageRow.status === "done" ? "" : "This page has no translation yet — you can type it in."}
            />
            <p className="text-xs text-muted-foreground"># heading · - list · | table | — Markdown. [unreadable] and [uncertain: …] are shown in bold for review.</p>
            {pageRow.reviewedText !== null && pageRow.generatedText && (
              <button type="button" className="self-start text-xs text-primary hover:underline" onClick={() => setDrafts((d) => ({ ...d, [page]: pageRow.generatedText! }))}>
                Restore Gemini&apos;s original text for this page
              </button>
            )}
          </div>
        ) : textOf(pageRow) ? (
          <TranslationText text={textOf(pageRow)} />
        ) : (
          <PageStatusNote page={pageRow} running={running} />
        )}
      </div>

      {/* Review actions — Save on the right */}
      {trans && !confirmed && !running && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setRegenOpen(true)} disabled={!ai.ok || !!anyActive}><RefreshCw className="h-4 w-4" /> Regenerate</Button>
            <Button variant="outline" onClick={openConfirm} disabled={outdated || !!busy}><CheckCircle2 className="h-4 w-4" /> Confirm translation</Button>
          </div>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{dirtyCount} unsaved page{dirtyCount === 1 ? "" : "s"}</span>}
            <Button onClick={saveDraft} disabled={!dirtyCount || busy === "save"}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft</Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-8">
      <Link href={`/admin/books/${pdf.book.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> {pdf.book.title}</Link>

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold tracking-tight break-words">{pdf.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{pdf.pdfCode}</span>
            <span className="truncate max-w-72" title={currentFile?.originalFilename}>{currentFile?.originalFilename}</span>
            <span>· {currentFile?.pageCount} pages{pdf.currentVersion > 1 ? ` · file v${pdf.currentVersion}` : ""}</span>
            {trans && <><ProcessingBadge status={trans.processingStatus} /><ReviewBadge status={trans.reviewStatus} /></>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pdf.translations.length > 0 && (
            <Select value={selectedId ?? undefined} onValueChange={switchVersion}>
              <SelectTrigger className="w-56 bg-background/60" aria-label="Translation version"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pdf.translations.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Version {t.versionNumber} · {t.reviewStatus === "confirmed" ? "Confirmed" : isRunning(t.processingStatus) ? "Translating" : formatDateTime(t.createdAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /> History</Button>
          {trans && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!ai.ok || !!anyActive} onSelect={() => setTimeout(() => setRegenOpen(true), 0)}><RefreshCw className="h-4 w-4" /> Regenerate from the PDF</DropdownMenuItem>
                <DropdownMenuItem disabled={outdated || running || !!anyActive} onSelect={() => runAction("new_draft", {}, "New draft started")}><FilePlus2 className="h-4 w-4" /> New draft from this version</DropdownMenuItem>
                <DropdownMenuItem disabled={confirmed || running} onSelect={() => setTimeout(() => { setChangesNote(trans.reviewNote ?? ""); setChangesOpen(true); }, 0)}><MessageSquareWarning className="h-4 w-4" /> Mark changes required</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={pdf.translations.length < 2} onSelect={() => setTimeout(() => setCompare({ a: pdf.translations[1]?.id ?? "", b: trans.id }), 0)}><Columns2 className="h-4 w-4" /> Compare versions</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Banners */}
      {trans && running && (
        <Card className="mb-4 gap-2 border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin" /> {trans.processingStatus === "queued" ? "Waiting to start…" : "Translating with Gemini…"}</span>
            <span className="tabular-nums text-muted-foreground">{done} of {trans.pages.length} pages</span>
          </div>
          <Progress value={trans.pages.length ? (done / trans.pages.length) * 100 : 0} />
          <p className="text-xs text-muted-foreground">You can leave this page — the work carries on and is saved page by page.</p>
        </Card>
      )}
      {trans && !running && trans.errorMessage && (
        <Card className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/5 p-4">
          <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {trans.errorMessage}</p>
          {trans.method === "gemini" && !confirmed && trans.pages.some((p) => p.status !== "done") && (
            <Button variant="outline" size="sm" onClick={() => runAction("retry", {}, "Retrying the missing pages")} disabled={!ai.ok || busy === "retry" || !!anyActive}>
              {busy === "retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retry missing pages
            </Button>
          )}
        </Card>
      )}
      {outdated && (
        <Card className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">This version was made from file v{trans!.sourceVersion}; the PDF has since been replaced (now v{pdf.currentVersion}). It is kept for the record — translate the new file to continue.</p>
          <Button size="sm" onClick={startTranslation} disabled={!ai.ok || !!anyActive}><Languages className="h-4 w-4" /> Translate the new file</Button>
        </Card>
      )}
      {trans?.reviewStatus === "changes_required" && (
        <Card className="mb-4 gap-1 border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Changes required</p>
          {trans.reviewNote && <p className="whitespace-pre-line text-amber-800 dark:text-amber-300">{trans.reviewNote}</p>}
        </Card>
      )}
      {confirmed && (
        <Card className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Confirmed{trans!.confirmedBy ? ` by ${trans!.confirmedBy.name}` : ""}{trans!.confirmedAt ? ` on ${formatDateTime(trans!.confirmedAt)}` : ""} — read only.
          </p>
          {!outdated && <Button variant="outline" size="sm" onClick={() => runAction("new_draft", {}, "New draft started")} disabled={!!busy || !!anyActive}><FilePlus2 className="h-4 w-4" /> Make changes in a new draft</Button>}
        </Card>
      )}
      {!ai.ok && ai.reason && trans && !confirmed && (
        <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">{ai.reason} Proofreading and confirming still work.</p>
      )}

      {/* Page strip: where each page stands */}
      {trans && pageNav.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1" aria-label="Pages">
          {pageNav.map((s, i) => {
            const n = i + 1;
            const edited = drafts[n] !== undefined || trans.pages[i].reviewedText !== null;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                title={`Page ${n}: ${s === "done" ? (edited ? "proofread" : "translated") : s === "failed" ? "failed" : "waiting"}`}
                className={cn(
                  "h-6 min-w-6 rounded px-1 text-[11px] tabular-nums border transition-colors",
                  n === page ? "border-primary bg-primary text-primary-foreground" :
                  s === "failed" ? "border-destructive/50 text-destructive" :
                  s === "pending" ? "border-dashed border-border text-muted-foreground" :
                  edited ? "border-sky-500/50 text-sky-700 dark:text-sky-400" : "border-border text-foreground",
                )}
              >{n}</button>
            );
          })}
        </div>
      )}

      {/* Mobile: tabs; desktop: side by side */}
      <div className="lg:hidden mb-3">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "original" | "english")}>
          <TabsList className="w-full">
            <TabsTrigger value="original" className="flex-1">Original Urdu</TabsTrigger>
            <TabsTrigger value="english" className="flex-1">English</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(mobileTab !== "original" && "hidden lg:block")}>
          <PdfViewer data={fileData} page={page} onPageChange={setPage} className="lg:sticky lg:top-36 lg:h-[calc(100vh-10rem)]" />
        </div>
        <div className={cn(mobileTab !== "english" && "hidden lg:block")}>{englishPanel}</div>
      </div>

      {/* Regenerate */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{trans ? "Regenerate the translation?" : "Translate to English"}</DialogTitle>
            <DialogDescription>
              Gemini translates the original Urdu PDF again into a new version (v{(pdf.translations[0]?.versionNumber ?? 0) + 1}). Every earlier version stays in history.
            </DialogDescription>
          </DialogHeader>
          {hasEdits && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> This version has proofreading. It is kept in version {trans?.versionNumber}, but the new version starts from Gemini&apos;s text again.{dirtyCount ? " Unsaved edits will be lost — save them first." : ""}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="regen-instructions" className="text-sm font-semibold">Anything to do differently? <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Textarea id="regen-instructions" value={instructions} maxLength={1000} onChange={(e) => setInstructions(e.target.value)} rows={3}
              placeholder="e.g. Follow a more literal style. Keep Unani terms in transliteration." />
            <div className="flex flex-wrap gap-1.5">
              {["Improve translation accuracy.", "Preserve technical terminology.", "Improve grammar and readability.", "Follow a more literal translation style."].map((s) => (
                <button key={s} type="button" onClick={() => setInstructions((v) => (v.includes(s) ? v : `${v} ${s}`.trim()))} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary hover:text-primary">{s.replace(/\.$/, "")}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">These never override the rule to keep the original meaning.</p>
          </div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button onClick={startTranslation} disabled={busy === "translate" || dirtyCount > 0}>{busy === "translate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm version {trans?.versionNumber}?</DialogTitle>
            <DialogDescription>The English translation becomes the approved version and is locked. Later changes go into a new draft.</DialogDescription>
          </DialogHeader>
          {checks && (checks.missingPages.length > 0 || checks.markers > 0) ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                {checks.missingPages.length > 0 && <p className="flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {checks.missingPages.length} of {checks.totalPages} pages {checks.missingPages.length === 1 ? "has" : "have"} no English: {checks.missingLabel}.</p>}
                {checks.markers > 0 && <p className="flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {checks.markers} passage{checks.markers === 1 ? " is" : "s are"} still marked [unreadable] or [uncertain].</p>}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={acceptWarnings} onCheckedChange={(v) => setAcceptWarnings(v === true)} className="mt-0.5" />
                I&apos;ve checked this and want to confirm it as it is.
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">All {checks?.totalPages} pages have English and nothing is marked for review.</p>
          )}
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={doConfirm} disabled={busy === "confirm" || (!!checks && (checks.missingPages.length > 0 || checks.markers > 0) && !acceptWarnings) || checks?.missingPages.length === checks?.totalPages}>
              {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm translation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Changes required */}
      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark changes required</DialogTitle>
            <DialogDescription>Flags this version for more work. The note is shown to whoever proofreads it next.</DialogDescription>
          </DialogHeader>
          <Textarea value={changesNote} onChange={(e) => setChangesNote(e.target.value)} maxLength={1000} rows={4} placeholder="What needs changing?" />
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setChangesOpen(false)}>Cancel</Button>
            <Button onClick={async () => { await runAction("changes_required", { note: changesNote }, "Marked as changes required"); setChangesOpen(false); }} disabled={busy === "changes_required"}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Translation history</SheetTitle>
            <SheetDescription>Every version is kept. Confirmed versions are never changed.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {pdf.translations.length === 0 && <p className="text-sm text-muted-foreground">No translations yet.</p>}
            {pdf.translations.map((t) => (
              <Card key={t.id} className={cn("gap-2 p-4 border-border/60", t.id === selectedId && "border-primary/60")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Version {t.versionNumber}</p>
                  <div className="flex gap-1.5"><ProcessingBadge status={t.processingStatus} /><ReviewBadge status={t.reviewStatus} /></div>
                </div>
                <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">Made</dt><dd>{formatDateTime(t.createdAt)}{t.createdBy ? ` · ${t.createdBy.name}` : ""}</dd>
                  <dt className="text-muted-foreground">How</dt><dd>{t.method === "copy" ? `Draft copied from v${t.basedOnVersion}` : `Gemini (${t.modelIdentifier ?? "—"})`} · from file v{t.sourceVersion}{t.sourceVersion !== pdf.currentVersion ? " (older file)" : ""}</dd>
                  <dt className="text-muted-foreground">Pages</dt><dd>{t.pagesDone} of {t.pagesTotal} translated{t.pagesFailed ? `, ${t.pagesFailed} failed` : ""}{t.pagesEdited ? `, ${t.pagesEdited} proofread` : ""}</dd>
                  {t.editedAt && <><dt className="text-muted-foreground">Edited</dt><dd>{formatDateTime(t.editedAt)}{t.editedBy ? ` · ${t.editedBy.name}` : ""}</dd></>}
                  {t.confirmedAt && <><dt className="text-muted-foreground">Confirmed</dt><dd>{formatDateTime(t.confirmedAt)}{t.confirmedBy ? ` · ${t.confirmedBy.name}` : ""}</dd></>}
                  {t.instructions && <><dt className="text-muted-foreground">Style</dt><dd className="whitespace-pre-line">{t.instructions}</dd></>}
                </dl>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant={t.id === selectedId ? "secondary" : "outline"} onClick={() => { switchVersion(t.id); setHistoryOpen(false); }}>{t.id === selectedId ? "Showing" : "Open"}</Button>
                  {pdf.translations.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => { setCompare({ a: t.id, b: (t.id === pdf.translations[0].id ? pdf.translations[1] : pdf.translations[0]).id }); setHistoryOpen(false); }}><Columns2 className="h-4 w-4" /> Compare</Button>
                  )}
                </div>
              </Card>
            ))}
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Files</p>
              {pdf.files.map((f) => (
                <p key={f.version} className="text-xs text-muted-foreground">v{f.version}{f.version === pdf.currentVersion ? " (current)" : ""} · {f.originalFilename} · {f.pageCount} pages · {formatDateTime(f.createdAt)}{f.uploadedBy ? ` · ${f.uploadedBy.name}` : ""}</p>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {compare && <CompareDialog versions={pdf.translations} initial={compare} page={page} onClose={() => setCompare(null)} />}
    </div>
  );
}

function PageStatusNote({ page, running }: { page: PageRow; running: boolean }) {
  if (page.status === "failed") return <p className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Page {page.pageNumber} could not be translated{page.error ? `: ${page.error}` : "."}</p>;
  if (page.status === "pending") return <p className="flex items-center gap-2 text-sm text-muted-foreground">{running && <Loader2 className="h-4 w-4 animate-spin" />} Page {page.pageNumber} {running ? "is waiting to be translated…" : "has not been translated."}{page.error && !running ? ` (${page.error})` : ""}</p>;
  return <p className="text-sm text-muted-foreground">Page {page.pageNumber} is empty.</p>;
}

/** Two versions side by side, page by page. */
function CompareDialog({ versions, initial, page: startPage, onClose }: { versions: VersionRow[]; initial: { a: string; b: string }; page: number; onClose: () => void }) {
  const [a, setA] = useState(initial.a);
  const [b, setB] = useState(initial.b);
  const [page, setPage] = useState(startPage);
  const [data, setData] = useState<Record<string, TranslationDetail>>({});

  useEffect(() => {
    for (const id of [a, b]) {
      if (!id || data[id]) continue;
      adminApi.get<{ translation: TranslationDetail }>(`/api/admin/books/translations/${id}`)
        .then((r) => setData((d) => ({ ...d, [id]: r.translation })))
        .catch(() => toast.error("Could not load that version"));
    }
  }, [a, b, data]);

  const pages = Math.max(data[a]?.pages.length ?? 0, data[b]?.pages.length ?? 0);
  const textFor = (id: string) => {
    const p = data[id]?.pages.find((x) => x.pageNumber === page);
    return p ? p.reviewedText ?? p.generatedText ?? "" : "";
  };
  const same = !!data[a] && !!data[b] && textFor(a).trim() === textFor(b).trim();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare versions</DialogTitle>
          <DialogDescription>Page by page, proofread text where there is any.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm tabular-nums">Page {page} of {pages || "…"}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          {same && <Badge variant="outline" className="ms-2">Same text on this page</Badge>}
        </div>
        <div className="grid flex-1 gap-4 overflow-auto md:grid-cols-2">
          {[[a, setA], [b, setB]].map(([id, set], i) => (
            <div key={i} className="flex min-h-0 flex-col gap-2">
              <Select value={id as string} onValueChange={set as (v: string) => void}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => <SelectItem key={v.id} value={v.id}>Version {v.versionNumber}{v.reviewStatus === "confirmed" ? " · Confirmed" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex-1 overflow-auto rounded-lg border border-border/60 p-3">
                {!data[id as string] ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : textFor(id as string) ? <TranslationText text={textFor(id as string)} /> : <p className="text-sm text-muted-foreground">No text on this page.</p>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
