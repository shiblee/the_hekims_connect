"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { useUrlParam } from "@/hooks/use-url-param";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Plus, Trash2, Loader2 } from "lucide-react";

interface ComplaintRow { id: string; label: string; category: string; active: boolean }
interface ManifestationRow { id: string; chiefComplaintId: string; key: string; label: string; labelLocal: string | null; active: boolean }
interface FactorTagRow { id: string; kind: string; label: string; active: boolean }
interface WeightRuleRow {
  id: string; sourceType: string; sourceValue: string;
  safraPoints: number; damPoints: number; saudaPoints: number; balghamPoints: number;
  active: boolean; notes: string | null;
}
interface SeverityLabelRow { id: string; level: number; label: string }
interface HumorDisplayRow { id: string; humor: string; axisLabel: string; unaniLabel: string; description: string | null }
interface Config {
  complaints: ComplaintRow[]; manifestations: ManifestationRow[]; factorTags: FactorTagRow[]; weightRules: WeightRuleRow[];
  severityLabels: SeverityLabelRow[]; displayConfig: HumorDisplayRow[];
}

const SOURCE_TYPES = [
  { value: "manifestation", label: "Manifestation" },
  { value: "factor", label: "Aggravating/Relieving Factor" },
  { value: "severity_band", label: "Severity Band" },
  { value: "onset_pattern", label: "Onset Pattern" },
];
const SEVERITY_BANDS = ["mild", "moderate", "severe"];
const ONSET_PATTERNS = ["Acute", "Gradual", "Chronic", "Episodic/Recurrent"];

