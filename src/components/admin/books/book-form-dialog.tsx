"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingTextarea } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";

export interface BookType { id: string; label: string; active: boolean }
export interface BookFormValue { id?: string; title: string; description: string | null; bookTypeId: string; active: boolean }

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

/** Add / edit a book. Types come from Meta → Books → Book Type; switched-off types can't be newly chosen. */
export function BookFormDialog({ open, onOpenChange, book, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: BookFormValue | null;
  onSaved: (book: { id: string }) => void;
}) {
  const [types, setTypes] = useState<BookType[]>([]);
  const [form, setForm] = useState<BookFormValue>({ title: "", description: "", bookTypeId: "", active: true });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ title?: boolean; type?: boolean }>({});

  useEffect(() => {
    if (!open) return;
    setForm(book ? { ...book, description: book.description ?? "" } : { title: "", description: "", bookTypeId: "", active: true });
    setErrors({});
    adminApi.get<{ types: BookType[] }>("/api/admin/books/types").then((r) => setTypes(r.types)).catch(() => toast.error("Could not load book types"));
  }, [open, book]);

  // Active types, plus the book's own type even if it has since been switched off.
  const options = types
    .filter((t) => t.active || t.id === book?.bookTypeId)
    .map((t) => ({ value: t.id, label: t.active ? t.label : `${t.label} (switched off)` }));

  const save = async () => {
    const title = form.title.replace(/\s+/g, " ").trim();
    const next = { title: title.length < 2, type: !form.bookTypeId };
    setErrors(next);
    if (next.title) { toast.error("Enter the book title (at least 2 characters)"); return; }
    if (next.type) { toast.error("Choose the book type"); return; }
    setSaving(true);
    try {
      const body = { title, description: form.description ?? "", bookTypeId: form.bookTypeId, active: form.active };
      const res = book?.id
        ? await adminApi.patch<{ book: { id: string } }>(`/api/admin/books/${book.id}`, body)
        : await adminApi.post<{ book: { id: string } }>("/api/admin/books", body);
      toast.success(book?.id ? "Book updated" : "Book added");
      onOpenChange(false);
      onSaved(res.book);
    } catch (err: any) {
      toast.error(err.message || "Could not save the book");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{book?.id ? "Edit book" : "Add book"}</DialogTitle>
          <DialogDescription>{book?.id ? "Its PDFs and translations stay as they are." : "Add the book first, then upload its PDFs."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <FloatingField id="book-title" label="Book title" required maxLength={TITLE_MAX} error={errors.title}
            value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <FloatingCombobox id="book-type" label="Book type" required error={errors.type} value={form.bookTypeId}
            onValueChange={(v) => setForm((f) => ({ ...f, bookTypeId: v }))} options={options} placeholder="Select book type"
            emptyText="No book types — add them in Meta → Books" />
          <p className="-mt-2 text-xs text-muted-foreground">
            Types are managed in <Link href="/admin/meta/book_type" className="text-primary hover:underline">Meta → Books → Book Type</Link>.
          </p>
          <FloatingTextarea id="book-description" label="Description" maxLength={DESCRIPTION_MAX} rows={4}
            value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <label className="flex items-center justify-between gap-3 rounded-lg border border-input px-3.5 py-3">
            <span>
              <span className="block text-sm font-semibold">Active</span>
              <span className="block text-xs text-muted-foreground">Inactive books stay in the library with all their PDFs and history.</span>
            </span>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </label>
        </div>
        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {book?.id ? "Save" : "Add book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
