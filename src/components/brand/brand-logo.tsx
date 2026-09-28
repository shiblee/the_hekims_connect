"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}

// Full lockup (icon + wordmark) is the original logo file itself, cropped
// to a tight transparent bounding box — not a recreation.
const FULL_ASPECT = 1313 / 354;

/**
 * The Hekim's Connect brand mark, rendered straight from the original
 * logo file (public/brand/hekim-globe-icon.png for the icon alone,
 * public/brand/hekim-connect-logo-full.png for the full icon+wordmark
 * lockup) rather than a recreation — guarantees pixel-exact fidelity.
 */
export function BrandLogo({ size = 40, className, showWordmark = true }: BrandLogoProps) {
  if (!showWordmark) {
    return (
      <Image
        src="/brand/hekim-globe-icon.png"
        alt="The Hekim's Connect"
        width={size}
        height={size}
        className={cn("shrink-0 dark:invert", className)}
      />
    );
  }

  return (
    <Image
      src="/brand/hekim-connect-logo-full.png"
      alt="The Hekim's Connect"
      width={Math.round(size * FULL_ASPECT)}
      height={size}
      className={cn("shrink-0 dark:invert", className)}
    />
  );
}
