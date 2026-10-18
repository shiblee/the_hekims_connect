"use client";

import { useEffect, useRef, useState } from "react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  REPORT_CATEGORIES, RESULT_FLAGS, REPORT_FILE_TYPES, REPORT_MAX_FILE_BYTES, REPORT_MAX_FILES,
  type ReportExtraction,
} from "@/lib/reports";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { ReportValuesTable } from "@/components/facility/reports/report-values-table";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";

interface Picked { id: string; file: File; preview: string | null }

/** Photos are shrunk on the device (long edge 2000px, JPEG) so uploads stay quick and the database small. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 700 * 1024) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { category: "", title: "", reportDate: "", source: "", resultFlag: "unknown", findings: "" };

export function AddReportDialog({ patientId, open, onOpenChange, onSaved }: {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [files, setFiles] = useState<Picked[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [extraction, setExtraction] = useState<ReportExtraction | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Preview object URLs are freed when a file is removed, when the dialog
  // reopens, and on unmount — tracked in a ref so adding files never frees
  // previews that are still on screen.
  const previewsRef = useRef<Picked[]>([]);
  previewsRef.current = files;
  const freePreviews = (list: Picked[]) => list.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
  useEffect(() => () => freePreviews(previewsRef.current), []);

  // `fileMsg` sits under the file picker, `readMsg` under the Read button, `msg` above Save.
  const fileMsg = useNotice();
  const readMsg = useNotice(10000);
  const msg = useNotice();

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    freePreviews(previewsRef.current);
    setForm({ ...EMPTY, reportDate: today() });
    setExtraction(null);
    setFiles([]);
    fileMsg.clear(); readMsg.clear(); msg.clear();
  }, [open]);

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const addFiles = async (list: FileList | File[]) => {
    const incoming = [...list];
    const rejected = incoming.filter((f) => !REPORT_FILE_TYPES.includes(f.type));
    const ok = await Promise.all(incoming.filter((f) => REPORT_FILE_TYPES.includes(f.type)).map(compressImage));
    const tooBig = ok.filter((f) => f.size > REPORT_MAX_FILE_BYTES);
    const accepted = ok.filter((f) => f.size <= REPORT_MAX_FILE_BYTES);
    const room = REPORT_MAX_FILES - files.length;
    // One message listing everything that was left out, and why.
    const skipped = [
      rejected.length && `Not a photo or PDF: ${rejected.map((f) => f.name).join(", ")}`,
      tooBig.length && `Larger than 8 MB: ${tooBig.map((f) => f.name).join(", ")}`,
      accepted.length > room && `Over the ${REPORT_MAX_FILES}-file limit: ${accepted.slice(Math.max(0, room)).map((f) => f.name).join(", ")}`,
    ].filter(Boolean) as string[];
    if (skipped.length) {
      fileMsg.warning(
        "Some files weren't added",
        <ul className="list-disc pl-4 space-y-0.5">{skipped.map((s) => <li key={s}>{s}</li>)}</ul>,
      );
    } else {
      fileMsg.clear();
    }
    setFiles((cur) => {
      const space = REPORT_MAX_FILES - cur.length;
      return [...cur, ...accepted.slice(0, Math.max(0, space)).map((file) => ({
        id: `${file.name}-${file.size}-${Math.random()}`, file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      }))];
    });
  };

  const removeFile = (id: string) => setFiles((cur) => {
    freePreviews(cur.filter((f) => f.id === id));
    return cur.filter((f) => f.id !== id);
  });

  const read = async () => {
    if (!files.length) return;
    readMsg.clear();
    setReading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f.file));
      const { reading: r } = await api.upload<{ reading: any }>("/api/facility/reports/read", fd);
      // Only fill what the document actually showed; keep anything already typed.
      setForm((f) => ({
        category: r.category || f.category,
        title: r.title || f.title,
        reportDate: r.reportDate || f.reportDate,
        source: r.source || f.source,
        resultFlag: r.resultFlag && r.resultFlag !== "unknown" ? r.resultFlag : f.resultFlag,
        findings: f.findings,
      }));
      setExtraction({ summary: r.summary || undefined, values: r.values || [] });
      readMsg.success(
        r.values?.length ? `Read ${r.values.length} values from the report` : "Report read",
        "The details below were filled in — check them against the report before saving.",
      );
    } catch (e: any) {
      readMsg.error("Hakeem Insight couldn't read this report", `${e.message || "Network error"}. You can still fill in the details yourself and save.`, { retry: read, retryLabel: "Read again" });
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    const missing = [
      !files.length && "a photo or PDF of the report",
      !form.category && "the report type",
      !form.title.trim() && "the report name",
    ].filter(Boolean) as string[];
    if (missing.length) {
      msg.warning(`Add ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")} before saving`, "These are required so the report can be found and reviewed later.");
      return;
    }
    msg.clear();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (extraction) fd.append("extraction", JSON.stringify(extraction));
      files.forEach((f) => fd.append("files", f.file));
      await api.upload(`/api/facility/patients/${patientId}/reports`, fd);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      msg.error("The report wasn't saved", `${e.message || "Network error"}. Everything is still here — try again.`, { retry: save, retryLabel: "Save again" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Add Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border/70 bg-background/40 hover:border-primary/40"
              )}
            >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary"><Upload className="h-5 w-5" /></div>
              <p className="text-sm font-medium">Drop photos or PDFs of the report here, or click to choose</p>
              <p className="text-xs text-muted-foreground">All pages of one report · JPG, PNG, WEBP or PDF · up to {REPORT_MAX_FILES} files, 8 MB each</p>
              <input
                ref={inputRef} type="file" multiple accept={REPORT_FILE_TYPES.join(",")} className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
            <NoticeSlot state={fileMsg} className="mt-3" />

            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                {files.map((f, i) => (
                  <div key={f.id} className="group relative aspect-[3/4] rounded-lg border border-border/50 bg-background/40 overflow-hidden">
                    {f.preview
                      ? <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground p-2"><FileText className="h-6 w-6" /><span className="text-[10px] text-center line-clamp-2 break-all">{f.file.name}</span></div>}
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[10px]">{i + 1}</span>
                    <button type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.file.name}`}
                      className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 opacity-80 hover:opacity-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 flex-wrap">
                <p className="text-xs text-muted-foreground">Let Hakeem Insight read the report and fill in the details below — you check them before saving.</p>
                <Button size="sm" variant="outline" onClick={read} disabled={reading}>
                  {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {reading ? "Reading report…" : extraction ? "Read again" : "Read report"}
                </Button>
              </div>
            )}
            <NoticeSlot state={readMsg} className="mt-3" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <FloatingSelect id="reportCategory" label="Report type" required value={form.category} onValueChange={(v) => set({ category: v })}>
              {REPORT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </FloatingSelect>
            <FloatingField id="reportTitle" label="Report name (e.g. Complete Blood Count)" required value={form.title} onChange={(e) => set({ title: e.target.value })} />
            <FloatingField id="reportDate" label="Report date" type="date" max={today()} value={form.reportDate} onChange={(e) => set({ reportDate: e.target.value })} />
            <FloatingField id="reportSource" label="Lab / hospital" value={form.source} onChange={(e) => set({ source: e.target.value })} />
            <FloatingSelect id="reportFlag" label="Overall result" value={form.resultFlag} onValueChange={(v) => set({ resultFlag: v })}>
              {RESULT_FLAGS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </FloatingSelect>
          </div>
          <Textarea maxLength={500}
            value={form.findings}
            onChange={(e) => set({ findings: e.target.value })}
            placeholder="Key findings or remarks (optional) — e.g. Hb low, advised repeat after 4 weeks"
            className="min-h-[72px] bg-background/60"
          />

          {extraction && (extraction.summary || (extraction.values?.length ?? 0) > 0) && (
            <div className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Read by Hakeem Insight</p>
                <button type="button" onClick={() => setExtraction(null)} className="text-xs text-muted-foreground hover:text-foreground">Discard reading</button>
              </div>
              {extraction.summary && <p className="text-sm text-muted-foreground">{extraction.summary}</p>}
              {(extraction.values?.length ?? 0) > 0 && <ReportValuesTable values={extraction.values!} />}
              <p className="text-[11px] text-muted-foreground">Transcribed from the document — check it against the report before saving.</p>
            </div>
          )}
        </div>

        <NoticeSlot state={msg} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || reading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
