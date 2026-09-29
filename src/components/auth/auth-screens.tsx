"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail, Lock, User, Phone, Stethoscope, Heart, Eye, EyeOff,
  Loader2, ArrowLeft, ShieldCheck, Copy, Check, RefreshCw, KeyRound, Leaf,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { api, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator,
} from "@/components/ui/input-otp";
import { FloatingField, FieldError } from "@/components/shared/floating-field";
import { cn } from "@/lib/utils";

type AuthRole = "hakim" | "patient";
type AuthMode = "login" | "signup";

function AuthLayout({ role, children }: { role: AuthRole; children: React.ReactNode }) {
  const isHakim = role === "hakim";
  return (
    <div className="flex-1 grid lg:grid-cols-2 min-h-[640px] lg:min-h-[780px]">
      {/* Left brand panel */}
      <div className={cn(
        "relative hidden lg:flex flex-col justify-center py-12 pl-6 sm:pl-16 pr-12 overflow-hidden",
        isHakim ? "bg-gradient-to-br from-primary/10 via-card to-card" : "bg-gradient-to-br from-accent/10 via-card to-card"
      )}>
        <div className="absolute inset-0 pattern-unani opacity-40" />
        <div className={cn("absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl", isHakim ? "bg-primary/20" : "bg-accent/20")} />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl bg-primary/10" />
        <div className="relative">
          <h2 className="font-serif text-4xl font-bold leading-tight max-w-md">
            {isHakim
              ? "Restore balance, one Mizaj at a time."
              : "Your healing, harmonised and in your hands."}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-md leading-relaxed">
            The body heals by the balance of the four humours — Dam, Safra,
            Balgham, Sauda. The Hekim&apos;s Connect keeps that wisdom at the
            heart of modern care.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              "OTP-secured two-step authentication",
              "Mizaj-driven, classical Unani workflow",
              "Privacy-first, end-to-end encrypted messaging",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-lg text-foreground/80">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" /> {f}
              </li>
            ))}
          </ul>
          <div className="relative flex items-center gap-2 text-base text-muted-foreground mt-9">
            <Leaf className="h-5 w-5 text-primary" /> Rooted in classical Unani Tibb
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}