export default function HumorAdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  // Each tab has its own URL: ?tab=manifestations | rules | severity | tendency
  const [tab, setTab] = useUrlParam("tab", "manifestations", ["manifestations", "rules", "severity", "tendency"] as const);

  const load = () => {
    setLoading(true);
    adminApi.get<Config>("/api/admin/humor/config")
      .then(setConfig)
      .catch(() => toast.error("Could not load the Humoral Matrix configuration"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // ---------- Manifestations tab ----------
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [newManifestationLabel, setNewManifestationLabel] = useState("");
  const [savingManifestation, setSavingManifestation] = useState(false);

  useEffect(() => {
    if (!selectedComplaintId && config?.complaints.length) setSelectedComplaintId(config.complaints[0].id);
  }, [config, selectedComplaintId]);

  const manifestationsForComplaint = useMemo(
    () => (config?.manifestations || []).filter((m) => m.chiefComplaintId === selectedComplaintId),
    [config, selectedComplaintId]
  );

  const addManifestation = async () => {
    if (!selectedComplaintId) { toast.error("Pick a chief complaint first"); return; }
    if (!newManifestationLabel.trim()) { toast.error("Enter a label"); return; }
    setSavingManifestation(true);
    try {
      await adminApi.post("/api/admin/humor/manifestations", { chiefComplaintId: selectedComplaintId, label: newManifestationLabel });
      setNewManifestationLabel("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not add the manifestation");
    } finally {
      setSavingManifestation(false);
    }
  };

  const toggleManifestationActive = async (m: ManifestationRow) => {
    try {
      await adminApi.patch(`/api/admin/humor/manifestations/${m.id}`, { active: !m.active });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const deleteManifestation = async (m: ManifestationRow) => {
    if (!confirm(`Delete "${m.label}"?`)) return;
    try {
      await adminApi.delete(`/api/admin/humor/manifestations/${m.id}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not delete");
    }
  };

  // ---------- Weight Rules tab ----------
  const emptyRuleDraft = { sourceType: "manifestation", sourceValue: "", safraPoints: "0", damPoints: "0", saudaPoints: "0", balghamPoints: "0", notes: "" };
  const [ruleDraft, setRuleDraft] = useState(emptyRuleDraft);
  const [savingRule, setSavingRule] = useState(false);

  const sourceValueOptions = useMemo(() => {
    if (!config) return [] as { value: string; label: string }[];
    if (ruleDraft.sourceType === "manifestation") return config.manifestations.map((m) => ({ value: m.key, label: m.label }));
    if (ruleDraft.sourceType === "factor") return config.factorTags.map((f) => ({ value: f.label, label: `${f.label} (${f.kind})` }));
    if (ruleDraft.sourceType === "severity_band") return SEVERITY_BANDS.map((b) => ({ value: b, label: b }));
    return ONSET_PATTERNS.map((p) => ({ value: p, label: p }));
  }, [config, ruleDraft.sourceType]);

  const addWeightRule = async () => {
    if (!ruleDraft.sourceValue) { toast.error("Pick a source value"); return; }
    setSavingRule(true);
    try {
      await adminApi.post("/api/admin/humor/weight-rules", {
        sourceType: ruleDraft.sourceType, sourceValue: ruleDraft.sourceValue,
        safraPoints: ruleDraft.safraPoints, damPoints: ruleDraft.damPoints,
        saudaPoints: ruleDraft.saudaPoints, balghamPoints: ruleDraft.balghamPoints,
        notes: ruleDraft.notes || undefined,
      });
      setRuleDraft({ ...emptyRuleDraft, sourceType: ruleDraft.sourceType });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not add the rule");
    } finally {
      setSavingRule(false);
    }
  };

  const updateRulePoints = async (r: WeightRuleRow, field: "safraPoints" | "damPoints" | "saudaPoints" | "balghamPoints", value: string) => {
    try {
      await adminApi.patch(`/api/admin/humor/weight-rules/${r.id}`, { [field]: value });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const toggleRuleActive = async (r: WeightRuleRow) => {
    try {
      await adminApi.patch(`/api/admin/humor/weight-rules/${r.id}`, { active: !r.active });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const deleteWeightRule = async (r: WeightRuleRow) => {
    if (!confirm(`Delete the rule for "${r.sourceValue}"?`)) return;
    try {
      await adminApi.delete(`/api/admin/humor/weight-rules/${r.id}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not delete");
    }
  };

  // ---------- Severity Scale tab ----------
  const [savingSeverityLevel, setSavingSeverityLevel] = useState<number | null>(null);

  const updateSeverityLabel = async (level: number, label: string) => {
    if (!label.trim()) { toast.error("Label is required"); return; }
    setSavingSeverityLevel(level);
    try {
      await adminApi.patch(`/api/admin/humor/severity-labels/${level}`, { label });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    } finally {
      setSavingSeverityLevel(null);
    }
  };

  // ---------- Constitutional Tendency tab ----------
  const [savingHumor, setSavingHumor] = useState<string | null>(null);

  const updateHumorDisplay = async (humor: string, field: "axisLabel" | "unaniLabel" | "description", value: string) => {
    if ((field === "axisLabel" || field === "unaniLabel") && !value.trim()) { toast.error("This field is required"); return; }
    setSavingHumor(humor);
    try {
      await adminApi.patch(`/api/admin/humor/display-config/${humor}`, { [field]: value });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    } finally {
      setSavingHumor(null);
    }
  };

  if (loading || !config) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><Flame className="h-6 w-6 text-primary" /> Humoral Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configures the Junior Hakeem Intake Protocol's per-complaint findings and the deterministic point weights that compute the live Humoral Matrix on a visit. Values here are a clinical starting point — review before relying on them.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="manifestations">Manifestations</TabsTrigger>
          <TabsTrigger value="rules">Weight Rules</TabsTrigger>
          <TabsTrigger value="severity">Severity Scale</TabsTrigger>
          <TabsTrigger value="tendency">Constitutional Tendency</TabsTrigger>
        </TabsList>

        <TabsContent value="manifestations" className="mt-4">
          <Card className="p-4 border-border/50 bg-card/60 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-64">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Chief Complaint</label>
                <Select value={selectedComplaintId ?? undefined} onValueChange={setSelectedComplaintId}>
                  <SelectTrigger><SelectValue placeholder="Pick a complaint" /></SelectTrigger>
                  <SelectContent>
                    {config.complaints.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="New manifestation label, e.g. Photophobia"
                value={newManifestationLabel}
                onChange={(e) => setNewManifestationLabel(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button onClick={addManifestation} disabled={savingManifestation}>
                {savingManifestation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </Button>
            </div>

            <div className="space-y-2">
              {manifestationsForComplaint.length === 0 ? (
                <p className="text-sm text-muted-foreground">No manifestations yet for this complaint.</p>
              ) : manifestationsForComplaint.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                  <span className={cn("text-sm", !m.active && "text-muted-foreground line-through")}>{m.label}</span>
                  <div className="flex items-center gap-3">
                    <Switch checked={m.active} onCheckedChange={() => toggleManifestationActive(m)} />
                    <button onClick={() => deleteManifestation(m)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card className="p-4 border-border/50 bg-card/60 space-y-4">
            <div className="grid sm:grid-cols-6 gap-2 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Source Type</label>
                <Select value={ruleDraft.sourceType} onValueChange={(v) => setRuleDraft((d) => ({ ...d, sourceType: v, sourceValue: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Source Value</label>
                <Select value={ruleDraft.sourceValue} onValueChange={(v) => setRuleDraft((d) => ({ ...d, sourceValue: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pick a value" /></SelectTrigger>
                  <SelectContent>
                    {sourceValueOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(["safraPoints", "damPoints", "saudaPoints", "balghamPoints"] as const).map((field) => (
                <div key={field}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block capitalize">{field.replace("Points", "")}</label>
                  <Input
                    type="number" step="0.5"
                    value={ruleDraft[field]}
                    onChange={(e) => setRuleDraft((d) => ({ ...d, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Rationale (admin-only notes)"
                value={ruleDraft.notes}
                onChange={(e) => setRuleDraft((d) => ({ ...d, notes: e.target.value }))}
                className="flex-1"
              />
              <Button onClick={addWeightRule} disabled={savingRule}>
                {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Rule
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b border-border/50">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 px-2">Safra</th>
                    <th className="py-2 px-2">Dam</th>
                    <th className="py-2 px-2">Sauda</th>
                    <th className="py-2 px-2">Balgham</th>
                    <th className="py-2 px-2">Active</th>
                    <th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {config.weightRules.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-[10px] mr-1.5">{r.sourceType}</Badge>
                        {r.sourceValue}
                      </td>
                      {(["safraPoints", "damPoints", "saudaPoints", "balghamPoints"] as const).map((field) => (
                        <td key={field} className="py-2 px-2">
                          <Input
                            type="number" step="0.5" defaultValue={r[field]}
                            className="h-8 w-16"
                            onBlur={(e) => { if (Number(e.target.value) !== r[field]) updateRulePoints(r, field, e.target.value); }}
                          />
                        </td>
                      ))}
                      <td className="py-2 px-2"><Switch checked={r.active} onCheckedChange={() => toggleRuleActive(r)} /></td>
                      <td className="py-2 pl-2">
                        <button onClick={() => deleteWeightRule(r)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="severity" className="mt-4">
          <Card className="p-4 border-border/50 bg-card/60 space-y-3">
            <p className="text-xs text-muted-foreground">
              The clinical indication text shown next to each point on the Chief Complaint Matrix's severity slider (1 = mildest, 10 = most severe). All 10 levels are always present — edit the wording and blur or press Enter to save.
            </p>
            <div className="space-y-2">
              {config.severityLabels.map((s) => (
                <div key={s.level} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{s.level}</span>
                  <Input
                    defaultValue={s.label}
                    disabled={savingSeverityLevel === s.level}
                    className="h-8 flex-1"
                    onBlur={(e) => { if (e.target.value.trim() !== s.label) updateSeverityLabel(s.level, e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  {savingSeverityLevel === s.level && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tendency" className="mt-4">
          <Card className="p-4 border-border/50 bg-card/60 space-y-3">
            <p className="text-xs text-muted-foreground">
              The axis label, Unani term, and short description shown on each of the 4 Constitutional Tendency tiles on the Chief Complaint Matrix. Edit a field and blur or press Enter to save.
            </p>
            <div className="space-y-2">
              {config.displayConfig.map((d) => (
                <div key={d.humor} className="grid sm:grid-cols-[100px_1fr_1fr_1fr_auto] gap-2 items-center rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                  <span className="text-xs font-semibold text-muted-foreground capitalize">{d.humor}</span>
                  <Input
                    defaultValue={d.axisLabel}
                    placeholder="Axis label, e.g. Fire"
                    disabled={savingHumor === d.humor}
                    className="h-8"
                    onBlur={(e) => { if (e.target.value.trim() !== d.axisLabel) updateHumorDisplay(d.humor, "axisLabel", e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  <Input
                    defaultValue={d.unaniLabel}
                    placeholder="Unani term, e.g. Safrawi"
                    disabled={savingHumor === d.humor}
                    className="h-8"
                    onBlur={(e) => { if (e.target.value.trim() !== d.unaniLabel) updateHumorDisplay(d.humor, "unaniLabel", e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  <Input
                    defaultValue={d.description || ""}
                    placeholder="Description, e.g. Hot & Dry"
                    disabled={savingHumor === d.humor}
                    className="h-8"
                    onBlur={(e) => { if (e.target.value.trim() !== (d.description || "")) updateHumorDisplay(d.humor, "description", e.target.value); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  {savingHumor === d.humor && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
