"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { HEALTH_STYLE } from "./facility-detail-context";

export const DAY = 86_400_000;
export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / DAY);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${Math.floor(d / 365)} yr ago`;
};

export function ScoreRing({ score, band, size = 44 }: { score: number; band: keyof typeof HEALTH_STYLE; size?: number }) {
  const r = 15.5, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} className="fill-none stroke-muted" strokeWidth={3} />
        <circle cx="18" cy="18" r={r} className={cn("fill-none transition-all", HEALTH_STYLE[band].ring)} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="font-bold tabular-nums" style={{ fontSize: size * 0.3 }}>{score}</span>
    </span>
  );
}

export function Trend({ now, prev, money }: { now: number; prev: number; money?: boolean }) {
  if (now === prev) return <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Minus className="h-3 w-3" /> same as before</span>;
  const up = now > prev;
  const Icon = up ? TrendingUp : TrendingDown;
  const diff = Math.abs(now - prev);
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      <Icon className="h-3 w-3" />{prev === 0 ? "new" : `${Math.round((diff / prev) * 100)}%`}
      <span className="font-normal text-muted-foreground">&nbsp;({up ? "+" : "−"}{money ? inr(diff) : diff})</span>
    </span>
  );
}

