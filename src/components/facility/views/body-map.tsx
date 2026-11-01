"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { BODY_ZONES, LIMB_PATHS, type BodyView } from "@/lib/body-zones";
import { regionIcon } from "@/lib/anatomical-region-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface BodyMapItem {
  label: string;
  localTerms: string | null;
  icon: string;
  zone: string | null;
  selected: boolean;
  primary: boolean;
}

const VIEW_W = 200;
const VIEW_H = 420;

/** Neutral human silhouette, front or back. Filled shapes in one group so overlaps read as one body. */
function Silhouette({ view, className, seam = "var(--background)" }: { view: BodyView; className?: string; seam?: string }) {
  return (
    <g className={className}>
      <ellipse cx="100" cy="38" rx="22" ry="26" />
      <rect x="89" y="58" width="22" height="22" rx="7" />
      <path d="M62 84 Q100 72 138 84 L143 150 Q139 190 133 212 L135 246 Q100 260 65 246 L67 212 Q61 190 57 150 Z" />
      <path d={LIMB_PATHS.armL} fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
      <path d={LIMB_PATHS.armR} fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
      <circle cx="41" cy="262" r="9" />
      <circle cx="159" cy="262" r="9" />
      <path d={LIMB_PATHS.legL} fill="none" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
      <path d={LIMB_PATHS.legR} fill="none" stroke="currentColor" strokeWidth="22" strokeLinecap="round" />
      <ellipse cx="77" cy="408" rx="12" ry="6" />
      <ellipse cx="123" cy="408" rx="12" ry="6" />
      {view === "back" && <path d="M100 74 L100 236" stroke={seam} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />}
    </g>
  );
}

/**
 * Interactive body map for the Anatomical Region selector: front and back side
 * by side. Selected regions glow on their body area with an icon marker
 * (primary region strongest); every other region shows as a small dot that can
 * be clicked to select it.
 */
export function BodyMap({ items, onToggle }: { items: BodyMapItem[]; onToggle: (label: string) => void }) {
  const t = useTranslations("clinic.stage3");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["front", "back"] as const).map((v) => <BodyMapView key={v} view={v} items={items} onToggle={onToggle} />)}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {t("primary")}</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-emerald-500/60 bg-card" /> {t("selected")}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-muted-foreground/50" /> {t("available")}</span>
      </div>
    </div>
  );
}

function BodyMapView({ view, items, onToggle }: { view: BodyView; items: BodyMapItem[]; onToggle: (label: string) => void }) {
  const t = useTranslations("clinic.stage3");
  const uid = useId().replace(/:/g, "");
  const onView = items.filter((i) => i.zone && BODY_ZONES[i.zone]?.[view]);
  const count = onView.filter((i) => i.selected).length;

  // Regions sharing a marker point sit side by side instead of on top of each other.
  const groups = new Map<string, BodyMapItem[]>();
  for (const i of onView) {
    const m = BODY_ZONES[i.zone!][view]!.marker;
    const k = `${m.x},${m.y}`;
    groups.set(k, [...(groups.get(k) || []), i]);
  }

  return (
    <figure className="flex min-w-0 flex-col items-center">
      <figcaption className="mb-2 text-center leading-tight">
        <span className="flex items-center justify-center gap-1 text-[13px] font-semibold">
          {view === "front" ? t("anterior") : t("posterior")}
          {count > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{count}</span>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground">{view === "front" ? "Muqaddam" : "Mu'akhkhar"}</span>
      </figcaption>

      <div className="relative w-full max-w-[150px]" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <radialGradient id={`glow-${uid}`}>
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
            <filter id={`soft-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <Silhouette view={view} className="fill-current text-muted-foreground/20" />

          {/* Highlights for selected regions on this view */}
          {onView.filter((i) => i.selected).map((i) => {
            const z = BODY_ZONES[i.zone!][view]!;
            const strength = i.primary ? 1 : 0.6;
            return (
              <g key={i.label} opacity={strength}>
                {z.shapes.map((s, n) =>
                  s.kind === "ellipse" ? (
                    <ellipse key={n} cx={s.cx} cy={s.cy} rx={s.rx * 1.35} ry={s.ry * 1.35} fill={`url(#glow-${uid})`} />
                  ) : s.kind === "stroke" ? (
                    <path key={n} d={s.d} fill="none" stroke="#10b981" strokeOpacity="0.45" strokeWidth={s.width} strokeLinecap="round" filter={`url(#soft-${uid})`} />
                  ) : (
                    <Silhouette key={n} view={view} className="fill-current text-emerald-500/25" />
                  ),
                )}
              </g>
            );
          })}
        </svg>

        {/* Markers (HTML so they can carry icons, focus and tooltips) */}
        {[...groups.values()].flatMap((group) =>
          group.map((i, n) => {
            const m = BODY_ZONES[i.zone!][view]!.marker;
            const offset = (n - (group.length - 1) / 2) * 16;
            const Icon = regionIcon(i.icon);
            return (
              <Tooltip key={i.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onToggle(i.label)}
                    aria-label={t(i.selected ? "deselect" : "select", { label: i.label })}
                    aria-pressed={i.selected}
                    className="absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none group"
                    style={{ left: `calc(${(m.x / VIEW_W) * 100}% + ${offset}px)`, top: `${(m.y / VIEW_H) * 100}%`, zIndex: i.selected ? (i.primary ? 3 : 2) : 1 }}
                  >
                    {i.selected ? (
                      <span className="relative flex items-center justify-center">
                        {i.primary && <span className="absolute h-7 w-7 rounded-full bg-emerald-500/40 animate-ping" />}
                        <span className={cn(
                          "relative flex items-center justify-center rounded-full shadow-md ring-2 ring-background transition-transform group-hover:scale-110 group-focus-visible:ring-primary",
                          i.primary ? "h-6 w-6 bg-emerald-500 text-white" : "h-5 w-5 bg-card border border-emerald-500/60 text-emerald-500"
                        )}>
                          <Icon className={i.primary ? "h-3 w-3" : "h-2.5 w-2.5"} />
                        </span>
                      </span>
                    ) : (
                      <span className="block h-2.5 w-2.5 rounded-full border border-muted-foreground/50 bg-background transition-all group-hover:h-3.5 group-hover:w-3.5 group-hover:border-primary group-focus-visible:border-primary" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side={view === "front" ? "left" : "right"}>
                  <p className="font-medium">{i.label}</p>
                  {i.localTerms && <p className="text-xs opacity-80">{i.localTerms}</p>}
                  <p className="text-xs opacity-80">{i.primary ? t("primary_region") : i.selected ? t("selected_click") : t("click_select")}</p>
                </TooltipContent>
              </Tooltip>
            );
          }),
        )}
      </div>
    </figure>
  );
}

