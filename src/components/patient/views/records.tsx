"use client";

import { useEffect, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
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
import { sortByLabel } from "@/lib/sort-options";

const CATEGORIES = ["Lab Report", "Scan / Imaging", "Prescription", "Consultation Note", "Video Consultation", "Other"];
const CATEGORY_KEY: Record<string, string> = { "Lab Report": "c_Lab_Report", "Scan / Imaging": "c_Scan", Prescription: "c_Prescription", "Consultation Note": "c_Note", "Video Consultation": "c_Video", Other: "c_Other" };

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
  const t = useTranslations("patient.pages");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const catLabel = (c: string) => (CATEGORY_KEY[c] ? t(CATEGORY_KEY[c]) : c);

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
    if (!file) { toast.error(t("select_file")); return; }
    if (!form.title) { toast.error(t("add_title")); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      await api.upload("/api/patient/records", fd);
      toast.success(t("uploaded"));
      setUploadOpen(false);
      setForm({ title: "", description: "", category: "Lab Report" });
      setFile(null); setFilePreview("");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const remove = async (r: any) => {
    if (!confirm(t("delete_q", { title: r.title }))) return;
    try { await api.delete(`/api/patient/records/${r.id}`); toast.success(t("deleted")); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">{t("rec_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("rec_sub")}</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4" /> {t("upload")}</Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 border-border/50 bg-card/60 text-center">
          <p className="text-xs text-muted-foreground">{t("images")}</p>
          <p className="font-serif text-xl font-bold text-accent">{records.filter((r) => r.type === "image").length}</p>
        </Card>
        <Card className="p-3 border-border/50 bg-card/60 text-center">
          <p className="text-xs text-muted-foreground">{t("videos")}</p>
          <p className="font-serif text-xl font-bold text-primary">{records.filter((r) => r.type === "video").length}</p>
        </Card>
        <Card className="p-3 border-border/50 bg-card/60 text-center">
          <p className="text-xs text-muted-foreground">{t("documents")}</p>
          <p className="font-serif text-xl font-bold">{records.filter((r) => r.type === "document").length}</p>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline me-2" /> {tc("loading")}</div>
      ) : records.length === 0 ? (
        <Card className="p-10 border-dashed border-border bg-card/60 text-center">
          <FileImage className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">{t("none_yet")}</p>
          <p className="text-sm text-muted-foreground mb-4">{t("none_hint")}</p>
          <Button onClick={() => setUploadOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90"><Upload className="h-4 w-4 me-1" /> {t("upload_now")}</Button>
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
                <div className="absolute top-2 start-2">
                  <Badge className={cn(r.type === "image" ? "bg-accent/90 text-accent-foreground" : r.type === "video" ? "bg-primary/90 text-primary-foreground" : "bg-muted text-foreground")}>
                    {r.type === "video" ? <Film className="h-3 w-3 me-1" /> : <FileImage className="h-3 w-3 me-1" />}
                    {["image", "video", "document"].includes(r.type) ? t(`type_${r.type}`) : r.type}
                  </Badge>
                </div>
                <button onClick={() => setPreview(r)} className="absolute top-2 end-2 h-7 w-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{catLabel(r.category)} · {new Date(r.createdAt).toLocaleDateString(dl)}</p>
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
            <h3 className="font-serif text-lg font-semibold">{t("upload_title")}</h3>
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
                  <button onClick={(e) => { e.stopPropagation(); pickFile(null); }} className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">{t("click_upload")}</p>
                  <p className="text-xs text-muted-foreground">{t("size_hint")}</p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("f_title")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("f_title_ph")} className="bg-background/60" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("f_category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                <SelectContent>{sortByLabel(CATEGORIES, catLabel).map((c) => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("f_description")} <span className="text-muted-foreground">{t("optional")}</span></Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("f_desc_ph")} className="bg-background/60 min-h-[60px]" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? t("uploading") : t("upload")}
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
                  <p className="text-xs text-muted-foreground">{catLabel(preview.category)} · {new Date(preview.createdAt).toLocaleString(dl)}</p>
                </div>
                <a href={preview.fileData} download={preview.fileName}>
                  <Button size="sm" variant="outline"><Download className="h-4 w-4 me-1" /> {t("download")}</Button>
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
