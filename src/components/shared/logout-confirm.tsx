"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, LogOut } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * "Log out?" confirmation used by every account type (clinic, staff, patient, admin).
 * The session is only ended after the person confirms.
 */
export function LogoutConfirm({ open, onOpenChange, onConfirm, who }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  /** Shown in the message, e.g. the clinic or person's name. */
  who?: string | null;
}) {
  const t = useTranslations("common.logout_confirm");
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto sm:mx-0 mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LogOut className="h-5 w-5 rtl:rotate-180" />
          </div>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{who ? t("body_who", { who }) : t("body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("stay")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => { e.preventDefault(); confirm(); }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 rtl:rotate-180" />}
            {busy ? t("busy") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
