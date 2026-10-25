"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, ChevronLeft, ChevronRight, Info, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDateTime } from "@/lib/utils";
import { GEMINI_FEATURES, type GeminiPricing, type PricePeriod } from "@/lib/gemini-pricing";
import { sortByLabel } from "@/lib/sort-options";

interface Totals { calls: number; costUsd: number; totalTokens: number }
interface Daily { date: string; calls: number; failed: number; inputTokens: number; outputTokens: number; costUsd: number }
interface FeatureRow { feature: string; label: string; area: string; calls: number; failed: number; inputTokens: number; outputTokens: number; costUsd: number; avgMs: number; last: string }
interface Summary {
  status: "on" | "off" | "no_key"; model: string; pricing: GeminiPricing; trackingSince: string | null;
  allTime: Totals; today: Totals; month: Totals;
  searchMonth: { used: number; billed: number; free: number };
  range: { days: number; calls: number; ok: number; failed: number; quota: number; inputTokens: number; cachedTokens: number; outputTokens: number; thinkingTokens: number; totalTokens: number; searchRequests: number; costUsd: number; avgMs: number };
  daily: Daily[];
  features: FeatureRow[];
}
interface CallRow {
  id: string; createdAt: string; feature: string; model: string; status: string; httpStatus: number | null;
  inputTokens: number; cachedTokens: number; outputTokens: number; thinkingTokens: number; totalTokens: number;
  searchRequests: number; billedSearches: number; costUsd: number; durationMs: number; errorMessage: string | null;
}

const RANGES = [{ v: "7", l: "7 days" }, { v: "30", l: "30 days" }, { v: "90", l: "90 days" }, { v: "all", l: "All time" }];
const n = (v: number) => v.toLocaleString("en-IN");
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M` : v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : String(v));
/** Small amounts keep enough decimals to be meaningful ($0.0004, not $0.00). */
function usd(v: number) {
  if (v === 0) return "$0.00";
  const digits = v >= 1 ? 2 : v >= 0.01 ? 3 : 5;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits })}`;
}
function inr(v: number, rate: number) {
  const x = v * rate;
  if (x === 0) return "₹0";
  return `₹${x.toLocaleString("en-IN", { maximumFractionDigits: x >= 100 ? 0 : x >= 1 ? 2 : 4 })}`;
}
const STATUS_LABEL: Record<string, string> = { ok: "OK", error: "Error", quota: "Quota / credits", timeout: "Timed out" };

// Chart series colours (validated categorical pair; dark steps for the dark surface).
const SERIES = "[--viz-1:#2a78d6] [--viz-2:#eb6834] dark:[--viz-1:#3987e5] dark:[--viz-2:#d95926]";

