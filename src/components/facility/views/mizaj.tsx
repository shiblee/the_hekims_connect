"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Activity, Heart, Droplet, Flame, Moon, Save, Loader2, History } from "lucide-react";

const AKHLAT = [
  { key: "dam", name: "Dam", en: "Blood", quality: "Hot & Moist", color: "oklch(0.62 0.2 25)", icon: Heart, tint: "text-red-300", bg: "bg-red-500/15" },
  { key: "saffra", name: "Safra", en: "Yellow Bile", quality: "Hot & Dry", color: "oklch(0.78 0.14 80)", icon: Flame, tint: "text-amber-300", bg: "bg-amber-500/15" },
  { key: "balgham", name: "Balgham", en: "Phlegm", quality: "Cold & Moist", color: "oklch(0.7 0.13 220)", icon: Droplet, tint: "text-sky-300", bg: "bg-sky-500/15" },
  { key: "suda", name: "Sauda", en: "Black Bile", quality: "Cold & Dry", color: "oklch(0.5 0.15 300)", icon: Moon, tint: "text-violet-300", bg: "bg-violet-500/15" },
];

export function MizajView() {
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [scores, setScores] = useState({ dam: 25, saffra: 25, balgham: 25, suda: 25 });
  const [pulse, setPulse] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadPatients = async () => {
    const r = await api.get<{ patients: any[] }>("/api/facility/patients");
    setPatients(r.patients || []);
  };
  const loadHistory = async () => {
    const r = await api.get<{ assessments: any[] }>("/api/mizaj");
    setHistory(r.assessments || []);
  };

  useEffect(() => { loadPatients(); loadHistory(); }, []);

  const total = scores.dam + scores.saffra + scores.balgham + scores.suda || 1;
  const dominant = AKHLAT.reduce((max, a) => ((scores as any)[a.key] > (scores as any)[max.key] ? a : max), AKHLAT[0]);
  const dominantName = dominant.name;

  const save = async () => {
    if (!patientId) { toast.error("Select a patient first"); return; }
    setSaving(true);
    try {
      await api.post("/api/mizaj", { patientId, ...scores, pulse, notes });
      toast.success("Mizaj assessment saved & patient mizaj updated");
      setScores({ dam: 25, saffra: 25, balgham: 25, suda: 25 });
      setPulse(""); setNotes("");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Could not save assessment");
    } finally { setSaving(false); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-5">
      <div className="space-y-5 min-w-0">
        <div>
          <h2 className="font-serif text-xl font-bold">Mizaj Assessment</h2>
          <p className="text-sm text-muted-foreground">Score the four Akhlat to determine the patient&apos;s dominant temperament.</p>
        </div>

        {/* Patient selector */}
        <Card className="p-5 border-border/50 bg-card/60">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Select Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger className="mt-1.5 bg-background/60"><SelectValue placeholder="Choose a patient…" /></SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} {p.mizaj ? `· ${p.mizaj}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Sliders */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold">Akhlat Scoring</h3>
            <Badge className={cn(dominant.tint, dominant.bg, "border-transparent")}>Dominant: {dominantName}</Badge>
          </div>
          <div className="space-y-5">
            {AKHLAT.map((a) => {
              const val = (scores as any)[a.key];
              const pct = Math.round((val / total) * 100);
              return (
                <div key={a.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", a.bg)}>
                        <a.icon className={cn("h-4 w-4", a.tint)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{a.name} <span className="text-muted-foreground font-normal">· {a.en}</span></p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{a.quality}</p>
                      </div>
                    </div>
                    <span className="font-serif text-sm font-bold" style={{ color: a.color }}>{val} · {pct}%</span>
                  </div>
                  <Slider
                    value={[val]}
                    onValueChange={(v) => setScores({ ...scores, [a.key]: v[0] })}
                    min={0} max={100} step={5}
                    className="[&_[role=slider]]:border-0"
                  />
                </div>
              );
            })}
          </div>

          {/* Visual balance bar */}
          <div className="mt-6">
            <p className="text-xs text-muted-foreground mb-1.5">Humoural balance</p>
            <div className="flex h-3 rounded-full overflow-hidden">
              {AKHLAT.map((a) => (
                <div key={a.key} style={{ width: `${((scores as any)[a.key] / total) * 100}%`, background: a.color }} className="transition-all" />
              ))}
            </div>
          </div>
        </Card>

        {/* Pulse & notes */}
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Pulse Characteristics (Nabz)</Label>
              <Input value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="e.g. Rapid, hard and hot" className="bg-background/60" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Clinical Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Recommended Tadbeer, observations…" className="bg-background/60 min-h-[80px]" />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Assessment"}
          </Button>
        </Card>
      </div>

      {/* History */}
      <Card className="p-5 border-border/50 bg-card/60 h-fit lg:sticky lg:top-24">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base font-semibold">Assessment History</h3>
        </div>
        <ScrollArea className="h-[520px] pr-3">
          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No assessments yet.</p>
            ) : history.map((a) => (
              <div key={a.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{a.patient?.name}</p>
                  <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-semibold text-primary mb-1.5">{a.result}</p>
                <div className="flex gap-1 h-1.5 rounded-full overflow-hidden mb-2">
                  {AKHLAT.map((k) => (
                    <div key={k.key} style={{ width: `${(a as any)[k.key]}%`, background: k.color }} />
                  ))}
                </div>
                {a.pulse && <p className="text-[11px] text-muted-foreground">Pulse: {a.pulse}</p>}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
