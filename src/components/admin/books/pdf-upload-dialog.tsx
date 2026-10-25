"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminUpload } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField } from "@/components/shared/floating-field";
import { formatBytes } from "@/components/admin/books/status-badges";

/** Upload a new PDF to a book (title + file), or replace an existing PDF's file (file only). */
export function PdfUploadDialog({ open, onOpenChange, url, replacing, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  /** Title of the PDF being replaced — switches the dialog to "replace" mode. */
  replacing?: string | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start clean every time the dialog closes.
  const close = (o: boolean) => {
    if (o) return onOpenChange(true);
    setTitle(""); setFile(null); setProgress(null);
    onOpenChange(false);
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { toast.error("Choose a PDF file"); return; }
    setFile(f);
    if (!replacing && !title.trim()) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
  };

  const submit = async () => {
    if (!replacing && !title.trim()) { toast.error("Enter the PDF title"); return; }
    if (!file) { toast.error("Choose the PDF file"); return; }
    const form = new FormData();
    if (!replacing) form.set("title", title.trim());
    form.set("file", file);
    setProgress(0);
    try {
      await adminUpload(url, form, setProgress);
      toast.success(replacing ? "File replaced — translate the new file when ready" : "PDF uploaded");
      close(false);
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
      setProgress(null);
    }
  };

  const busy = progress !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && close(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{replacing ? `Replace the file of “${replacing}”` : "Upload PDF"}</DialogTitle>
          <DialogDescription>
            {replacing
              ? "The current file and its translations are kept in history. The new file will need its own translation."
              : "Each PDF is its own document with its own translation. Typed and scanned PDFs both work."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!replacing && (
            <FloatingField id="pdf-title" label="PDF title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            className="w-full rounded-lg border-2 border-dashed border-input hover:border-primary/60 transition-colors px-4 py-8 text-center"
          >
            <FileUp className="mx-auto h-6 w-6 text-muted-foreground" />
            {file ? (
              <span className="mt-2 block text-sm font-semibold break-all">{file.name} <span className="font-normal text-muted-foreground">· {formatBytes(file.size)}</span></span>
            ) : (
              <span className="mt-2 block text-sm text-muted-foreground">Drop a PDF here, or click to choose one <span className="text-destructive">*</span></span>
            )}
          </button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          {busy && (
            <div className="space-y-1.5">
              <Progress value={Math.round((progress ?? 0) * 100)} />
              <p className="text-xs text-muted-foreground">{(progress ?? 0) < 1 ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : "Checking the PDF…"}</p>
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {replacing ? "Replace file" : "Upload"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