export function GeminiUsageDashboard() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.get<Summary>(`/api/admin/gemini-usage?days=${days}&tz=${-new Date().getTimezoneOffset()}`));
    } catch (err: any) { toast.error(err.message || "Could not load Gemini usage"); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  const rate = data.pricing.usdToInr;
  const r = data.range;

  return (
    <div className={cn("space-y-6", SERIES)}>
      {/* Status */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className={data.status === "on" ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" : "border-amber-500/50 text-amber-700 dark:text-amber-400"}>
          Gemini {data.status === "on" ? "ON" : data.status === "off" ? "OFF" : "— no key saved"}
        </Badge>
        <span className="text-muted-foreground">Model <span className="font-mono text-foreground">{data.model}</span></span>
        <span className="text-muted-foreground">· {data.trackingSince ? `Tracking since ${formatDateTime(data.trackingSince)}` : "Tracking starts with the first call"}</span>
        {data.pricing.freeTier && <Badge variant="outline">Free tier — costs shown as 0</Badge>}
        <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Google&apos;s own usage &amp; billing <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Every Gemini request this app makes is counted here — tokens as reported by Google, cost from the prices below. Requests made before tracking started aren&apos;t included, and Google&apos;s invoice (taxes, other apps using the same key) is the final word.
      </p>

      {/* Headline totals */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Total cost to date" value={usd(data.allTime.costUsd)} sub={`${inr(data.allTime.costUsd, rate)} · ${n(data.allTime.calls)} calls`} strong />
        <Tile label="This month" value={usd(data.month.costUsd)} sub={`${inr(data.month.costUsd, rate)} · ${n(data.month.calls)} calls`} />
        <Tile label="Today" value={usd(data.today.costUsd)} sub={`${inr(data.today.costUsd, rate)} · ${n(data.today.calls)} calls`} />
        <Tile label="Google Search this month" value={`${n(data.searchMonth.used)} / ${n(data.searchMonth.free)}`} sub={data.searchMonth.billed ? `${n(data.searchMonth.billed)} billed beyond the free allowance` : "within the free allowance"} />
      </div>

      {/* Range */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <h3 className="font-serif text-base font-semibold">Usage in the last {days === "all" ? `${r.days} days (all time)` : `${days} days`}</h3>
        <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Period">
          {RANGES.map((x) => (
            <button key={x.v} type="button" onClick={() => setDays(x.v)} aria-pressed={days === x.v}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", days === x.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {x.l}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-5", loading && "opacity-60")}>
        <Tile label="Cost" value={usd(r.costUsd)} sub={inr(r.costUsd, rate)} />
        <Tile label="Calls" value={n(r.calls)} sub={`${n(r.ok)} OK · ${n(r.failed)} failed${r.quota ? ` (${n(r.quota)} quota)` : ""}`} />
        <Tile label="Input tokens" value={compact(r.inputTokens)} sub={r.cachedTokens ? `${compact(r.cachedTokens)} from cache` : "sent to Gemini"} />
        <Tile label="Output tokens" value={compact(r.outputTokens + r.thinkingTokens)} sub={`${compact(r.thinkingTokens)} of them thinking`} />
        <Tile label="Average per call" value={r.calls ? usd(r.costUsd / r.calls) : "—"} sub={r.calls ? `${(r.avgMs / 1000).toFixed(1)} s · ${compact(Math.round(r.totalTokens / r.calls))} tokens` : "no calls"} />
      </div>

      {r.calls === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No Gemini calls in this period.{data.status !== "on" ? " Gemini is switched off, so nothing is being spent." : ""}
        </p>
      ) : (
        <>
          <ChartCard title="Cost per day (USD)">
            <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={shortDate} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => usd(v)} />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<DayTooltip rate={rate} />} />
              <Bar dataKey="costUsd" name="Cost" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Tokens per day" legend={[{ c: "var(--viz-1)", l: "Input" }, { c: "var(--viz-2)", l: "Output (incl. thinking)" }]}>
            <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={shortDate} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={compact} />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<DayTooltip rate={rate} />} />
              <Bar dataKey="inputTokens" name="Input" stackId="t" fill="var(--viz-1)" stroke="var(--card)" strokeWidth={1} />
              <Bar dataKey="outputTokens" name="Output" stackId="t" fill="var(--viz-2)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <FeatureTable rows={data.features} total={r.costUsd} rate={rate} />
        </>
      )}

      <CallsLog key={days} />
      <PricingEditor pricing={data.pricing} onSaved={load} />
    </div>
  );
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", strong ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, legend, children }: { title: string; legend?: { c: string; l: string }[]; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {legend && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {legend.map((x) => <span key={x.l} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.c }} />{x.l}</span>)}
          </div>
        )}
      </div>
      <div className="h-56"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}

function shortDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function DayTooltip({ active, payload, rate }: { active?: boolean; payload?: { payload: Daily }[]; rate: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>
      <p className="tabular-nums">Cost <strong>{usd(d.costUsd)}</strong> · {inr(d.costUsd, rate)}</p>
      <p className="tabular-nums">{n(d.calls)} calls{d.failed ? ` (${n(d.failed)} failed)` : ""}</p>
      <p className="tabular-nums"><span className="inline-block h-2 w-2 rounded-sm me-1" style={{ background: "var(--viz-1)" }} />Input {n(d.inputTokens)} · <span className="inline-block h-2 w-2 rounded-sm mx-1" style={{ background: "var(--viz-2)" }} />Output {n(d.outputTokens)}</p>
    </div>
  );
}