/**
 * Static, print-friendly body figure (one view) with the selected regions
 * highlighted the same way as the interactive map — fixed colours so it reads
 * the same on paper in light or dark theme. Used by the assessment report.
 */
export function BodyFigure({ view, items, width = 120, screen }: {
  view: BodyView;
  items: { label: string; zone: string | null; icon: string; primary: boolean }[];
  width?: number;
  /** On-screen use: silhouette follows the theme instead of the fixed print grey. */
  screen?: boolean;
}) {
  const t = useTranslations("clinic.stage3");
  const uid = useId().replace(/:/g, "");
  const onView = items.filter((i) => i.zone && BODY_ZONES[i.zone]?.[view]);
  const groups = new Map<string, typeof onView>();
  for (const i of onView) {
    const m = BODY_ZONES[i.zone!][view]!.marker;
    const k = `${m.x},${m.y}`;
    groups.set(k, [...(groups.get(k) || []), i]);
  }
  return (
    <figure className="flex flex-col items-center">
      <div className="relative" style={{ width, aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <radialGradient id={`pglow-${uid}`}>
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
          </defs>
          <Silhouette view={view} seam={screen ? "var(--card)" : "#ffffff"} className={cn("fill-current", screen ? "text-muted-foreground/25" : "text-[#e5e7eb]")} />
          {onView.map((i) => {
            const z = BODY_ZONES[i.zone!][view]!;
            return (
              <g key={i.label} opacity={i.primary ? 1 : 0.6}>
                {z.shapes.map((sh, n) =>
                  sh.kind === "ellipse" ? (
                    <g key={n}>
                      <ellipse cx={sh.cx} cy={sh.cy} rx={sh.rx * 1.7} ry={sh.ry * 1.7} fill={`url(#pglow-${uid})`} />
                      <ellipse cx={sh.cx} cy={sh.cy} rx={sh.rx} ry={sh.ry} fill="#10b981" fillOpacity="0.35" stroke="#059669" strokeOpacity="0.6" strokeWidth="1.5" />
                    </g>
                  ) : sh.kind === "stroke" ? (
                    <path key={n} d={sh.d} fill="none" stroke="#10b981" strokeOpacity="0.6" strokeWidth={sh.width} strokeLinecap="round" />
                  ) : (
                    <Silhouette key={n} view={view} seam="#ffffff" className="fill-current text-[#10b981]/25" />
                  ),
                )}
              </g>
            );
          })}
        </svg>
        {[...groups.values()].flatMap((group) =>
          group.map((i, n) => {
            const m = BODY_ZONES[i.zone!][view]!.marker;
            const offset = (n - (group.length - 1) / 2) * 16;
            const Icon = regionIcon(i.icon);
            return (
              <span
                key={i.label}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 border-white",
                  i.primary ? "h-6 w-6 bg-[#059669] text-white" : "h-5 w-5 bg-white text-[#059669] ring-1 ring-[#059669]",
                )}
                style={{ left: `calc(${(m.x / VIEW_W) * 100}% + ${offset}px)`, top: `${(m.y / VIEW_H) * 100}%`, zIndex: i.primary ? 2 : 1 }}
              >
                <Icon className={i.primary ? "h-3 w-3" : "h-2.5 w-2.5"} />
              </span>
            );
          }),
        )}
      </div>
      <figcaption className={cn("mt-1 uppercase tracking-wide", screen ? "text-[11px] text-muted-foreground" : "text-[8.5pt] text-[#6b7280]")}>{view === "front" ? t("front_fig") : t("back_fig")}</figcaption>
    </figure>
  );
}
