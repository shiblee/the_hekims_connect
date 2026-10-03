"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Layers } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface KeyRow {
  id: string;
  key: string;
  group: string;
  sourceText: string;
  statuses: Record<string, string>;
}
interface GroupCount {
  group: string;
  count: number;
}

const LANGUAGE_CODES = ["en", "hi", "ur", "ar", "fa"];
const STATUS_COLOR: Record<string, string> = {
  published: "bg-emerald-500",
  ai_generated: "bg-sky-500",
  draft: "bg-amber-500",
};

export default function TranslationKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [groups, setGroups] = useState<GroupCount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [group, setGroup] = useState<string>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (group !== "all") params.set("group", group);
    if (q.trim()) params.set("q", q.trim());
    adminApi.get<{ keys: KeyRow[]; groups: GroupCount[]; totalCount: number }>(`/api/admin/languages/keys?${params}`)
      .then((res) => {
        setKeys(res.keys);
        setGroups(res.groups);
        setTotalCount(res.totalCount);
      })
      .finally(() => setLoading(false));
  }, [group, q]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/languages" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Languages
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Translation Keys</h1>
        <p className="text-muted-foreground mt-1.5">{totalCount} keys across {groups.length} groups · click a group, then a key to edit its translations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Groups sidebar */}
        <aside className="lg:w-60 shrink-0">
          <Card className="border-border/50 bg-card/60 p-2 lg:sticky lg:top-6">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              <button
                onClick={() => setGroup("all")}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:shrink lg:whitespace-normal text-left",
                  group === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2"><Layers className="h-4 w-4 shrink-0" /> All groups</span>
                <span className="text-xs tabular-nums opacity-70">{totalCount}</span>
              </button>
              {groups.map((g) => (
                <button
                  key={g.group}
                  onClick={() => setGroup(g.group)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:shrink lg:whitespace-normal text-left",
                    group === g.group ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span className="truncate">{g.group}</span>
                  <span className="text-xs tabular-nums opacity-70 shrink-0">{g.count}</span>
                </button>
              ))}
            </nav>
          </Card>
        </aside>

        {/* Keys + values */}
        <div className="flex-1 min-w-0">
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="h-10 pl-9 bg-background/60" placeholder="Search key or source text…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No keys match this group/search.</p>
          ) : (
            <Card className="border-border/50 bg-card/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Key</th>
                    <th className="text-left px-4 py-3 font-medium">Source (English)</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/languages/keys/${encodeURIComponent(k.key)}`} className="font-mono text-xs text-primary hover:underline">
                          {k.key}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-md truncate text-foreground/80">{k.sourceText}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {LANGUAGE_CODES.map((code) => (
                            <span
                              key={code}
                              title={`${code}: ${k.statuses[code] ?? "missing"}`}
                              className={`h-2.5 w-2.5 rounded-full ${k.statuses[code] ? STATUS_COLOR[k.statuses[code]] ?? "bg-muted-foreground/30" : "bg-muted-foreground/20"}`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
