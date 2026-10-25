"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Plus, Search, FileText, Pencil, Eye, MoreHorizontal, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookFormDialog, type BookType, type BookFormValue } from "@/components/admin/books/book-form-dialog";
import { formatDate } from "@/lib/utils";
import { sortByLabel } from "@/lib/sort-options";

interface BookRow {
  id: string; bookCode: string; title: string; description: string | null; bookTypeId: string; active: boolean; createdAt: string;
  bookType: BookType; createdBy: { id: string; name: string } | null; pdfCount: number; confirmedCount: number;
}

export default function AdminBooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<BookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookFormValue | null>(null);
  const [deleting, setDeleting] = useState<BookRow | null>(null);

  useEffect(() => {
    adminApi.get<{ types: BookType[] }>("/api/admin/books/types").then((r) => setTypes(r.types)).catch(() => {});
  }, []);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (typeId !== "all") params.set("typeId", typeId);
    if (status !== "all") params.set("status", status);
    try {
      const res = await adminApi.get<{ books: BookRow[]; total: number; pageSize: number }>(`/api/admin/books?${params}`);
      setBooks(res.books); setTotal(res.total); setPageSize(res.pageSize);
    } catch { toast.error("Could not load books"); }
    finally { setLoading(false); }
  }, [page, query, typeId, status]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/api/admin/books/${deleting.id}`);
      toast.success("Book deleted");
      load();
    } catch (err: any) { toast.error(err.message || "Could not delete the book"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Books
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Urdu books and their PDFs — translate each PDF into English, proofread it and confirm it.</p>
        </div>
        <Button size="lg" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add book</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, code or description" className="ps-9 bg-background/60" />
        </div>
        <Select value={typeId} onValueChange={(v) => { setTypeId(v); setPage(1); }}>
          <SelectTrigger className="w-56 bg-background/60"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {sortByLabel(types).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}{t.active ? "" : " (switched off)"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-background/60"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50 bg-card/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : books.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">{query || typeId !== "all" || status !== "all" ? "No books match this search." : "No books yet."}</p>
            {!query && typeId === "all" && status === "all" && (
              <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add the first book</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-center">PDFs</th>
                  <th className="px-4 py-3">Translation</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id} className="border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors align-top">
                    <td className="px-4 py-3 min-w-56">
                      <Link href={`/admin/books/${b.id}`} className="font-semibold hover:text-primary hover:underline">{b.title}</Link>
                      <span className="block font-mono text-xs text-muted-foreground">{b.bookCode}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.bookType.label}</td>
                    <td className="px-4 py-3 max-w-md text-muted-foreground"><span className="line-clamp-2">{b.description || "—"}</span></td>
                    <td className="px-4 py-3 text-center tabular-nums">{b.pdfCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {b.pdfCount ? <span className={b.confirmedCount === b.pdfCount ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-muted-foreground"}>{b.confirmedCount} of {b.pdfCount} confirmed</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(b.createdAt)}
                      <span className="block text-xs text-muted-foreground">{b.createdBy?.name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline" className={b.active ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>{b.active ? "Active" : "Inactive"}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${b.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => router.push(`/admin/books/${b.id}`)}><Eye className="h-4 w-4" /> View book</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(`/admin/books/${b.id}#pdfs`)}><FileText className="h-4 w-4" /> Manage PDFs &amp; translations</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => { setEditing({ id: b.id, title: b.title, description: b.description, bookTypeId: b.bookTypeId, active: b.active }); setTimeout(() => setFormOpen(true), 0); }}><Pencil className="h-4 w-4" /> Edit book</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" disabled={b.pdfCount > 0} onSelect={() => setTimeout(() => setDeleting(b), 0)}>
                            <Trash2 className="h-4 w-4" /> {b.pdfCount > 0 ? "Delete (remove its PDFs first)" : "Delete book"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{total} books · page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <BookFormDialog open={formOpen} onOpenChange={setFormOpen} book={editing}
        onSaved={(saved) => (editing ? load() : router.push(`/admin/books/${saved.id}`))} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This book has no PDFs. Deleting it can't be undone.</AlertDialogDescription>
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
