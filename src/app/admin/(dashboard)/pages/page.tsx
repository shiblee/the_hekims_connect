"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface PageRow {
  id: string;
  slug: string;
  title: string;
  statuses: Record<string, string>;
}
interface PageContentValue {
  languageCode: string;
  title: string;
  subtitle: string | null;
  body: string;
  status: string;
}
interface PageDetail {
  id: string;
  slug: string;
  title: string;
  contents: PageContentValue[];
}
interface DraftValue {
  title: string;
  subtitle: string;
  body: string;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
  { code: "fa", label: "فارسی" },
];
const RTL_CODES = ["ur", "ar", "fa"];

const STATUS_LABEL: Record<string, string> = { draft: "Draft", published: "Published" };
const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  published: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

export default function AdminPagesPage() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const loadList = () => {
    adminApi.get<{ pages: PageRow[] }>("/api/admin/pages")
      .then((res) => {
        setPages(res.pages);
        setSelectedSlug((current) => current ?? (res.pages.length ? res.pages[0].slug : null));
      })
      .finally(() => setLoadingList(false));
  };

  useEffect(loadList, []);

  const loadDetail = (slug: string) => {
    setLoadingDetail(true);
    adminApi.get<{ page: PageDetail }>(`/api/admin/pages/${slug}`)
      .then((res) => {
        setDetail(res.page);
        const d: Record<string, DraftValue> = {};
        for (const l of LANGUAGES) {
          const existing = res.page.contents.find((c) => c.languageCode === l.code);
          d[l.code] = {
            title: existing?.title ?? (l.code === "en" ? res.page.title : ""),
            subtitle: existing?.subtitle ?? "",
            body: existing?.body ?? "",
          };
        }
        setDrafts(d);
      })
      .finally(() => setLoadingDetail(false));
  };

  useEffect(() => {
    if (selectedSlug) loadDetail(selectedSlug);
  }, [selectedSlug]);

  const statusFor = (code: string) => detail?.contents.find((c) => c.languageCode === code)?.status;

  const setField = (code: string, field: keyof DraftValue, value: string) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], [field]: value } }));
  };

  const save = async (code: string, status: "draft" | "published") => {
    if (!detail) return;
    const d = drafts[code];
    if (!d?.title?.trim() || !d?.body?.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSaving(code);
    try {
      await adminApi.put(`/api/admin/pages/${detail.slug}/content/${code}`, {
        title: d.title,
        subtitle: d.subtitle,
        body: d.body,
        status,
      });
      loadDetail(detail.slug);
      loadList();
      toast.success(status === "published" ? "Published" : "Draft saved");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Pages ({pages.length})</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Pages sidebar */}
        <aside className="lg:w-60 shrink-0">
          <Card className="border-border/50 bg-card/60 p-2 lg:sticky lg:top-6">
            {loadingList ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : (
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                {pages.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => setSelectedSlug(p.slug)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:shrink lg:whitespace-normal text-left",
                      selectedSlug === p.slug ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </nav>
            )}
          </Card>
        </aside>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {loadingDetail || !detail ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <Card className="p-6 border-border/50 bg-card/60">
              <Tabs defaultValue="en">
                <TabsList className="grid grid-cols-5 mb-6">
                  {LANGUAGES.map((l) => (
                    <TabsTrigger key={l.code} value={l.code}>{l.label}</TabsTrigger>
                  ))}
                </TabsList>
                {LANGUAGES.map((l) => {
                  const st = statusFor(l.code);
                  const d = drafts[l.code] ?? { title: "", subtitle: "", body: "" };
                  const dir = RTL_CODES.includes(l.code) ? "rtl" : "ltr";
                  return (
                    <TabsContent key={l.code} value={l.code} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Content ({l.label})</span>
                        {st && <Badge variant="outline" className={STATUS_VARIANT[st]}>{STATUS_LABEL[st]}</Badge>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Page title</Label>
                        <Input
                          className="h-11 bg-background/60"
                          dir={dir}
                          value={d.title}
                          onChange={(e) => setField(l.code, "title", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Subtitle <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                          className="h-11 bg-background/60"
                          dir={dir}
                          value={d.subtitle}
                          onChange={(e) => setField(l.code, "subtitle", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Body <span className="text-muted-foreground font-normal">(Markdown — use ## for section headings)</span></Label>
                        <Textarea
                          className="min-h-[360px] bg-background/60 font-mono text-sm"
                          dir={dir}
                          value={d.body}
                          onChange={(e) => setField(l.code, "body", e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={saving === l.code} onClick={() => save(l.code, "draft")}>
                          {saving === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
                        </Button>
                        <Button size="sm" disabled={saving === l.code} onClick={() => save(l.code, "published")}>
                          {saving === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Publish
                        </Button>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
