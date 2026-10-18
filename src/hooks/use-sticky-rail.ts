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
      const contentH = content.offsetHeight;
      const vh = window.innerHeight;

      // The rail is as tall as (or taller than) its section: nothing to pin.
      if (contentH >= spacerRect.height - 1) { setStyle(null); return; }

      if (contentH <= vh - TOP_OFFSET - BOTTOM_MARGIN) {
        // Short rail: pin its top just under the header while the section scrolls by.
        if (spacerRect.top > TOP_OFFSET) setStyle(null);
        else if (spacerRect.bottom < TOP_OFFSET + contentH) setStyle({ position: "absolute", bottom: 0, left: 0, width: spacerRect.width });
        else setStyle({ position: "fixed", top: TOP_OFFSET, left: spacerRect.left, width: spacerRect.width, zIndex: 10 });
      } else {
        // Tall rail: it scrolls with the page until its last card is in view,
        // then stays with its bottom on screen — every card stays reachable,
        // no scrollbar inside the column.
        if (spacerRect.top + contentH > vh - BOTTOM_MARGIN) setStyle(null);
        else if (spacerRect.bottom < vh - BOTTOM_MARGIN) setStyle({ position: "absolute", bottom: 0, left: 0, width: spacerRect.width });
        else setStyle({ position: "fixed", bottom: BOTTOM_MARGIN, left: spacerRect.left, width: spacerRect.width, zIndex: 10 });
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Cards load and grow after the first paint (and the centre column changes
    // height as answers expand) — re-measure whenever either side resizes.
    const ro = new ResizeObserver(update);
    if (spacerRef.current) ro.observe(spacerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [ready]);

  return { spacerRef, contentRef, style };
}
