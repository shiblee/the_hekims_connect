"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { FieldError } from "@/components/shared/floating-field";

interface ApiClient {
  post: <T = any>(url: string, body?: any) => Promise<T>;
}

/**
 * Drives an inline "Send Code" -> OTP -> "Verified" widget for a contact field,
 * generalized from the signup flow's useInlineVerify (src/components/auth/auth-screens.tsx)
 * so it can point at any send/verify endpoint pair (e.g. facility- or admin-authenticated
 * staff-contact verification) rather than only the public precheck routes.
 */
export function useInlineContactVerify(client: ApiClient, sendUrl: string, verifyUrl: string) {
  const [stage, setStage] = useState<"idle" | "sent" | "verified">("idle");
  const [devOtp, setDevOtp] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const send = async (contact: string, name?: string) => {
    setError("");
    setSending(true);
    try {
      const res = await client.post<{ devOtp?: string; contact: string }>(sendUrl, { contact, name });
      setDevOtp(res.devOtp ?? "");
      setCode(res.devOtp ?? "");
      setStage("sent");
      setCooldown(30);
      toast.success("Verification code sent");
    } catch (err: any) {
      setError(err.message || "Could not send code");
    } finally {
      setSending(false);
    }
  };

  const verify = async (contact: string) => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      await client.post(verifyUrl, { contact, code });
      setStage("verified");
      toast.success("Verified");
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setStage("idle");
    setDevOtp("");
    setCode("");
    setError("");
    setCooldown(0);
  };

  return { stage, devOtp, code, setCode, sending, verifying, cooldown, error, send, verify, reset };
}

export function InlineVerifyBox({ iv, contact, name }: { iv: ReturnType<typeof useInlineContactVerify>; contact: string; name?: string }) {
  if (iv.stage === "idle") return iv.error ? <FieldError message={iv.error} /> : null;

  if (iv.stage === "verified") {
    return (
      <div className="mt-2 flex items-center gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Check className="h-4 w-4" /> Verified
        </p>
        <button type="button" onClick={iv.reset} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        {iv.devOtp ? (
          <p className="text-xs text-muted-foreground">
            Demo code (dev mode): <span className="font-semibold text-foreground tracking-wider">{iv.devOtp}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">We sent a 6-digit code — check your inbox.</p>
        )}
        <button
          type="button"
          onClick={() => iv.send(contact, name)}
          disabled={iv.cooldown > 0 || iv.sending}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          {iv.cooldown > 0 ? `Resend in ${iv.cooldown}s` : "Resend"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InputOTP maxLength={6} value={iv.code} onChange={iv.setCode} containerClassName="flex-wrap">
          <InputOTPGroup>
            <InputOTPSlot index={0} className="h-9 w-7 sm:w-8 text-sm" />
            <InputOTPSlot index={1} className="h-9 w-7 sm:w-8 text-sm" />
            <InputOTPSlot index={2} className="h-9 w-7 sm:w-8 text-sm" />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} className="h-9 w-7 sm:w-8 text-sm" />
            <InputOTPSlot index={4} className="h-9 w-7 sm:w-8 text-sm" />
            <InputOTPSlot index={5} className="h-9 w-7 sm:w-8 text-sm" />
          </InputOTPGroup>
        </InputOTP>
        <Button
          type="button"
          size="sm"
          disabled={iv.verifying}
          onClick={() => iv.verify(contact)}
          className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {iv.verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </Button>
      </div>
      <FieldError message={iv.error} />
    </div>
  );
}
