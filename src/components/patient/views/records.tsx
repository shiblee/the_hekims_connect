"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileImage, FileText, Trash2, Loader2, Plus, Film, X, Download, Eye } from "lucide-react";

const CATEGORIES = ["Lab Report", "Scan / Imaging", "Prescription", "Consultation Note", "Video Consultation", "Other"];

export function RecordsView() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "Lab Report" });
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ records: any[] }>("/api/patient/records");
      setRecords(r.records || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const pickFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(f);
    } else setFilePreview("");
  };

  const submit = async () => {
    if (!file) { toast.error("Select a file"); return; }
    if (!form.title) { toast.error("Add a title"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      await api.upload("/api/patient/records", fd);
      toast.success("Record uploaded");
      setUploadOpen(false);
      setForm({ title: "", description: "", category: "Lab Report" });
      setFile(null); setFilePreview("");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const remove = async (r: any) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try { await api.delete(`/api/patient/records/${r.id}`); toast.success("Record deleted"); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">My Records</h2>
          <p className="text-sm text-muted-foreground">Upload lab reports, scans, videos and consultation notes.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4" /> Upload Record</Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 border-border/50 bg-card/60 text-center">
          <p className="text-xs text-muted-foreground">Images</p>
          <p className="font-serif text-xl font-bold text-accent">{records.filter((r) => r.type === "image").length}</p>
        </Card>
        <Card className="p-3 border-border/50 bg-card/60 text-center">
          <p className="text-xs text-muted-foreground">Videos</p>
          <p className="font-serif text-xl font-bold text-primary">{records.filter((r) => r.type === "video").length}</p>
        </Card>
        <Card className="p-3 border-border/50 bg-card/60 text-center">
          <p className="text-xs text-muted-foreground">Documents</p>
          <p className="font-serif text-xl font-bold">{records.filter((r) => r.type === "document").length}</p>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : records.length === 0 ? (
        <Card className="p-10 border-dashed border-border bg-card/60 text-center">
          <FileImage className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No records yet</p>
          <p className="text-sm text-muted-foreground mb-4">Upload your first medical record — image or video.</p>
          <Button onClick={() => setUploadOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Upload className="h-4 w-4 mr-1" /> Upload now</Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((r) => (
            <Card key={r.id} className="overflow-hidden border-border/50 bg-card/60 hover:border-accent/40 transition-colors group">
              <div className="aspect-video bg-background/40 relative">
                {r.type === "image" ? (
                  <img src={r.fileData} alt={r.title} className="w-full h-full object-cover" />
                ) : r.type === "video" ? (
                  <video src={r.fileData} className="w-full h-full object-cover" controls />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileText className="h-10 w-10" /></div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge className={cn(r.type === "image" ? "bg-accent/90 text-accent-foreground" : r.type === "video" ? "bg-primary/90 text-primary-foreground" : "bg-muted text-foreground")}>
                    {r.type === "video" ? <Film className="h-3 w-3 mr-1" /> : <FileImage className="h-3 w-3 mr-1" />}
                    {r.type}
                  </Badge>
                </div>
                <button onClick={() => setPreview(r)} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.category} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
                {r.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.description}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-accent" />
            <h3 className="font-serif text-lg font-semibold">Upload Medical Record</h3>
          </div>
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
              {filePreview ? (
                <div className="relative">
                  {file?.type.startsWith("image/") ? (
                    <img src={filePreview} alt="preview" className="max-h-40 mx-auto rounded-lg" />
                  ) : (
                    <video src={filePreview} className="max-h-40 mx-auto rounded-lg" controls />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); pickFile(null); }} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs text-muted-foreground">Image or video, up to 5MB</p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. CBC Report - Nov 2025" className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Any notes about this record…" className="bg-background/60 min-h-[60px]" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? "Uploading…" : "Upload Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-serif text-lg font-semibold">{preview.title}</h3>
                  <p className="text-xs text-muted-foreground">{preview.category} · {new Date(preview.createdAt).toLocaleString()}</p>
                </div>
                <a href={preview.fileData} download={preview.fileName}>
                  <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Download</Button>
                </a>
              </div>
              {preview.type === "image" ? (
                <img src={preview.fileData} alt={preview.title} className="w-full rounded-lg" />
              ) : preview.type === "video" ? (
                <video src={preview.fileData} controls className="w-full rounded-lg" />
              ) : (
                <div className="p-10 text-center text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-2" />{preview.fileName}</div>
              )}
              {preview.description && <p className="text-sm text-muted-foreground mt-3">{preview.description}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
