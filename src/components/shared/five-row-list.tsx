"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A list sized to its first five rows, however tall each is; the rest scroll inside it. It grows when its box stretches to match the next column. */
export function FiveRowList({ count, className = "space-y-1.5", children }: { count?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const fifth = el.children.length > 5 ? el.children[4] as HTMLElement : null;
    el.style.height = fifth ? `${fifth.offsetTop + fifth.offsetHeight}px` : "";
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);
  // A food just added goes to the end of the list: bring it into view (not when the saved list first loads).
  const lastCount = useRef(count);
  useEffect(() => {
    if (count && lastCount.current && count > lastCount.current) ref.current?.scrollTo({ top: ref.current.scrollHeight });
    lastCount.current = count;
  }, [count]);
  return <ul ref={ref} className={cn("relative min-h-0 grow overflow-y-auto", className)}>{children}</ul>;
}
