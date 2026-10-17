"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Pins a right-rail column to the viewport while its grid section is still
 * scrolling by, then parks it at the bottom of that section once scrolled
 * past — so it never trails off or overlaps what comes after it.
 *
 * Plain CSS position:sticky doesn't work in the facility layout (an
 * ancestor's overflow-x-hidden redefines the nearest scrolling container), so
 * this is done by hand: the spacer gets its height from the grid's default
 * stretch (matching the taller left column) and is measured against scroll
 * position to switch between static / fixed / bottom-pinned.
 *
 * `ready` should flip true once the page content has rendered, so the
 * measurement runs against real layout rather than a loading state.
 */
export function useStickyRail(ready: boolean) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    const TOP_OFFSET = 80;
    const BOTTOM_MARGIN = 24;

    const update = () => {
      const spacer = spacerRef.current;
      const content = contentRef.current;
      if (!spacer || !content || window.innerWidth < 1024) {
        setStyle(null);
        return;
      }
      const spacerRect = spacer.getBoundingClientRect();
      const maxHeight = Math.min(content.scrollHeight, window.innerHeight - TOP_OFFSET - BOTTOM_MARGIN);

      if (spacerRect.top > TOP_OFFSET) {
        // Grid section hasn't scrolled up to the pin point yet.
        setStyle(null);
      } else if (spacerRect.bottom < TOP_OFFSET + maxHeight) {
        // Scrolled past — park at the bottom of the spacer so it then
        // scrolls away normally with the rest of the page from here.
        setStyle({ position: "absolute", bottom: 0, left: 0, width: spacerRect.width, maxHeight, overflowY: "auto" });
      } else {
        setStyle({ position: "fixed", top: TOP_OFFSET, left: spacerRect.left, width: spacerRect.width, maxHeight, overflowY: "auto", zIndex: 10 });
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ready]);

  return { spacerRef, contentRef, style };
}
