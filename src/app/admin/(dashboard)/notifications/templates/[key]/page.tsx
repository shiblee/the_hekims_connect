"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Eye, Send, Info } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface EmailTemplate { id: string; key: string; name: string; type: string; subject: string; body: string; status: string; updatedAt: string; updatedBy: string | null }

const PLACEHOLDER_HINTS: Record<string, string[]> = {
  hakim_otp_verification: ["{{hakim_name}}", "{{otp}}", "{{otp_validity}}", "{{portal_name}}"],
  hakim_welcome: ["{{hakim_name}}", "{{hakim_email}}", "{{portal_name}}", "{{registration_date}}", "{{login_url}}"],
};

export default function EmailTemplateEditorPage() {
  const { key } = useParams<{ key: string }>();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    adminApi.get<{ template: EmailTemplate }>(`/api/admin/notifications/templates/${key}`)
      .then((res) => {
        setTemplate(res.template);
        setSubject(res.template.subject);
        setBody(res.template.body);
        setActive(res.template.status === "active");
      })
      .finally(() => setLoading(false));
  }, [key]);

  const save = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.put<{ template: EmailTemplate }>(`/api/admin/notifications/templates/${key}`, {
        subject, body, status: active ? "active" : "inactive",
      });
      setTemplate(res.template);
      toast.success("Template saved");
    } catch (err: any) {
      toast.error(err.message || "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await adminApi.post<{ subject: string; body: string }>(`/api/admin/notifications/templates/${key}/preview`, { subject, body });
      setPreview(res);
    } catch (err: any) {
      toast.error(err.message || "Could not render preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await adminApi.post<{ message: string }>(`/api/admin/notifications/templates/${key}/test`, {});
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Could not send test email");
    } finally {
      setTesting(false);
    }
  };

  if (loading || !template) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }

  const hints = PLACEHOLDER_HINTS[key] || [];

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/notifications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Notifications
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{template.name}</h1>
          <p className="text-muted-foreground mt-1.5">
            {template.type} template · Last updated {new Date(template.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Active</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 max-w-5xl">
        <Card className="p-6 border-border/50 bg-card/60 lg:col-span-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input className="h-11 bg-background/60" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email Body</Label>
              <Textarea className="min-h-[280px] bg-background/60 font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            <Button size="sm" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Template
            </Button>
            <Button size="sm" variant="outline" onClick={openPreview}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button size="sm" variant="outline" disabled={testing} onClick={sendTest}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Test Email
            </Button>
          </div>
        </Card>

        <Card className="p-5 border-border/50 bg-card/60 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Available placeholders</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hints.map((h) => (
              <code key={h} className="rounded bg-background/60 border border-border/50 px-2 py-1 text-xs text-primary">{h}</code>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            These are replaced with real values when the email is sent.
          </p>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>Rendered with sample data, exactly as a recipient would see it.</DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Rendering…</div>
          ) : preview ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject</p>
                <p className="text-sm font-medium">{preview.subject}</p>
              </div>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <iframe title="Email preview" srcDoc={preview.body} sandbox="" className="w-full h-[480px] bg-white" />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
