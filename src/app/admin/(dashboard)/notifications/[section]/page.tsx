"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Save, Mail, Send, FileText, History, CheckCircle2, XCircle, ArrowRight,
  Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { SelectItem } from "@/components/ui/select";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

interface EmailConfig {
  id: string; provider: string; smtpHost: string | null; smtpPort: number | null;
  encryption: string; username: string | null; fromEmail: string | null; fromName: string | null;
  replyTo: string | null; active: boolean; hasSecret: boolean; updatedAt: string;
}

const SES_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "eu-north-1", label: "Europe (Stockholm)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
];
interface EmailTemplate { id: string; key: string; name: string; type: string; subject: string; status: string; updatedAt: string }
interface NotificationLogRow { id: string; recipient: string; templateKey: string | null; subject: string | null; status: string; event: string | null; error: string | null; createdAt: string }

function EmailConfigTab() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.get<{ config: EmailConfig }>("/api/admin/notifications/email-config")
      .then((res) => {
        setConfig(res.config);
        setForm({
          provider: res.config.provider,
          smtpHost: res.config.smtpHost || "",
          smtpPort: res.config.smtpPort ? String(res.config.smtpPort) : "",
          encryption: res.config.encryption,
          username: res.config.username || "",
          fromEmail: res.config.fromEmail || "",
          fromName: res.config.fromName || "",
          replyTo: res.config.replyTo || "",
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const sesRegionMatch = form.smtpHost?.match(/^email-smtp\.([a-z0-9-]+)\.amazonaws\.com$/);
  const sesRegion = form.provider === "ses" ? sesRegionMatch?.[1] || "" : "";

  const applySesRegion = (region: string) => {
    setForm((f) => ({
      ...f,
      provider: "ses",
      smtpHost: `email-smtp.${region}.amazonaws.com`,
      smtpPort: "587",
      encryption: "tls",
    }));
  };

  const setProvider = (provider: string) => {
    if (provider === "ses") {
      applySesRegion(sesRegion || "us-east-1");
    } else {
      setForm((f) => ({ ...f, provider }));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, any> = { ...form, active: config?.active };
      if (secret) body.secret = secret;
      const res = await adminApi.put<{ config: EmailConfig }>("/api/admin/notifications/email-config", body);
      setConfig(res.config);
      setSecret("");
      toast.success("Email configuration saved");
    } catch (err: any) {
      toast.error(err.message || "Could not save configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    try {
      const res = await adminApi.put<{ config: EmailConfig }>("/api/admin/notifications/email-config", { active });
      setConfig(res.config);
      toast.success(active ? "Email sending enabled" : "Email sending disabled");
    } catch (err: any) {
      toast.error(err.message || "Could not update");
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await adminApi.post<{ message: string }>("/api/admin/notifications/email-config/test", {});
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading || !config) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-lg font-semibold">SMTP Configuration</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label className="text-xs text-muted-foreground">Enabled</Label>
          <Switch checked={config.active} onCheckedChange={toggleActive} />
        </div>
      </div>

      <Card className="p-6 border-border/50 bg-card/60 w-full">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
        <FloatingSelect id="provider" label="Provider" value={form.provider === "ses" ? "ses" : "smtp"} onValueChange={setProvider}>
          <SelectItem value="smtp">Custom SMTP</SelectItem>
          <SelectItem value="ses">Amazon SES</SelectItem>
        </FloatingSelect>
        {form.provider === "ses" && (
          <FloatingSelect id="sesRegion" label="AWS Region" value={sesRegion} onValueChange={applySesRegion} placeholder="Select a region">
            {SES_REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label} ({r.value})</SelectItem>
            ))}
          </FloatingSelect>
        )}
        <FloatingField id="smtpHost" label="SMTP Host" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} />
        <FloatingField id="smtpPort" label="SMTP Port" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} />
        <FloatingSelect id="encryption" label="Encryption" value={form.encryption} onValueChange={(v) => setForm((f) => ({ ...f, encryption: v }))}>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="ssl">SSL</SelectItem>
          <SelectItem value="tls">TLS</SelectItem>
        </FloatingSelect>
        <div>
          <FloatingField
            id="username"
            label={form.provider === "ses" ? "SES SMTP Username" : "Username"}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          {form.provider === "ses" && <p className="text-xs text-muted-foreground mt-1.5 ml-1">AKIA… (SES SMTP username, not your AWS access key)</p>}
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <FloatingField
            id="secret"
            label={`${form.provider === "ses" ? "SES SMTP Password" : "Password / API Key"}${config.hasSecret ? " (already set — leave blank to keep)" : ""}`}
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          {form.provider === "ses" && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-1">
              Generate these in the SES console under SMTP Settings → Create SMTP Credentials — they're different from your AWS access key/secret.
            </p>
          )}
        </div>
        <div>
          <FloatingField id="fromEmail" label="From Email" type="email" value={form.fromEmail} onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))} />
          {form.provider === "ses" && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-1">Must be a verified identity (email or domain) in SES for this region — SES rejects sends from unverified addresses.</p>
          )}
        </div>
        <FloatingField id="fromName" label="From Name" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
        <div>
          <FloatingField id="replyTo" label="Reply-To Email (optional)" type="email" value={form.replyTo} onChange={(e) => setForm((f) => ({ ...f, replyTo: e.target.value }))} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="h-11 px-5 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Configuration
        </Button>
        <Button className="h-11 px-5 rounded-xl font-semibold" variant="outline" disabled={testing} onClick={sendTest}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Test Email Configuration
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {config.active
          ? "Emails send via the SMTP settings above. Use Test Email Configuration to confirm delivery."
          : "Email sending is disabled — toggle Enabled above and save real SMTP credentials to send live emails. Until then, OTP/welcome emails are only logged to Notification History."}
      </p>
      </Card>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get<{ templates: EmailTemplate[] }>("/api/admin/notifications/templates")
      .then((res) => setTemplates(res.templates))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionHeader icon={FileText} title="Email Templates" />
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">No email templates found.</p>
      ) : (
      <Card className="border-border/50 bg-card/60 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.key} className="border-b border-border/30 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{t.key}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.subject}</td>
                <td className="px-4 py-3">
                  {t.status === "active" ? (
                    <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Inactive</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(t.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/notifications/templates/${t.key}`}>
                      Edit <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Card>
      )}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  otp_sent: "OTP Sent", otp_resent: "OTP Resent", otp_verified: "OTP Verified",
  welcome_sent: "Welcome Email Sent", test_email: "Test Email",
};

function HistoryTab() {
  const [logs, setLogs] = useState<NotificationLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get<{ logs: NotificationLogRow[] }>("/api/admin/notifications/history")
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionHeader icon={History} title="Notification History" />
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notifications recorded yet.</p>
      ) : (
      <Card className="border-border/50 bg-card/60 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date &amp; Time</th>
              <th className="px-4 py-3 font-medium">Recipient</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-border/30 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.recipient}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.event ? EVENT_LABELS[l.event] || l.event : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.subject || "—"}</td>
                <td className="px-4 py-3">
                  {l.status === "failed" ? (
                    <Badge variant="outline" className="text-destructive border-destructive/40">Failed</Badge>
                  ) : l.status === "verified" ? (
                    <Badge className="bg-primary/15 text-primary border-primary/30">Verified</Badge>
                  ) : l.status === "sent" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Sent</Badge>
                  ) : (
                    <Badge variant="outline">Simulated</Badge>
                  )}
                  {l.error && <p className="text-xs text-destructive mt-1">{l.error}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Card>
      )}
    </div>
  );
}

const NOTIFICATION_SECTIONS: { id: string; label: string; icon: any }[] = [
  { id: "config", label: "Email Configuration", icon: Mail },
  { id: "templates", label: "Email Templates", icon: FileText },
  { id: "history", label: "Notification History", icon: History },
];

export default function NotificationSectionPage() {
  const router = useRouter();
  const { section } = useParams<{ section: string }>();

  useEffect(() => {
    if (!NOTIFICATION_SECTIONS.some((s) => s.id === section)) {
      router.replace("/admin/notifications/config");
    }
  }, [section, router]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <Card className="p-2 border-border/50 bg-card/60 h-fit">
          <div className="space-y-1">
            {NOTIFICATION_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/admin/notifications/${s.id}`)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                  section === s.id ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                )}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0">
          {section === "config" && <EmailConfigTab />}
          {section === "templates" && <TemplatesTab />}
          {section === "history" && <HistoryTab />}
        </div>
      </div>
    </div>
  );
}
