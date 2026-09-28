"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Mail, Lock, KeyRound, Loader2, Check, Pencil, Copy, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { useAdminStore } from "@/lib/admin-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { AVATAR_GRADIENTS, avatarGradient } from "@/lib/avatar";
import { AdminAvatar } from "@/components/admin/admin-avatar";
import { AvatarUploadDialog } from "@/components/admin/avatar-upload-dialog";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-destructive">{message}</p>;
}

function SectionCard({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 border-border/50 bg-card/60">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function AvatarPicker() {
  const admin = useAdminStore((s) => s.admin)!;
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pick = async (color: string) => {
    if (color === admin.avatarColor || saving) return;
    setSaving(true);
    try {
      const res = await adminApi.patch<{ admin: typeof admin }>("/api/admin/profile", { avatarColor: color });
      setAdmin(res.admin);
      toast.success("Avatar color updated");
    } catch (err: any) {
      toast.error(err.message || "Could not update avatar color");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="group relative shrink-0 rounded-full"
        aria-label="Change profile picture"
      >
        <AdminAvatar name={admin.name} avatarColor={admin.avatarColor} avatarImage={admin.avatarImage} size="lg" className="ring-4" />
        <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
          <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      </button>
      <div>
        <p className="text-sm font-medium mb-1">Profile picture</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="mb-2.5">
          <Camera className="h-3.5 w-3.5" /> {admin.avatarImage ? "Change photo" : "Upload photo"}
        </Button>
        {!admin.avatarImage && (
          <div className="flex gap-2">
            {Object.keys(AVATAR_GRADIENTS).map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                disabled={saving}
                onClick={() => pick(color)}
                className={cn(
                  "h-7 w-7 rounded-full bg-gradient-to-br transition-transform hover:scale-110 disabled:opacity-50",
                  avatarGradient(color),
                  admin.avatarColor === color && "ring-2 ring-offset-2 ring-offset-card ring-foreground"
                )}
              />
            ))}
          </div>
        )}
      </div>
      <AvatarUploadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function NameField() {
  const admin = useAdminStore((s) => s.admin)!;
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(admin.name);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    try {
      const res = await adminApi.patch<{ admin: typeof admin }>("/api/admin/profile", { name });
      setAdmin(res.admin);
      toast.success("Name updated");
      setEditing(false);
    } catch (err: any) {
      setError(err.message || "Could not update name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Label>Full name</Label>
      {!editing ? (
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-medium">{admin.name}</p>
          <Button variant="outline" size="sm" onClick={() => { setName(admin.name); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <Input
            aria-invalid={!!error}
            className={cn("h-11 text-base bg-background/60", error && "bg-destructive/10")}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
          />
          <FieldError message={error} />
          <div className="flex gap-2">
            <Button size="sm" disabled={loading} onClick={save}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailField() {
  const admin = useAdminStore((s) => s.admin)!;
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<"idle" | "otp">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => { setEditing(false); setStep("idle"); setNewEmail(""); setCode(""); setError(""); };

  const requestOtp = async () => {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(newEmail.trim())) { setError("Enter a valid email address"); return; }
    setLoading(true);
    try {
      const res = await adminApi.post<{ devOtp: string; newEmail: string }>("/api/admin/profile/email/request", { newEmail });
      setDevOtp(res.devOtp);
      setCode(res.devOtp);
      setStep("otp");
      setError("");
      toast.success("OTP sent to the new email");
    } catch (err: any) {
      setError(err.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const res = await adminApi.post<{ admin: typeof admin }>("/api/admin/profile/email/verify", { newEmail, code });
      setAdmin(res.admin);
      toast.success("Email updated");
      reset();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Label>Email address</Label>
      {!editing ? (
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-medium">{admin.email}</p>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Change
          </Button>
        </div>
      ) : step === "idle" ? (
        <div className="mt-2 space-y-2">
          <Input
            aria-invalid={!!error}
            className={cn("h-11 text-base bg-background/60", error && "bg-destructive/10")}
            type="email"
            placeholder="new-admin@hekims.connect"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setError(""); }}
          />
          <FieldError message={error} />
          <div className="flex gap-2">
            <Button size="sm" disabled={loading} onClick={requestOtp}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Send OTP
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}><X className="h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="text-foreground font-medium">{newEmail}</span>
          </p>
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-accent">Demo OTP (visible in dev mode)</p>
              <p className="font-serif text-xl font-bold tracking-[0.3em] mt-0.5">{devOtp}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(devOtp); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-11 w-11" />
              <InputOTPSlot index={1} className="h-11 w-11" />
              <InputOTPSlot index={2} className="h-11 w-11" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="h-11 w-11" />
              <InputOTPSlot index={4} className="h-11 w-11" />
              <InputOTPSlot index={5} className="h-11 w-11" />
            </InputOTPGroup>
          </InputOTP>
          <FieldError message={error} />
          <div className="flex gap-2">
            <Button size="sm" disabled={loading} onClick={verifyOtp}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Verify & Update
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}><X className="h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminProfilePage() {
  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Update Profile</h1>
        <p className="text-muted-foreground mt-1.5">Manage your profile picture, name and email address.</p>
      </div>
      <div className="max-w-2xl space-y-5">
        <SectionCard icon={User} title="Update Profile" description="Your profile picture, name and email address.">
          <div className="space-y-6">
            <AvatarPicker />
            <div className="h-px bg-border/50" />
            <NameField />
            <div className="h-px bg-border/50" />
            <EmailField />
          </div>
        </SectionCard>
        <Card className="p-6 border-border/50 bg-card/60 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold">Password</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Change your account password.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/profile/password">Change Password</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
