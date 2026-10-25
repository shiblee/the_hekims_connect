import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROCESSING_LABEL, REVIEW_LABEL, type ProcessingStatus, type ReviewStatus } from "@/lib/book-translation-core";

const PROCESSING_TONE: Record<ProcessingStatus, string> = {
  not_started: "text-muted-foreground",
  queued: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  processing: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  generated: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  partial: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  failed: "border-destructive/40 text-destructive",
};

const REVIEW_TONE: Record<ReviewStatus, string> = {
  pending_review: "text-muted-foreground",
  in_review: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  confirmed: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  changes_required: "border-amber-500/40 text-amber-700 dark:text-amber-400",
};

export function ProcessingBadge({ status, className }: { status: ProcessingStatus; className?: string }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", PROCESSING_TONE[status], className)}>{PROCESSING_LABEL[status]}</Badge>;
}

export function ReviewBadge({ status, className }: { status: ReviewStatus | null; className?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return <Badge variant="outline" className={cn("whitespace-nowrap", REVIEW_TONE[status], className)}>{REVIEW_LABEL[status]}</Badge>;
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
