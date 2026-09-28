"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminApi, setAdminToken } from "@/lib/admin-api";
import { useAdminStore } from "@/lib/admin-store";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingField, FieldError } from "@/components/shared/floating-field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function randomCaptcha() {
  return { a: Math.floor(Math.random() * 10) + 1, b: Math.floor(Math.random() * 10) + 1 };
}

export function AdminLoginForm() {
  const router = useRouter();
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState<{ a: number; b: number } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  // Generated client-side only, after hydration, so the numbers can't
  // mismatch between server and client render.
  useEffect(() => {
    setCaptcha(randomCaptcha());
  }, []);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: "" } : er));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {
      email: !form.email.trim() ? "Email is required" : !EMAIL_RE.test(form.email.trim()) ? "Enter a valid email address" : "",
      password: !form.password ? "Password is required" : "",
      captcha: !captcha
        ? ""
        : !captchaAnswer.trim()
          ? "Answer the check above"
          : Number(captchaAnswer) !== captcha.a + captcha.b
            ? "That's not quite right"
            : "",
    };
    const active = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    if (Object.keys(active).length) {
      setErrors(active);
      if (active.captcha) {
        setCaptcha(randomCaptcha());
        setCaptchaAnswer("");
      }
      return;
    }
    setLoading(true);
    try {
      const res = await adminApi.post<{ token: string; admin: { id: string; name: string; email: string; avatarColor: string; avatarImage: string | null } }>(
        "/api/admin/auth/login",
        form
      );
      setAdminToken(res.token, remember);
      setAdmin(res.admin);
      toast.success(`Welcome back, ${res.admin.name}`);
      router.push("/admin");
    } catch (err: any) {
      setErrors({ password: err.message || "Login failed" });
      setCaptcha(randomCaptcha());
      setCaptchaAnswer("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16">
          <div className="flex h-16 items-center justify-end">
            <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to site
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <BrandLogo size={76} />
            </div>
            <h1 className="font-serif text-2xl font-bold">Admin Sign In</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Sign in with your administrator credentials.</p>
          </div>

          <form onSubmit={submit} className="space-y-5" noValidate>
            <div>
              <FloatingField
                id="admin-email"
                label="Email"
                icon={Mail}
                error={!!errors.email}
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
              <FieldError message={errors.email} />
            </div>
            <div>
              <FloatingField
                id="admin-password"
                label="Password"
                icon={Lock}
                error={!!errors.password}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <FieldError message={errors.password} />
            </div>

            <div>
              <FloatingField
                id="admin-captcha"
                label={captcha ? `Quick check: ${captcha.a} + ${captcha.b} =` : "Quick check"}
                error={!!errors.captcha}
                inputMode="numeric"
                autoComplete="off"
                value={captchaAnswer}
                onChange={(e) => {
                  setCaptchaAnswer(e.target.value.replace(/[^0-9-]/g, ""));
                  setErrors((er) => (er.captcha ? { ...er, captcha: "" } : er));
                }}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => {
                      setCaptcha(randomCaptcha());
                      setCaptchaAnswer("");
                    }}
                    aria-label="Get new numbers"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                }
              />
              <FieldError message={errors.captcha} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="remember-me" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <label htmlFor="remember-me" className="cursor-pointer select-none text-sm text-muted-foreground">
                Remember me on this device
              </label>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Demo Admin:</span> admin@hekims.connect / admin12345
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} The Hekim&apos;s Connect. All rights reserved.
      </footer>
    </div>
  );
}
