"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TranslationValue {
  languageCode: string;
  text: string;
  status: string;
  source: string;
}
interface TranslationKey {
  id: string;
  key: string;
  group: string;
  description: string | null;
  sourceText: string;
  values: TranslationValue[];
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ur", label: "اردو" },
  { code: "ar", label: "العربية" },
  { code: "fa", label: "فارسی" },
];

const STATUS_LABEL: Record<string, string> = { draft: "Draft", ai_generated: "AI generated", published: "Published" };
const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  ai_generated: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  published: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

export default function TranslationKeyEditorPage() {
  const { key: rawKey } = useParams<{ key: string }>();
  const key = decodeURIComponent(rawKey);

  const [data, setData] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    adminApi.get<{ key: TranslationKey }>(`/api/admin/languages/keys/${encodeURIComponent(key)}`)
      .then((res) => {
        setData(res.key);
        setDrafts(Object.fromEntries(res.key.values.map((v) => [v.languageCode, v.text])));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [key]);

  const valueFor = (code: string) => data?.values.find((v) => v.languageCode === code);

  const generate = async (code: string) => {
    setGenerating(code);
    try {
      const res = await adminApi.post<{ value: TranslationValue }>(`/api/admin/languages/keys/${encodeURIComponent(key)}/values/${code}/generate`, {});
      setDrafts((d) => ({ ...d, [code]: res.value.text }));
      load();
      toast.success(`Draft generated for ${LANGUAGES.find((l) => l.code === code)?.label}`);
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setGenerating(null);
    }
  };

  const save = async (code: string, status: "draft" | "published") => {
    const text = drafts[code];
    if (!text?.trim()) {
      toast.error("Enter text before saving");
      return;
    }
    setSaving(code);
    try {
      await adminApi.put(`/api/admin/languages/keys/${encodeURIComponent(key)}/values/${code}`, { text, status });
      load();
      toast.success(status === "published" ? "Published" : "Draft saved");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/languages/keys" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Translation Keys
      </Link>

      <div className="mb-8">
        <p className="font-mono text-xs text-primary mb-1.5">{data.key}</p>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{data.sourceText}</h1>
        {data.description && <p className="text-muted-foreground mt-1.5">{data.description}</p>}
        <Badge variant="outline" className="mt-2 text-xs">{data.group}</Badge>
      </div>

      <Card className="p-6 border-border/50 bg-card/60 max-w-3xl">
        <Tabs defaultValue="hi">
          <TabsList className="grid grid-cols-4 mb-6">
            {LANGUAGES.filter((l) => l.code !== "en").map((l) => (
              <TabsTrigger key={l.code} value={l.code}>{l.label}</TabsTrigger>
            ))}
          </TabsList>
          {LANGUAGES.filter((l) => l.code !== "en").map((l) => {
            const existing = valueFor(l.code);
            return (
              <TabsContent key={l.code} value={l.code} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Translation ({l.label})</span>
                  {existing && (
                    <Badge variant="outline" className={STATUS_VARIANT[existing.status]}>
                      {STATUS_LABEL[existing.status]}
                    </Badge>
                  )}
                </div>
                <Textarea
                  className="min-h-[100px] bg-background/60"
                  dir={["ur", "ar", "fa"].includes(l.code) ? "rtl" : "ltr"}
                  value={drafts[l.code] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [l.code]: e.target.value }))}
                  placeholder={`Enter the ${l.label} translation…`}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={generating === l.code} onClick={() => generate(l.code)}>
                    {generating === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate with AI
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === l.code} onClick={() => save(l.code, "draft")}>
                    <Save className="h-4 w-4" /> Save Draft
                  </Button>
                  <Button size="sm" disabled={saving === l.code} onClick={() => save(l.code, "published")}>
                    <CheckCircle2 className="h-4 w-4" /> Publish
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </Card>
    </div>
  );
}
