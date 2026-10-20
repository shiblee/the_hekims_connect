"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, CheckCircle2, KeyRound, Loader2, PlugZap, Trash2, XCircle } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FloatingField } from "@/components/shared/floating-field";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface State {
  configured: boolean; active: boolean; keyHint: string | null; updatedAt: string | null;
  pilot?: { mode: "all" | "selected"; clinics: string[] }; clinics?: { id: string; name: string }[];
}

const USES = [
  "Hakeem Insight — triage priority and humoral explanation",
  "Vitals insight",
  "Reading uploaded lab and imaging reports",
  "Ranking suggestions in Dala'il, Tashkhees, Usool-e-Ilaj, Ghiza and decision support",
  "Catalogue assistants (chief complaints, allergies, medicines, supplements)",
  "Draft translations for guidance",
];

const PROVIDERS = {
  gemini: {
    title: "AI service (Google Gemini)", keyLabel: "Gemini API key", company: "Google", where: "Create one in Google AI Studio → API keys, then paste it here.", uses: USES,
    note: "Paid by usage. When it's off, nothing is sent to Google and nothing is charged — AI features say they're switched off and everything else keeps working.",
  },
  anthropic: {
    title: "Clinical reasoning (Anthropic Claude)", keyLabel: "Anthropic API key", company: "Anthropic", where: "Create one in the Anthropic Console → API keys (it starts with sk-ant-), then paste it here.",
    uses: ["Stage 5 Hakeem Insight — case summary, contradictions, missing information, differential reasoning and a draft Tashkhees statement (only when a Hakim asks)"],
    note: "Paid by usage, only when a Hakim asks for a reasoning run. Only de-identified clinical facts are sent — no names, phone numbers or IDs. When it's off, Stage 5 keeps working on its rule engines.",
  },
} as const;

/** Admin → Settings → General: an AI provider's key and the switch its features respect. */
export function AiServiceCard({ provider = "gemini" }: { provider?: keyof typeof PROVIDERS }) {
  const P = PROVIDERS[provider];
  const [s, setS] = useState<State | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"" | "toggle" | "save" | "test" | "remove">("");
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(() => adminApi.get<State>(`/api/admin/integrations/${provider}`).then(setS).catch(() => toast.error("Couldn't load the AI service settings")), []);
  useEffect(() => { load(); }, [load]);

  const put = async (body: Record<string, unknown>, kind: typeof busy, done: string) => {
    setBusy(kind);
    try { setS(await adminApi.put<State>(`/api/admin/integrations/${provider}`, body)); toast.success(done); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Not saved"); return false; }
    finally { setBusy(""); }
  };

  const runTest = async () => {
    setBusy("test"); setTest(null);
    try { setTest(await adminApi.post<{ ok: boolean; message: string }>(`/api/admin/integrations/${provider}`, key.trim() ? { apiKey: key.trim() } : {})); }
    catch { setTest({ ok: false, message: "The test couldn't run." }); }
    finally { setBusy(""); }
  };

  if (!s) return <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading AI service…</div>;
  const status = !s.configured ? { label: "No key", cls: "border-border bg-muted text-muted-foreground" } : s.active ? { label: "On", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" } : { label: "Off", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" };

  return (
    <div className="space-y-4 rounded-xl border border-input bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4 text-primary" /> {P.title} <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", status.cls)}>{status.label}</span></p>
          <p className="mt-0.5 text-xs text-muted-foreground">{P.note}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          Use AI features
          <Switch checked={s.active} disabled={!s.configured || !!busy} onCheckedChange={(v) => put({ active: v }, "toggle", v ? "AI service switched on" : "AI service switched off — no more AI charges")} />
        </label>
      </div>

      <div className="grid gap-3 border-t border-input pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-1.5">
          <FloatingField id={`${provider}Key`} type="password" autoComplete="off" label={s.configured ? `Replace API key (saved key ${s.keyHint})` : P.keyLabel} value={key} onChange={(e) => { setKey(e.target.value); setTest(null); }} />
          <p className="text-xs text-muted-foreground">
            <KeyRound className="mb-0.5 mr-1 inline h-3 w-3" />
            {s.configured ? <>Stored encrypted; only the last 4 characters are ever shown.{s.updatedAt && ` Last changed ${formatDateTime(s.updatedAt)}.`}</> : P.where}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button variant="outline" disabled={!!busy || (!key.trim() && !s.configured)} onClick={runTest}>{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Test {key.trim() ? "this key" : "connection"}</Button>
          <Button disabled={!!busy || !key.trim()} onClick={async () => { if (await put({ apiKey: key.trim() }, "save", s.configured ? "API key replaced" : "API key saved")) setKey(""); }}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} {s.configured ? "Replace key" : "Save key"}</Button>
          {s.configured && <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={!!busy} onClick={() => setConfirmRemove(true)}><Trash2 className="h-4 w-4" /> Remove</Button>}
        </div>
      </div>
      {test && <p className={cn("flex items-start gap-1.5 text-sm", test.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>{test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}{test.message}</p>}
      {!s.configured || !s.active ? null : <p className="text-xs text-muted-foreground">Tip: a saved key isn&apos;t used while the switch is off, so you can keep it here and turn AI on only when you need it.</p>}

      {s.pilot && s.clinics && (
        <div className="space-y-2 border-t border-input pt-4">
          <p className="text-sm font-medium">Who can use it</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["selected", "all"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input type="radio" name={`${provider}-pilot`} checked={s.pilot!.mode === m} disabled={!!busy} onChange={() => put({ pilot: { ...s.pilot!, mode: m } }, "toggle", m === "all" ? "Available to all clinics" : "Available to selected clinics only")} />
                {m === "all" ? "All clinics" : "Selected pilot clinics only"}
              </label>
            ))}
          </div>
          {s.pilot.mode === "selected" && (
            <>
              {s.pilot.clinics.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-400">No clinic selected yet — no one can use it until you pick the pilot clinics.</p>}
              <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-input p-2">
                {s.clinics.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={s.pilot!.clinics.includes(c.id)} disabled={!!busy}
                      onChange={(e) => put({ pilot: { mode: "selected", clinics: e.target.checked ? [...s.pilot!.clinics, c.id] : s.pilot!.clinics.filter((x) => x !== c.id) } }, "toggle", "Pilot clinics updated")} />
                    <span className="min-w-0 truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground/80">What uses it</summary>
        <ul className="mt-1.5 list-disc space-y-0.5 ps-5">{P.uses.map((u) => <li key={u}>{u}</li>)}</ul>
      </details>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the {P.company} API key?</AlertDialogTitle>
            <AlertDialogDescription>The key is deleted from the platform and all AI features switch off. You can add a key again at any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={!!busy} onClick={async (e) => { e.preventDefault(); if (await put({ removeKey: true }, "remove", "API key removed — AI switched off")) setConfirmRemove(false); }}>
              {busy === "remove" && <Loader2 className="h-4 w-4 animate-spin" />} Remove key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
