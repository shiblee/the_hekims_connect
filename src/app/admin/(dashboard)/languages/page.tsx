"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Languages as LanguagesIcon, Sparkles, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Language {
  code: string;
  name: string;
  englishName: string;
  direction: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  publishedCount: number;
  totalKeys: number;
}

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const load = () => {
    adminApi.get<{ languages: Language[] }>("/api/admin/languages")
      .then((res) => setLanguages(res.languages))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const update = async (code: string, patch: Record<string, unknown>) => {
    setBusy(code);
    try {
      await adminApi.patch(`/api/admin/languages/${code}`, patch);
      load();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const generateMissing = async (code: string, englishName: string) => {
    setGenerating(code);
    try {
      const res = await adminApi.post<{ generated: number; total: number }>("/api/admin/languages/generate-all", { languageCode: code });
      toast.success(`Generated ${res.generated}/${res.total} strings for ${englishName}`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <LanguagesIcon className="h-6 w-6 text-primary" /> Language ({languages.length})
          </h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/languages/keys"><ListChecks className="h-4 w-4" /> Browse translation keys</Link>
        </Button>
      </div>

      <div className="grid gap-4 max-w-4xl">
        {languages.map((l) => (
          <Card key={l.code} className="p-5 border-border/50 bg-card/60">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    className="h-9 w-40 bg-background/60"
                    defaultValue={l.name}
                    onBlur={(e) => e.target.value !== l.name && update(l.code, { name: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">{l.englishName} ({l.code})</span>
                  <Badge variant="outline" className="text-xs uppercase">{l.direction}</Badge>
                  {l.isDefault && <Badge className="text-xs bg-primary/15 text-primary border-primary/30">Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {l.publishedCount} / {l.totalKeys} strings published
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generating === l.code || l.publishedCount >= l.totalKeys}
                  onClick={() => generateMissing(l.code, l.englishName)}
                >
                  {generating === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate missing ({l.totalKeys - l.publishedCount})
                </Button>
                {!l.isDefault && (
                  <Button size="sm" variant="ghost" disabled={busy === l.code} onClick={() => update(l.code, { isDefault: true })}>
                    Set default
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Enabled</span>
                  <Switch
                    checked={l.enabled}
                    disabled={busy === l.code || l.isDefault}
                    onCheckedChange={(checked) => update(l.code, { enabled: checked })}
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