function FeatureTable({ rows, total, rate }: { rows: FeatureRow[]; total: number; rate: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
      <p className="px-4 pt-4 pb-2 text-sm font-semibold">Where it is used</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-2">Feature</th>
              <th className="px-4 py-2 text-right">Calls</th>
              <th className="px-4 py-2 text-right">Input</th>
              <th className="px-4 py-2 text-right">Output</th>
              <th className="px-4 py-2 text-right">Cost</th>
              <th className="px-4 py-2 min-w-36">Share of cost</th>
              <th className="px-4 py-2 text-right">Avg time</th>
              <th className="px-4 py-2">Last used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const share = total > 0 ? f.costUsd / total : 0;
              return (
                <tr key={f.feature} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-2"><span className="font-medium">{f.label}</span><span className="block text-xs text-muted-foreground">{f.area}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(f.calls)}{f.failed ? <span className="block text-xs text-destructive">{n(f.failed)} failed</span> : null}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{compact(f.inputTokens)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{compact(f.outputTokens)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{usd(f.costUsd)}<span className="block text-xs font-normal text-muted-foreground">{inr(f.costUsd, rate)}</span></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-1.5 rounded-full" style={{ width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`, background: "var(--viz-1)" }} /></div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(share * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{(f.avgMs / 1000).toFixed(1)} s</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(f.last)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CallsLog() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [feature, setFeature] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (feature !== "all") params.set("feature", feature);
    if (status !== "all") params.set("status", status);
    adminApi.get<{ calls: CallRow[]; total: number; pageSize: number }>(`/api/admin/gemini-usage/calls?${params}`)
      .then((res) => { setCalls(res.calls); setTotal(res.total); setPageSize(res.pageSize); })
      .catch(() => toast.error("Could not load the call log"));
  }, [page, feature, status]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const features = sortByLabel(Object.entries(GEMINI_FEATURES).map(([value, f]) => ({ value, label: f.label })));

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <p className="text-sm font-semibold">Every call <span className="font-normal text-muted-foreground">({n(total)})</span></p>
        <div className="flex flex-wrap gap-2">
          <Select value={feature} onValueChange={(v) => { setFeature(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All features</SelectItem>
              {features.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any result</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {calls.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-muted-foreground">No calls recorded{feature !== "all" || status !== "all" ? " for this filter" : " yet"}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Feature</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2 text-right">Input</th>
                <th className="px-4 py-2 text-right">Output</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-border/30 last:border-0 align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDateTime(c.createdAt)}</td>
                  <td className="px-4 py-2">{GEMINI_FEATURES[c.feature]?.label ?? c.feature}{c.searchRequests ? <span className="block text-xs text-muted-foreground">Google Search{c.billedSearches ? " (billed)" : " (free)"}</span> : null}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={c.status === "ok" ? "text-muted-foreground" : "border-destructive/40 text-destructive"}>{STATUS_LABEL[c.status] ?? c.status}{c.httpStatus && c.status !== "ok" ? ` ${c.httpStatus}` : ""}</Badge>
                    {c.errorMessage && <span className="mt-1 block max-w-72 text-xs text-muted-foreground line-clamp-2" title={c.errorMessage}>{c.errorMessage}</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(c.inputTokens + c.cachedTokens)}{c.cachedTokens ? <span className="block text-xs text-muted-foreground">{n(c.cachedTokens)} cached</span> : null}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{n(c.outputTokens + c.thinkingTokens)}{c.thinkingTokens ? <span className="block text-xs text-muted-foreground">{n(c.thinkingTokens)} thinking</span> : null}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{usd(c.costUsd)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{(c.durationMs / 1000).toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Newer</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Older <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PricingEditor({ pricing, onSaved }: { pricing: GeminiPricing; onSaved: () => void }) {
  const [form, setForm] = useState<GeminiPricing>(pricing);
  const [recalc, setRecalc] = useState(false);
  const [saving, setSaving] = useState(false);
  const setPeriod = (i: number, patch: Partial<PricePeriod>) => setForm((f) => ({ ...f, periods: f.periods.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const num = (v: string) => (v === "" ? NaN : Number(v));

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.put<{ recalculated: number | null }>("/api/admin/gemini-usage/pricing", { pricing: form, recalculate: recalc });
      toast.success(res.recalculated !== null ? `Prices saved — ${res.recalculated} past calls re-priced` : "Prices saved — they apply to new calls");
      setRecalc(false);
      onSaved();
    } catch (err: any) { toast.error(err.message || "Could not save the prices"); }
    finally { setSaving(false); }
  };

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div>
        <h3 className="font-serif text-base font-semibold">Prices</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          USD per 1 million tokens, from Google&apos;s <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer" className="text-primary hover:underline">Gemini price list</a>. Each call is priced when it is made, with the period in force that day. Output includes thinking tokens.
        </p>
      </div>
      <div className="space-y-2">
        {form.periods.map((p, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] items-end">
            <label className="text-xs text-muted-foreground">From
              <Input type="date" value={p.from ?? ""} disabled={p.from === null} onChange={(e) => setPeriod(i, { from: e.target.value || null })} className="mt-1" />
              {p.from === null && <span className="mt-0.5 block text-[11px]">from the start</span>}
            </label>
            <label className="text-xs text-muted-foreground">Input
              <Input type="number" step="any" min={0} value={Number.isFinite(p.input) ? p.input : ""} onChange={(e) => setPeriod(i, { input: num(e.target.value) })} className="mt-1" />
            </label>
            <label className="text-xs text-muted-foreground">Cached input
              <Input type="number" step="any" min={0} value={Number.isFinite(p.cachedInput) ? p.cachedInput : ""} onChange={(e) => setPeriod(i, { cachedInput: num(e.target.value) })} className="mt-1" />
            </label>
            <label className="text-xs text-muted-foreground">Output
              <Input type="number" step="any" min={0} value={Number.isFinite(p.output) ? p.output : ""} onChange={(e) => setPeriod(i, { output: num(e.target.value) })} className="mt-1" />
            </label>
            <Button variant="ghost" size="icon" aria-label="Remove this period" disabled={p.from === null} onClick={() => setForm((f) => ({ ...f, periods: f.periods.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, periods: [...f.periods, { ...f.periods[f.periods.length - 1], from: new Date().toISOString().slice(0, 10) }] }))}>
          <Plus className="h-4 w-4" /> Add a price change
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">Free Google searches per month
          <Input type="number" min={0} value={Number.isFinite(form.searchFreePerMonth) ? form.searchFreePerMonth : ""} onChange={(e) => setForm((f) => ({ ...f, searchFreePerMonth: num(e.target.value) }))} className="mt-1" />
        </label>
        <label className="text-xs text-muted-foreground">Then, USD per 1,000 searches
          <Input type="number" step="any" min={0} value={Number.isFinite(form.searchPer1000) ? form.searchPer1000 : ""} onChange={(e) => setForm((f) => ({ ...f, searchPer1000: num(e.target.value) }))} className="mt-1" />
        </label>
        <label className="text-xs text-muted-foreground">1 USD in rupees (for ₹ figures)
          <Input type="number" step="any" min={0} value={Number.isFinite(form.usdToInr) ? form.usdToInr : ""} onChange={(e) => setForm((f) => ({ ...f, usdToInr: num(e.target.value) }))} className="mt-1" />
        </label>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-input px-3.5 py-3">
        <span>
          <span className="block text-sm font-semibold">Free-tier key</span>
          <span className="block text-xs text-muted-foreground">Google doesn&apos;t bill a free-tier key — every cost shows as 0 (tokens are still counted).</span>
        </span>
        <Switch checked={form.freeTier} onCheckedChange={(v) => setForm((f) => ({ ...f, freeTier: v }))} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={recalc} onCheckedChange={(v) => setRecalc(v === true)} />
          Also re-price calls already recorded
        </label>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save prices</Button>
      </div>
    </section>
  );
}
