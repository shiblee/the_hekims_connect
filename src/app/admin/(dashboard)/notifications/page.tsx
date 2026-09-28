"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Save, Mail, Send, FileText, History, CheckCircle2, XCircle, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/utils";

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
    <Card className="p-6 border-border/50 bg-card/60 max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">SMTP Configuration</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Used to send OTP and notification emails.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label className="text-xs text-muted-foreground">Enabled</Label>
          <Switch checked={config.active} onCheckedChange={toggleActive} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={form.provider === "ses" ? "ses" : "smtp"} onValueChange={setProvider}>
            <SelectTrigger className="h-11 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="smtp">Custom SMTP</SelectItem>
              <SelectItem value="ses">Amazon SES</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.provider === "ses" && (
          <div className="space-y-1.5">
            <Label>AWS Region</Label>
            <Select value={sesRegion} onValueChange={applySesRegion}>
              <SelectTrigger className="h-11 bg-background/60"><SelectValue placeholder="Select a region" /></SelectTrigger>
              <SelectContent>
                {SES_REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label} ({r.value})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>SMTP Host</Label>
          <Input className="h-11 bg-background/60" placeholder="smtp.sendgrid.net" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>SMTP Port</Label>
          <Input className="h-11 bg-background/60" placeholder="587" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Encryption</Label>
          <Select value={form.encryption} onValueChange={(v) => setForm((f) => ({ ...f, encryption: v }))}>
            <SelectTrigger className="h-11 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="ssl">SSL</SelectItem>
              <SelectItem value="tls">TLS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{form.provider === "ses" ? "SES SMTP Username" : "Username"}</Label>
          <Input
            className="h-11 bg-background/60"
            placeholder={form.provider === "ses" ? "AKIA… (SES SMTP username, not your AWS access key)" : undefined}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{form.provider === "ses" ? "SES SMTP Password" : "Password / API Key"} {config.hasSecret && <span className="text-muted-foreground font-normal">(already set — leave blank to keep)</span>}</Label>
          <Input
            className="h-11 bg-background/60"
            type="password"
            placeholder={config.hasSecret ? "••••••••••••" : form.provider === "ses" ? "SES SMTP password (not your AWS secret key)" : "Enter password or API key"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          {form.provider === "ses" && (
            <p className="text-xs text-muted-foreground">
              Generate these in the SES console under SMTP Settings → Create SMTP Credentials — they're different from your AWS access key/secret.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>From Email</Label>
          <Input className="h-11 bg-background/60" type="email" placeholder="care@hekims.connect" value={form.fromEmail} onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))} />
          {form.provider === "ses" && (
            <p className="text-xs text-muted-foreground">Must be a verified identity (email or domain) in SES for this region — SES rejects sends from unverified addresses.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>From Name</Label>
          <Input className="h-11 bg-background/60" placeholder="The Hekim's Connect" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Reply-To Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input className="h-11 bg-background/60" type="email" value={form.replyTo} onChange={(e) => setForm((f) => ({ ...f, replyTo: e.target.value }))} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Configuration
        </Button>
        <Button size="sm" variant="outline" disabled={testing} onClick={sendTest}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Test Email Configuration
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {config.active
          ? "Emails send via the SMTP settings above. Use Test Email Configuration to confirm delivery."
          : "Email sending is disabled — toggle Enabled above and save real SMTP credentials to send live emails. Until then, OTP/welcome emails are only logged to Notification History."}
      </p>
    </Card>
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

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  if (templates.length === 0) {
    return <p className="text-muted-foreground text-sm">No email templates found.</p>;
  }

  return (
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

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (logs.length === 0) {
    return <p className="text-muted-foreground text-sm">No notifications recorded yet.</p>;
  }

  return (
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
  );
}

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1.5">Email configuration, templates and delivery history.</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="mb-6">
          <TabsTrigger value="config"><Mail className="h-3.5 w-3.5 mr-1.5" /> Email Configuration</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-3.5 w-3.5 mr-1.5" /> Email Templates</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" /> Notification History</TabsTrigger>
        </TabsList>
        <TabsContent value="config"><EmailConfigTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
