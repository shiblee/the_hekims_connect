"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Check, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { adminApi } from "@/lib/admin-api";
import { useAdminStore } from "@/lib/admin-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-destructive">{message}</p>;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const logout = useAdminStore((s) => s.logout);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {
      currentPassword: !form.currentPassword ? "Current password is required" : "",
      newPassword:
        !form.newPassword ? "New password is required"
        : form.newPassword.length < 8 ? "Must be at least 8 characters"
        : !/[A-Za-z]/.test(form.newPassword) || !/[0-9]/.test(form.newPassword) ? "Must contain letters and numbers"
        : "",
      confirmPassword:
        !form.confirmPassword ? "Please confirm your new password"
        : form.confirmPassword !== form.newPassword ? "Passwords do not match"
        : "",
    };
    const active = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(active).length) { setErrors(active); return; }

    setLoading(true);
    try {
      await adminApi.post("/api/admin/profile/password", form);
      toast.success("Password changed. Please sign in again.");
      logout();
      router.push("/admin/login");
    } catch (err: any) {
      setErrors({ currentPassword: err.message || "Could not change password" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <Link href="/admin/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
        </Link>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Change Password</h1>
        <p className="text-muted-foreground mt-1.5">You'll be signed out and need to log in again after changing it.</p>
      </div>

      <Card className="p-6 border-border/50 bg-card/60 max-w-xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Update your password</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Choose a strong password you don't use elsewhere.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <div className="relative">
              <Input
                aria-invalid={!!errors.currentPassword}
                className={cn("h-11 pr-11 text-base bg-background/60", errors.currentPassword && "bg-destructive/10")}
                type={show.currentPassword ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) => setField("currentPassword", e.target.value)}
              />
              <button type="button" onClick={() => setShow((v) => ({ ...v, currentPassword: !v.currentPassword }))} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError message={errors.currentPassword} />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <div className="relative">
              <Input
                aria-invalid={!!errors.newPassword}
                className={cn("h-11 pr-11 text-base bg-background/60", errors.newPassword && "bg-destructive/10")}
                type={show.newPassword ? "text" : "password"}
                placeholder="Min. 8 characters, letters + numbers"
                value={form.newPassword}
                onChange={(e) => setField("newPassword", e.target.value)}
              />
              <button type="button" onClick={() => setShow((v) => ({ ...v, newPassword: !v.newPassword }))} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError message={errors.newPassword} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <div className="relative">
              <Input
                aria-invalid={!!errors.confirmPassword}
                className={cn("h-11 pr-11 text-base bg-background/60", errors.confirmPassword && "bg-destructive/10")}
                type={show.confirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
              />
              <button type="button" onClick={() => setShow((v) => ({ ...v, confirmPassword: !v.confirmPassword }))} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError message={errors.confirmPassword} />
          </div>
          <Button type="submit" disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Change Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
