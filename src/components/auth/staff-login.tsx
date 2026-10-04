"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, RefreshCw, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { api, setToken } from "@/lib/api";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { FloatingField, FieldError } from "@/components/shared/floating-field";

const isEmailLike = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhoneLike = (v: string) => /^\+?[0-9]{7,15}$/.test(v.trim());

/**
 * Staff login is OTP-only — staff accounts are created by a facility or admin without
 * a password (see the Staff module), so there's nothing to "forget": signing in is
 * always just a code to the registered email, or shown on screen for a phone since
 * there's no SMS gateway integrated yet.
 */
export function StaffLogin() {
  const router = useRouter();
  const setStaff = useAppStore((s) => s.setStaff);

  const [contact, setContact] = useState("");
  const [contactError, setContactError] = useState("");
  const [sending, setSending] = useState(false);

  const [stage, setStage] = useState<"form" | "otp">("form");
  const [otpContact, setOtpContact] = useState("");
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const copyCode = () => {
    navigator.clipboard?.writeText(devCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const send = async () => {
    const val = contact.trim();
    if (!val) { setContactError("Email or phone is required"); return; }
    if (!isEmailLike(val) && !isPhoneLike(val)) { setContactError("Enter a valid email address or phone number"); return; }
    setContactError("");
    setSending(true);
    try {
      const res = await api.post<{ devOtp?: string; contact: string; name: string }>("/api/auth/otp/login-send", { contact: val, role: "staff" });
      toast.success("OTP sent!");
      setOtpContact(res.contact);
      setDevCode(res.devOtp ?? "");
      setCode(res.devOtp ?? "");
      setOtpError("");
      setCooldown(30);
      setStage("otp");
    } catch (err: any) {
      setContactError(err.message || "Could not send OTP");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try {
      const res = await api.post<{ devOtp?: string }>("/api/auth/otp/login-send", { contact: otpContact, role: "staff" });
      setDevCode(res.devOtp ?? "");
      setCode(res.devOtp ?? "");
      setCooldown(30);
      toast.success("A fresh OTP has been sent");
    } catch (err: any) {
      toast.error(err.message || "Could not resend OTP");
    }
  };

  const verify = async () => {
    if (code.length !== 6) { setOtpError("Enter the 6-digit code"); return; }
    setVerifying(true);
    setOtpError("");
    try {
      const res = await api.post<{ token: string; user: any }>("/api/auth/otp/verify", { contact: otpContact, code, role: "staff" });
      setToken(res.token);
      setStaff(res.user);
      toast.success("Verified! Welcome.");
      router.push("/staff");
    } catch (err: any) {
      setOtpError(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const editContact = () => {
    setStage("form");
    setCode("");
    setOtpError("");
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-6">
            <BrandLogo size={76} />
          </div>
          <h1 className="font-serif text-2xl font-bold">Staff Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Sign in securely with a one-time code.</p>
        </div>

          {stage === "form" ? (
            <div className="space-y-5">
              <div>
                <FloatingField
                  id="staff-contact"
                  label="Email or phone"
                  error={!!contactError}
                  value={contact}
                  onChange={(e) => { setContact(e.target.value); setContactError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                />
                <FieldError message={contactError} />
              </div>
              <Button type="button" className="w-full h-11" disabled={sending} onClick={send}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Send code
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  {devCode ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Demo code (dev mode): <span className="font-semibold text-foreground tracking-wider">{devCode}</span>
                      </p>
                      <button type="button" onClick={copyCode} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy code">
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">We sent a 6-digit code — check your inbox.</p>
                  )}
                  <button
                    type="button"
                    onClick={resend}
                    disabled={cooldown > 0}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
                  </button>
                </div>
                <div className="flex justify-center py-1">
                  <InputOTP maxLength={6} value={code} onChange={setCode} containerClassName="flex-wrap">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-10 w-9 text-sm" />
                      <InputOTPSlot index={1} className="h-10 w-9 text-sm" />
                      <InputOTPSlot index={2} className="h-10 w-9 text-sm" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="h-10 w-9 text-sm" />
                      <InputOTPSlot index={4} className="h-10 w-9 text-sm" />
                      <InputOTPSlot index={5} className="h-10 w-9 text-sm" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <FieldError message={otpError} />
              </div>

              <Button type="button" className="w-full h-11" disabled={verifying} onClick={verify}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify & Sign In
              </Button>
              <button type="button" onClick={editContact} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                Use a different email or phone
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