function RoleTabs({ role, mode }: { role: AuthRole; mode: AuthMode }) {
  const router = useRouter();
  const go = (r: AuthRole) => router.push(`/${mode === "login" ? "login" : "register"}/${r}`);
  return (
    <div className="mb-8 grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => go("hakim")}
        className={cn(
          "relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full border text-base font-medium transition-colors duration-300",
          role === "hakim"
            ? "border-transparent text-primary-foreground"
            : "border-input bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
        )}
      >
        {role === "hakim" && (
          <motion.span
            layoutId="role-tab-pill"
            className="absolute inset-0 rounded-full bg-primary glow-teal"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <Stethoscope className="h-5 w-5" /> Hakim
        </span>
      </button>
      <button
        type="button"
        onClick={() => go("patient")}
        className={cn(
          "relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full border text-base font-medium transition-colors duration-300",
          role === "patient"
            ? "border-transparent text-accent-foreground"
            : "border-input bg-card text-muted-foreground hover:border-accent/50 hover:text-foreground"
        )}
      >
        {role === "patient" && (
          <motion.span
            layoutId="role-tab-pill"
            className="absolute inset-0 rounded-full bg-accent glow-gold"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <Heart className="h-5 w-5" /> Patient
        </span>
      </button>
    </div>
  );
}

const validate = {
  required: (v: string, label: string) => (!v?.trim() ? `${label} is required` : ""),
  email: (v: string) => (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "Enter a valid email address" : ""),
  phone: (v: string) => (v.replace(/\D/g, "").length !== 10 ? "Enter a valid 10-digit mobile number" : ""),
  password: (v: string) => {
    if (v.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(v)) return "Password must include at least one uppercase letter";
    if (!/[0-9]/.test(v)) return "Password must include at least one number";
    return "";
  },
  contact: (v: string) => {
    const val = v?.trim() || "";
    if (!val) return "Email or phone is required";
    return val.includes("@") ? validate.email(val) : validate.phone(val);
  },
};

const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 10);

/** Drives the inline "Send Code" → OTP → "Verified" widget next to a contact field, before any account exists. */
function useInlineVerify(role: AuthRole) {
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

  const send = async (contact: string) => {
    setError("");
    setSending(true);
    try {
      const res = await api.post<{ devOtp: string; contact: string }>("/api/auth/otp/precheck-send", { contact, role });
      setDevOtp(res.devOtp);
      setCode(res.devOtp);
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
      await api.post("/api/auth/otp/precheck-verify", { contact, code, role });
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

function InlineVerifyBox({ iv, contact, accent = "primary" }: { iv: ReturnType<typeof useInlineVerify>; contact: string; accent?: "primary" | "accent" }) {
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
    <div className={cn("mt-2 rounded-lg border p-3", accent === "primary" ? "border-primary/20 bg-primary/5" : "border-accent/20 bg-accent/5")}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-xs text-muted-foreground">
          Demo code (dev mode): <span className="font-semibold text-foreground tracking-wider">{iv.devOtp}</span>
        </p>
        <button
          type="button"
          onClick={() => iv.send(contact)}
          disabled={iv.cooldown > 0 || iv.sending}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          {iv.cooldown > 0 ? `Resend in ${iv.cooldown}s` : "Resend"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <InputOTP maxLength={6} value={iv.code} onChange={iv.setCode}>
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
        <Button
          type="button"
          size="sm"
          disabled={iv.verifying}
          onClick={() => iv.verify(contact)}
          className={cn("h-10", accent === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-accent text-accent-foreground hover:bg-accent/90")}
        >
          {iv.verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </Button>
      </div>
      <FieldError message={iv.error} />
    </div>
  );
}

function PasswordRequirements({ value }: { value: string }) {
  if (!value) return null;
  const rules = [
    { label: "At least 8 characters", ok: value.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(value) },
    { label: "One number", ok: /[0-9]/.test(value) },
  ];
  return (
    <ul className="mt-2 space-y-1">
      {rules.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.ok ? "text-primary" : "text-muted-foreground")}>
          {r.ok ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 rounded-full border border-current shrink-0" />}
          {r.label}
        </li>
      ))}
    </ul>
  );
}

function HakimSignup() {
  const router = useRouter();
  const setHakim = useAppStore((s) => s.setHakim);
  const setView = useAppStore((s) => s.setView);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const iv = useInlineVerify("hakim");

  useEffect(() => {
    if (iv.stage === "verified") setErrors((er) => (er.contact ? { ...er, contact: "" } : er));
  }, [iv.stage]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
    if (key === "contact" && iv.stage !== "idle") iv.reset();
  };

  const sendCode = () => {
    const err = validate.contact(form.contact);
    if (err) {
      setErrors((er) => ({ ...er, contact: err }));
      return;
    }
    iv.send(form.contact);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {
      name: validate.required(form.name, "Full name"),
      contact: validate.contact(form.contact) || (iv.stage !== "verified" ? "Please verify your email or phone first" : ""),
      password: validate.required(form.password, "Password") || validate.password(form.password),
    };
    const activeErrs = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(activeErrs).length) {
      setErrors(activeErrs);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/api/auth/hakim/signup", form);
      setToken(res.token);
      setHakim(res.user);
      setView("hakim-dashboard");
      toast.success("Welcome! Your account is ready.");
      router.push("/");
    } catch (err: any) {
      const msg = err.message || "Sign up failed";
      if (/email|phone/i.test(msg)) setErrors((er) => ({ ...er, contact: msg }));
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout role="hakim">
      <div className="w-full max-w-md">
        <RoleTabs role="hakim" mode="signup" />
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Become a Hakim</h1>
          <p className="text-sm text-muted-foreground mt-1">Register your Unani practice — verified in one step.</p>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <FloatingField id="hakim-signup-name" label="Full name" icon={User} error={!!errors.name} value={form.name} onChange={(e) => setField("name", e.target.value)} />
            <FieldError message={errors.name} />
          </div>
          <div>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <FloatingField
                  id="hakim-signup-contact"
                  label="Email or phone"
                  icon={Mail}
                  error={!!errors.contact}
                  value={form.contact}
                  disabled={iv.stage === "verified"}
                  onChange={(e) => setField("contact", e.target.value)}
                />
              </div>
              {iv.stage === "idle" && (
                <Button type="button" variant="outline" className="h-14 shrink-0" disabled={iv.sending || !form.contact} onClick={sendCode}>
                  {iv.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Code"}
                </Button>
              )}
            </div>
            <FieldError message={errors.contact} />
            <InlineVerifyBox iv={iv} contact={form.contact} accent="primary" />
          </div>
          <div>
            <FloatingField
              id="hakim-signup-password"
              label="Password"
              icon={Lock}
              error={!!errors.password}
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              endAdornment={
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <FieldError message={errors.password} />
            <PasswordRequirements value={form.password} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? "Creating account…" : "Register"}
          </Button>
        </form>
        <div className="flex items-center justify-between mt-5 text-sm">
          <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <span className="text-muted-foreground">
            Already registered?{" "}
            <button onClick={() => router.push("/login/hakim")} className="text-primary hover:underline font-medium">Sign in</button>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}

function HakimLogin() {
  const router = useRouter();
  const otpPending = useAppStore((s) => s.otpPending);
  const setOtpPending = useAppStore((s) => s.setOtpPending);
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ contact: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {
      contact: validate.contact(form.contact),
      password: validate.required(form.password, "Password"),
    };
    const activeErrs = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(activeErrs).length) {
      setErrors(activeErrs);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ devOtp: string; contact: string; name: string }>("/api/auth/hakim/login", form);
      setOtpPending({ contact: res.contact, role: "hakim", code: res.devOtp, name: res.name });
      toast.success("OTP sent!");
    } catch (err: any) {
      setErrors({ password: err.message || "Login failed" });
    } finally {
      setLoading(false);
    }
  };

  const sendOtpLogin = async () => {
    const err = validate.contact(form.contact);
    if (err) {
      setErrors((er) => ({ ...er, contact: err }));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ devOtp: string; contact: string; name: string }>("/api/auth/otp/login-send", { contact: form.contact, role: "hakim" });
      setOtpPending({ contact: res.contact, role: "hakim", code: res.devOtp, name: res.name });
      toast.success("OTP sent!");
    } catch (err: any) {
      setErrors((er) => ({ ...er, contact: err.message || "Could not send OTP" }));
    } finally {
      setLoading(false);
    }
  };

  if (otpPending?.role === "hakim") {
    return <OtpPanel role="hakim" onBack={() => setOtpPending(null)} />;
  }

  return (
    <AuthLayout role="hakim">
      <div className="w-full max-w-md">
        <RoleTabs role="hakim" mode="login" />
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Welcome back, Hakim</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in securely with OTP verification.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={cn("h-9 rounded-md text-sm font-medium transition-colors", mode === "password" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("otp")}
            className={cn("h-9 rounded-md text-sm font-medium transition-colors", mode === "otp" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            OTP only
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <div>
              <FloatingField id="hakim-login-contact" label="Email or phone" icon={Mail} error={!!errors.contact} value={form.contact} onChange={(e) => setField("contact", e.target.value)} />
              <FieldError message={errors.contact} />
            </div>
            <div>
              <FloatingField
                id="hakim-login-password"
                label="Password"
                icon={Lock}
                error={!!errors.password}
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                endAdornment={
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <FieldError message={errors.password} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? "Sending OTP…" : "Continue with OTP"}
            </Button>
          </form>
        ) : (
          <div className="space-y-5">
            <div>
              <FloatingField id="hakim-login-otp-contact" label="Email or phone" icon={Mail} error={!!errors.contact} value={form.contact} onChange={(e) => setField("contact", e.target.value)} />
              <FieldError message={errors.contact} />
              <p className="text-xs text-muted-foreground mt-1.5">We'll email or text you a one-time code — no password needed.</p>
            </div>
            <Button type="button" disabled={loading} onClick={sendOtpLogin} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? "Sending OTP…" : "Send OTP"}
            </Button>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Demo Hakim:</span> colter@hekims.connect / hekim123
        </div>
        <div className="flex items-center justify-between mt-5 text-sm">
          <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <span className="text-muted-foreground">
            New here?{" "}
            <button onClick={() => router.push("/register/hakim")} className="text-primary hover:underline font-medium">Register</button>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}

function PatientSignup() {
  const router = useRouter();
  const setPatient = useAppStore((s) => s.setPatient);
  const setView = useAppStore((s) => s.setView);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const iv = useInlineVerify("patient");

  useEffect(() => {
    if (iv.stage === "verified") setErrors((er) => (er.phone ? { ...er, phone: "" } : er));
  }, [iv.stage]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
    if (key === "phone" && iv.stage !== "idle") iv.reset();
  };

  const sendCode = () => {
    const err = validate.required(form.phone, "Phone") || validate.phone(form.phone);
    if (err) {
      setErrors((er) => ({ ...er, phone: err }));
      return;
    }
    iv.send(form.phone);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {
      name: validate.required(form.name, "Full name"),
      phone: (validate.required(form.phone, "Phone") || validate.phone(form.phone)) || (iv.stage !== "verified" ? "Please verify your phone number first" : ""),
      password: validate.required(form.password, "Password") || validate.password(form.password),
    };
    const activeErrs = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(activeErrs).length) {
      setErrors(activeErrs);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/api/auth/patient/signup", form);
      setToken(res.token);
      setPatient(res.user);
      setView("patient-dashboard");
      toast.success("Welcome! Your account is ready.");
      router.push("/");
    } catch (err: any) {
      const msg = err.message || "Sign up failed";
      if (/phone/i.test(msg)) setErrors((er) => ({ ...er, phone: msg }));
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout role="patient">
      <div className="w-full max-w-md">
        <RoleTabs role="patient" mode="signup" />
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Create your patient account</h1>
          <p className="text-sm text-muted-foreground mt-1">Begin your connected healing journey — verified in one step.</p>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <FloatingField id="patient-signup-name" label="Full name" icon={User} error={!!errors.name} value={form.name} onChange={(e) => setField("name", e.target.value)} />
            <FieldError message={errors.name} />
          </div>
          <div>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <FloatingField
                  id="patient-signup-phone"
                  label="Phone (10 digits)"
                  icon={Phone}
                  inputMode="numeric"
                  maxLength={10}
                  error={!!errors.phone}
                  value={form.phone}
                  disabled={iv.stage === "verified"}
                  onChange={(e) => setField("phone", digitsOnly(e.target.value))}
                />
              </div>
              {iv.stage === "idle" && (
                <Button type="button" variant="outline" className="h-14 shrink-0" disabled={iv.sending || form.phone.length !== 10} onClick={sendCode}>
                  {iv.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Code"}
                </Button>
              )}
            </div>
            <FieldError message={errors.phone} />
            <InlineVerifyBox iv={iv} contact={form.phone} accent="accent" />
          </div>
          <div>
            <FloatingField
              id="patient-signup-password"
              label="Password"
              icon={Lock}
              error={!!errors.password}
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              endAdornment={
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <FieldError message={errors.password} />
            <PasswordRequirements value={form.password} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-accent text-accent-foreground hover:bg-accent/90 mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? "Creating account…" : "Register"}
          </Button>
        </form>
        <div className="flex items-center justify-between mt-5 text-sm">
          <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <span className="text-muted-foreground">
            Already registered?{" "}
            <button onClick={() => router.push("/login/patient")} className="text-accent hover:underline font-medium">Sign in</button>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}

function PatientLogin() {
  const router = useRouter();
  const otpPending = useAppStore((s) => s.otpPending);
  const setOtpPending = useAppStore((s) => s.setOtpPending);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {
      phone: validate.required(form.phone, "Phone") || validate.phone(form.phone),
      password: validate.required(form.password, "Password"),
    };
    const activeErrs = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(activeErrs).length) {
      setErrors(activeErrs);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ devOtp: string; contact: string; name: string }>("/api/auth/patient/login", form);
      setOtpPending({ contact: res.contact, role: "patient", code: res.devOtp, name: res.name });
      toast.success("OTP sent!");
    } catch (err: any) {
      setErrors({ password: err.message || "Login failed" });
    } finally {
      setLoading(false);
    }
  };

  if (otpPending?.role === "patient") {
    return <OtpPanel role="patient" onBack={() => setOtpPending(null)} />;
  }

  return (
    <AuthLayout role="patient">
      <div className="w-full max-w-md">
        <RoleTabs role="patient" mode="login" />
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue your healing journey.</p>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <FloatingField id="patient-login-phone" label="Phone (10 digits)" icon={Phone} inputMode="numeric" maxLength={10} error={!!errors.phone} value={form.phone} onChange={(e) => setField("phone", digitsOnly(e.target.value))} />
            <FieldError message={errors.phone} />
          </div>
          <div>
            <FloatingField
              id="patient-login-password"
              label="Password"
              icon={Lock}
              error={!!errors.password}
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              endAdornment={
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <FieldError message={errors.password} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-accent text-accent-foreground hover:bg-accent/90 mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {loading ? "Sending OTP…" : "Continue with OTP"}
          </Button>
        </form>
        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Demo Patient:</span> 9811100001 / patient123
        </div>
        <div className="flex items-center justify-between mt-5 text-sm">
          <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <span className="text-muted-foreground">
            New here?{" "}
            <button onClick={() => router.push("/register/patient")} className="text-accent hover:underline font-medium">Register</button>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}

function OtpPanel({ role, backLabel = "Different account", onBack }: { role: AuthRole; backLabel?: string; onBack: () => void }) {
  const router = useRouter();
  const { otpPending, setOtpPending, setView, setHakim, setPatient } = useAppStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (otpPending?.code) setCode(otpPending.code);
  }, [otpPending?.code]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const isHakim = role === "hakim";

  // No pending verification for this role (e.g. link opened directly, or the
  // dev-mode OTP session expired) — point the user back to sign in instead of
  // force-redirecting them away.
  if (!otpPending || otpPending.role !== role) {
    return (
      <AuthLayout role={role}>
        <div className="w-full max-w-md text-center">
          <div className={cn("mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4", isHakim ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold">Nothing to verify</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Your verification session has expired or this page was opened directly.
            Sign in again to receive a fresh OTP.
          </p>
          <Button
            className={cn("mt-6", isHakim ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-accent text-accent-foreground hover:bg-accent/90")}
            onClick={onBack}
          >
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const verify = async () => {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/api/auth/otp/verify", {
        contact: otpPending.contact, code, role: otpPending.role,
      });
      setToken(res.token);
      if (otpPending.role === "hakim") {
        setHakim(res.user);
        setView("hakim-dashboard");
      } else {
        setPatient(res.user);
        setView("patient-dashboard");
      }
      setOtpPending(null);
      toast.success("Verified! Welcome.");
      router.push("/");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try {
      const res = await api.post<{ devOtp: string }>("/api/auth/otp/send", {
        contact: otpPending.contact, role: otpPending.role,
      });
      setOtpPending({ ...otpPending, code: res.devOtp });
      setCode(res.devOtp);
      setCooldown(30);
      toast.success("A fresh OTP has been sent");
    } catch (err: any) {
      toast.error(err.message || "Could not resend OTP");
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(otpPending.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AuthLayout role={otpPending.role}>
      <div className="w-full max-w-md">
        <RoleTabs role={otpPending.role} mode="login" />
        <div className="mb-6 text-center">
          <div className={cn("mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4", isHakim ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent")}>
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold">Secure Verification</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Enter the 6-digit code sent to
            <br />
            <span className="text-foreground font-medium">{otpPending.contact}</span>
          </p>
        </div>

        {/* Dev-mode OTP banner */}
        <div className="mb-5 rounded-lg border border-accent/30 bg-accent/10 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-accent">Demo OTP (visible in dev mode)</p>
              <p className="font-serif text-2xl font-bold tracking-[0.3em] text-foreground mt-0.5">{otpPending.code}</p>
            </div>
            <Button size="sm" variant="outline" onClick={copyCode} className="border-accent/40 text-accent hover:bg-accent/10">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v)}>
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
              <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button onClick={verify} disabled={loading} className={cn("w-full h-12 text-base", isHakim ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-accent text-accent-foreground hover:bg-accent/90")}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? "Verifying…" : "Verify & Continue"}
        </Button>

        <div className="flex items-center justify-between mt-5 text-sm">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </button>
          <button
            onClick={resend}
            disabled={cooldown > 0}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

/** Standalone /verify/[role] route — kept for deep links; normal signup/login now verify inline. */
function VerifyOtp({ role }: { role: AuthRole }) {
  const router = useRouter();
  const setOtpPending = useAppStore((s) => s.setOtpPending);
  return (
    <OtpPanel
      role={role}
      onBack={() => { setOtpPending(null); router.push(`/login/${role}`); }}
    />
  );
}

export { HakimSignup, HakimLogin, PatientSignup, PatientLogin, VerifyOtp };
