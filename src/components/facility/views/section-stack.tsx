import { cn } from "@/lib/utils";

/**
 * One card for a stage's main sections, divided by lines: each child is a wrapper div
 * around a panel whose own Card box is flattened (no border, background or rounding).
 */
export function SectionStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs",
      "[&>div>[data-slot=card]]:rounded-none [&>div>[data-slot=card]]:border-0 [&>div>[data-slot=card]]:bg-transparent [&>div>[data-slot=card]]:shadow-none [&>div>[data-slot=card]]:p-5",
      className)}>
      {children}
    </div>
  );
}
