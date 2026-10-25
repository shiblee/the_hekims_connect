"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, Pencil, Upload, MoreHorizontal, Languages, History, FileUp, Trash2, PenLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FloatingField } from "@/components/shared/floating-field";
import { BookFormDialog, type BookType } from "@/components/admin/books/book-form-dialog";
import { PdfUploadDialog } from "@/components/admin/books/pdf-upload-dialog";
import { ProcessingBadge, ReviewBadge, formatBytes } from "@/components/admin/books/status-badges";
import type { ProcessingStatus, ReviewStatus } from "@/lib/book-translation-core";
import { formatDate, formatDateTime } from "@/lib/utils";

interface PdfRow {
  id: string; pdfCode: string; title: string; currentVersion: number; createdAt: string;
  file: { version: number; originalFilename: string; fileSize: number; pageCount: number; createdAt: string } | null;
  translation: {
    processingStatus: ProcessingStatus; reviewStatus: ReviewStatus | null; latestVersion: number | null;
    outdated: boolean; approvedVersion: number | null; versionCount: number;
  };
}
interface BookDetail {
  id: string; bookCode: string; title: string; description: string | null; bookTypeId: string; active: boolean; createdAt: string; updatedAt: string;
  bookType: BookType; createdBy: { name: string } | null; pdfs: PdfRow[];
}

export default function AdminBookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replacing, setReplacing] = useState<PdfRow | null>(null);
  const [renaming, setRenaming] = useState<PdfRow | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<PdfRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get<{ book: BookDetail }>(`/api/admin/books/${id}`);
      setBook(res.book);
    } catch (err: any) { toast.error(err.message || "Could not load the book"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Keep statuses fresh while any PDF is being translated.
  const busy = book?.pdfs.some((p) => p.translation.processingStatus === "queued" || p.translation.processingStatus === "processing");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [busy, load]);

  const rename = async () => {
    if (!renaming || !newTitle.trim()) return;
    try {
      await adminApi.patch(`/api/admin/books/pdfs/${renaming.id}`, { title: newTitle });
      toast.success("PDF renamed"); setRenaming(null); load();
    } catch (err: any) { toast.error(err.message || "Could not rename"); }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/api/admin/books/pdfs/${deleting.id}`);
      toast.success("PDF deleted"); load();
    } catch (err: any) { toast.error(err.message || "Could not delete the PDF"); }
    finally { setDeleting(null); }
  };

  if (loading) return <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!book) return <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10 text-sm text-muted-foreground">Book not found. <Link href="/admin/books" className="text-primary hover:underline">Back to books</Link></div>;

  const totalPages = book.pdfs.reduce((n, p) => n + (p.file?.pageCount ?? 0), 0);
  const confirmed = book.pdfs.filter((p) => p.translation.approvedVersion).length;

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/books" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Books</Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary shrink-0" /> <span className="min-w-0 break-words">{book.title}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{book.bookCode}</span>
            <Badge variant="outline">{book.bookType.label}{book.bookType.active ? "" : " (switched off)"}</Badge>
            <Badge variant="outline" className={book.active ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : ""}>{book.active ? "Active" : "Inactive"}</Badge>
            <span>Added {formatDate(book.createdAt)}{book.createdBy ? ` by ${book.createdBy.name}` : ""}</span>
          </div>
          {book.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{book.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit book</Button>
          <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">PDFs</p><p className="text-2xl font-bold mt-1 tabular-nums">{book.pdfs.length}</p></Card>
        <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">Pages</p><p className="text-2xl font-bold mt-1 tabular-nums">{totalPages}</p></Card>
        <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">Confirmed translations</p><p className="text-2xl font-bold mt-1 tabular-nums">{confirmed} <span className="text-base font-normal text-muted-foreground">of {book.pdfs.length}</span></p></Card>
        <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">Last change</p><p className="text-base font-semibold mt-2">{formatDateTime(book.updatedAt)}</p></Card>
      </div>

      <Card id="pdfs" className="border-border/50 bg-card/60 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
          <h2 className="font-serif text-lg font-semibold">PDF documents</h2>
        </div>
        {book.pdfs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No PDFs yet. Upload the book's PDFs — one record per file.</p>
            <Button className="mt-4" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload PDF</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3">PDF</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3">Translation</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {book.pdfs.map((p) => {
                  const t = p.translation;
                  const ws = `/admin/books/pdfs/${p.id}`;
                  return (
                    <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors align-top">
                      <td className="px-4 py-3 min-w-56">
                        <Link href={ws} className="font-semibold hover:text-primary hover:underline">{p.title}</Link>
                        <span className="block font-mono text-xs text-muted-foreground">{p.pdfCode}</span>
                      </td>
                      <td className="px-4 py-3 max-w-64">
                        <span className="block truncate" title={p.file?.originalFilename}>{p.file?.originalFilename ?? "—"}</span>
                        <span className="block text-xs text-muted-foreground">{p.file?.pageCount ?? 0} pages{p.currentVersion > 1 ? ` · file v${p.currentVersion}` : ""}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.file ? formatDate(p.file.createdAt) : "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{p.file ? formatBytes(p.file.fileSize) : "—"}</td>
                      <td className="px-4 py-3">
                        <ProcessingBadge status={t.processingStatus} />
                        {t.latestVersion && <span className="block mt-1 text-xs text-muted-foreground">v{t.latestVersion}{t.versionCount > 1 ? ` · ${t.versionCount} versions` : ""}</span>}
                        {t.outdated && <span className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> made from an older file</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ReviewBadge status={t.reviewStatus} />
                        {t.approvedVersion && t.approvedVersion !== t.latestVersion && <span className="block mt-1 text-xs text-emerald-700 dark:text-emerald-400">v{t.approvedVersion} confirmed</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => router.push(ws)}>
                          <Languages className="h-4 w-4" /> {t.processingStatus === "not_started" ? "Translate" : "Open"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More actions for ${p.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(ws)}><Languages className="h-4 w-4" /> View PDF &amp; translation</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(`${ws}?history=1`)}><History className="h-4 w-4" /> Translation history</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setTimeout(() => { setRenaming(p); setNewTitle(p.title); }, 0)}><PenLine className="h-4 w-4" /> Rename</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setTimeout(() => setReplacing(p), 0)}><FileUp className="h-4 w-4" /> Replace file</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" disabled={!!t.approvedVersion} onSelect={() => setTimeout(() => setDeleting(p), 0)}>
                              <Trash2 className="h-4 w-4" /> {t.approvedVersion ? "Delete (kept — confirmed)" : "Delete PDF"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BookFormDialog open={editOpen} onOpenChange={setEditOpen} onSaved={load}
        book={{ id: book.id, title: book.title, description: book.description, bookTypeId: book.bookTypeId, active: book.active }} />
      <PdfUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} url={`/api/admin/books/${book.id}/pdfs`} onDone={load} />
      <PdfUploadDialog open={!!replacing} onOpenChange={(o) => !o && setReplacing(null)} url={`/api/admin/books/pdfs/${replacing?.id}/replace`} replacing={replacing?.title} onDone={load} />

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rename PDF</DialogTitle></DialogHeader>
          <div className="py-2"><FloatingField id="rename-pdf" label="PDF title" required maxLength={200} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(); }} /></div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={rename} disabled={!newTitle.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The PDF file{deleting && deleting.currentVersion > 1 ? "s (all versions)" : ""} and {deleting?.translation.versionCount ? `its ${deleting.translation.versionCount} draft translation${deleting.translation.versionCount === 1 ? "" : "s"}` : "everything about it"} will be removed permanently. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-border pt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
