// Shared by the Mamool-e-Matab list and editor pages.
export type RegimenStatus = "draft" | "pending" | "approved" | "rejected";

export const STATUS_STYLE: Record<RegimenStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "border-border text-muted-foreground" },
  pending: { label: "Pending clinical approval", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  approved: { label: "Approved", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Rejected", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
};
