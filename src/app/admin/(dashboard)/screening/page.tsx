"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardList, Plus, Trash2, Pencil, Loader2, CircleDot,
  CheckSquare, Hash, Type, Info, X,
} from "lucide-react";

interface ChiefComplaintRow { id: string; key: string; label: string; labelLocal: string | null; category: string; active: boolean }
interface QuestionOptionRow { id?: string; label: string; labelLocal?: string; flagSeverity: string }
interface QuestionRow {
  id: string; label: string; labelLocal: string | null; instructionText: string | null; type: string; active: boolean;
  applicableGender: string | null; minAgeDays: number | null; maxAgeDays: number | null;
  numericOperator: string | null; numericThreshold: number | null; numericFlagSeverity: string | null;
  numericOperator2: string | null; numericThreshold2: number | null; numericFlagSeverity2: string | null;
  options: QuestionOptionRow[];
}
interface ModuleRow { id: string; key: string; label: string; active: boolean; triggerComplaintIds: string[]; questions: QuestionRow[] }
interface Config { complaints: ChiefComplaintRow[]; modules: ModuleRow[] }

const TYPE_LABEL: Record<string, string> = { single_select: "Single Choice", multi_select: "Multiple Choice", numeric: "Number", text: "Text", instruction: "Instruction" };
const TYPE_ICON: Record<string, any> = { single_select: CircleDot, multi_select: CheckSquare, numeric: Hash, text: Type, instruction: Info };
const FLAG_COLORS: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

const emptyQuestionDraft = () => ({
  label: "", labelLocal: "", instructionText: "", type: "single_select",
  applicableGender: "", minAgeDays: "", maxAgeDays: "",
  numericOperator: "", numericThreshold: "", numericFlagSeverity: "",
  numericOperator2: "", numericThreshold2: "", numericFlagSeverity2: "",
  options: [{ label: "", flagSeverity: "" }] as QuestionOptionRow[],
});

export default function ScreeningAdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("complaints");

  const load = () => {
    setLoading(true);
    adminApi.get<Config>("/api/admin/screening/config")
      .then(setConfig)
      .catch(() => toast.error("Could not load the screening configuration"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // ---------- Chief Complaints tab ----------
  const [newComplaintLabel, setNewComplaintLabel] = useState("");
  const [newComplaintLocal, setNewComplaintLocal] = useState("");
  const [newComplaintCategory, setNewComplaintCategory] = useState("");
  const [savingComplaint, setSavingComplaint] = useState(false);

  const existingCategories = useMemo(() => {
    if (!config) return [];
    return Array.from(new Set(config.complaints.map((c) => c.category))).sort();
  }, [config]);

  const addComplaint = async () => {
    if (!newComplaintLabel.trim()) { toast.error("Enter a label"); return; }
    setSavingComplaint(true);
    try {
      await adminApi.post("/api/admin/screening/complaints", { label: newComplaintLabel, labelLocal: newComplaintLocal || undefined, category: newComplaintCategory || undefined });
      setNewComplaintLabel(""); setNewComplaintLocal(""); setNewComplaintCategory("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not add the complaint");
    } finally {
      setSavingComplaint(false);
    }
  };

  const toggleComplaintActive = async (c: ChiefComplaintRow) => {
    try {
      await adminApi.patch(`/api/admin/screening/complaints/${c.id}`, { active: !c.active });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const updateComplaintCategory = async (c: ChiefComplaintRow, category: string) => {
    try {
      await adminApi.patch(`/api/admin/screening/complaints/${c.id}`, { category });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update category");
    }
  };

  const deleteComplaint = async (c: ChiefComplaintRow) => {
    if (!confirm(`Delete "${c.label}"? This also removes it as a trigger from any module.`)) return;
    try {
      await adminApi.delete(`/api/admin/screening/complaints/${c.id}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not delete");
    }
  };

  // ---------- Modules & Questions tab ----------
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [newModuleLabel, setNewModuleLabel] = useState("");
  const [newModuleTriggers, setNewModuleTriggers] = useState<string[]>([]);
  const [savingModule, setSavingModule] = useState(false);

  const selectedModule = config?.modules.find((m) => m.id === selectedModuleId) || null;

  const addModule = async () => {
    if (!newModuleLabel.trim()) { toast.error("Enter a label"); return; }
    if (newModuleTriggers.length === 0) { toast.error("Select at least one trigger complaint"); return; }
    setSavingModule(true);
    try {
      const res = await adminApi.post<{ module: { id: string } }>("/api/admin/screening/modules", { label: newModuleLabel, triggerComplaintIds: newModuleTriggers });
      setNewModuleLabel(""); setNewModuleTriggers([]);
      await load();
      setSelectedModuleId(res.module.id);
    } catch (e: any) {
      toast.error(e.message || "Could not add the module");
    } finally {
      setSavingModule(false);
    }
  };

  const toggleModuleActive = async (m: ModuleRow) => {
    try {
      await adminApi.patch(`/api/admin/screening/modules/${m.id}`, { active: !m.active });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const updateModuleTriggers = async (m: ModuleRow, triggerComplaintIds: string[]) => {
    try {
      await adminApi.patch(`/api/admin/screening/modules/${m.id}`, { triggerComplaintIds });
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not update triggers");
    }
  };

  const deleteModule = async (m: ModuleRow) => {
    if (!confirm(`Delete module "${m.label}" and all its questions? This cannot be undone.`)) return;
    try {
      await adminApi.delete(`/api/admin/screening/modules/${m.id}`);
      if (selectedModuleId === m.id) setSelectedModuleId(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not delete");
    }
  };

  // ---------- Question editor (shared create/edit dialog) ----------
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyQuestionDraft());
  const [savingQuestion, setSavingQuestion] = useState(false);

  const openNewQuestion = () => { setEditingQuestionId(null); setDraft(emptyQuestionDraft()); setQuestionDialogOpen(true); };
  const openEditQuestion = (q: QuestionRow) => {
    setEditingQuestionId(q.id);
    setDraft({
      label: q.label, labelLocal: q.labelLocal || "", instructionText: q.instructionText || "", type: q.type,
      applicableGender: q.applicableGender || "", minAgeDays: q.minAgeDays?.toString() || "", maxAgeDays: q.maxAgeDays?.toString() || "",
      numericOperator: q.numericOperator || "", numericThreshold: q.numericThreshold?.toString() || "", numericFlagSeverity: q.numericFlagSeverity || "",
      numericOperator2: q.numericOperator2 || "", numericThreshold2: q.numericThreshold2?.toString() || "", numericFlagSeverity2: q.numericFlagSeverity2 || "",
      options: q.options.length ? q.options.map((o) => ({ label: o.label, flagSeverity: o.flagSeverity || "" })) : [{ label: "", flagSeverity: "" }],
    });
    setQuestionDialogOpen(true);
  };

  const deleteQuestion = async (q: QuestionRow) => {
    if (!confirm(`Delete question "${q.label}"?`)) return;
    try {
      await adminApi.delete(`/api/admin/screening/questions/${q.id}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not delete");
    }
  };

  const saveQuestion = async () => {
    if (!selectedModule) return;
    if (!draft.label.trim()) { toast.error("Enter a question label"); return; }
    const needsOptions = draft.type === "single_select" || draft.type === "multi_select";
    const cleanOptions = draft.options.filter((o) => o.label.trim());
    if (needsOptions && cleanOptions.length === 0) { toast.error("Add at least one option"); return; }

    const payload = {
      label: draft.label, labelLocal: draft.labelLocal || undefined, instructionText: draft.instructionText || undefined, type: draft.type,
      applicableGender: draft.applicableGender || undefined, minAgeDays: draft.minAgeDays || undefined, maxAgeDays: draft.maxAgeDays || undefined,
      numericOperator: draft.numericOperator || undefined, numericThreshold: draft.numericThreshold || undefined, numericFlagSeverity: draft.numericFlagSeverity || undefined,
      numericOperator2: draft.numericOperator2 || undefined, numericThreshold2: draft.numericThreshold2 || undefined, numericFlagSeverity2: draft.numericFlagSeverity2 || undefined,
      options: needsOptions ? cleanOptions.map((o) => ({ label: o.label, flagSeverity: o.flagSeverity || undefined })) : [],
    };

    setSavingQuestion(true);
    try {
      if (editingQuestionId) {
        await adminApi.patch(`/api/admin/screening/questions/${editingQuestionId}`, payload);
      } else {
        await adminApi.post(`/api/admin/screening/modules/${selectedModule.id}/questions`, payload);
      }
      setQuestionDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save the question");
    } finally {
      setSavingQuestion(false);
    }
  };

  const updateDraftOption = (idx: number, patch: Partial<QuestionOptionRow>) => {
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));
  };
  const addDraftOption = () => setDraft((d) => ({ ...d, options: [...d.options, { label: "", flagSeverity: "" }] }));
  const removeDraftOption = (idx: number) => setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== idx) }));

  if (loading) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }
  if (!config) return null;

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> L1 Screening
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure chief complaints, their triggered question modules, and the Red/Yellow/Green flag rules used for triage.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="complaints">Chief Complaints</TabsTrigger>
          <TabsTrigger value="modules">Modules & Questions</TabsTrigger>
        </TabsList>

        {/* ---------- Chief Complaints ---------- */}
        <TabsContent value="complaints" className="mt-6">
          <Card className="p-5 border-border/50 bg-card/60 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Input placeholder="Label (e.g. Fever)" value={newComplaintLabel} onChange={(e) => setNewComplaintLabel(e.target.value)} className="bg-background/60" />
              <Input placeholder="Local translation (optional)" value={newComplaintLocal} onChange={(e) => setNewComplaintLocal(e.target.value)} className="bg-background/60" />
              <Input list="screening-categories" placeholder="Category" value={newComplaintCategory} onChange={(e) => setNewComplaintCategory(e.target.value)} className="bg-background/60 w-40" />
              <datalist id="screening-categories">
                {existingCategories.map((cat) => <option key={cat} value={cat} />)}
              </datalist>
              <Button onClick={addComplaint} disabled={savingComplaint}>
                {savingComplaint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </Button>
            </div>
            <div className="space-y-4">
              {existingCategories.map((cat) => {
                const items = config.complaints.filter((c) => c.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{cat}</p>
                    <div className="space-y-1.5">
                      {items.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background/40 border border-border/30">
                          <div>
                            <span className="text-sm font-medium">{c.label}</span>
                            {c.labelLocal && <span className="text-xs text-muted-foreground ml-2">{c.labelLocal}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              list="screening-categories"
                              defaultValue={c.category}
                              onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== c.category) updateComplaintCategory(c, e.target.value.trim()); }}
                              className="bg-background/60 h-8 w-36 text-xs"
                            />
                            <Switch checked={c.active} onCheckedChange={() => toggleComplaintActive(c)} />
                            <button onClick={() => deleteComplaint(c)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {config.complaints.length === 0 && <p className="text-sm text-muted-foreground">No chief complaints yet.</p>}
            </div>
          </Card>
        </TabsContent>

        {/* ---------- Modules & Questions ---------- */}
        <TabsContent value="modules" className="mt-6">
          <div className="grid md:grid-cols-[280px_1fr] gap-6">
            <Card className="p-3 border-border/50 bg-card/60 h-fit">
              <div className="space-y-1 mb-3">
                {config.modules.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModuleId(m.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                      selectedModuleId === m.id ? "bg-primary text-primary-foreground" : "hover:bg-background/60",
                      !m.active && selectedModuleId !== m.id && "opacity-50"
                    )}
                  >
                    <span className="truncate">{m.label}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{m.questions.length}</Badge>
                  </button>
                ))}
                {config.modules.length === 0 && <p className="text-sm text-muted-foreground px-1">No modules yet.</p>}
              </div>
              <div className="border-t border-border/40 pt-3 space-y-2">
                <Input placeholder="New module label" value={newModuleLabel} onChange={(e) => setNewModuleLabel(e.target.value)} className="bg-background/60 h-9" />
                <p className="text-[11px] text-muted-foreground">Triggers on:</p>
                <div className="flex flex-wrap gap-1.5">
                  {config.complaints.filter((c) => c.active).map((c) => {
                    const checked = newModuleTriggers.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewModuleTriggers((p) => (checked ? p.filter((id) => id !== c.id) : [...p, c.id]))}
                        className={cn("px-2 py-1 rounded-full text-[11px] border transition-colors", checked ? "bg-primary text-primary-foreground border-primary" : "bg-background/60 border-border/50")}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <Button size="sm" className="w-full" onClick={addModule} disabled={savingModule}>
                  {savingModule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Module
                </Button>
              </div>
            </Card>

            {selectedModule ? (
              <Card className="p-5 border-border/50 bg-card/60 space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-serif text-lg font-semibold">{selectedModule.label}</h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={selectedModule.active} onCheckedChange={() => toggleModuleActive(selectedModule)} /> Active</div>
                    <button onClick={() => deleteModule(selectedModule)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Triggered by</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.complaints.map((c) => {
                      const checked = selectedModule.triggerComplaintIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => updateModuleTriggers(selectedModule, checked ? selectedModule.triggerComplaintIds.filter((id) => id !== c.id) : [...selectedModule.triggerComplaintIds, c.id])}
                          className={cn("px-2.5 py-1 rounded-full text-xs border transition-colors", checked ? "bg-primary text-primary-foreground border-primary" : "bg-background/60 border-border/50")}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions</p>
                    <Button size="sm" variant="outline" onClick={openNewQuestion}><Plus className="h-3.5 w-3.5" /> Add Question</Button>
                  </div>
                  <div className="space-y-2">
                    {selectedModule.questions.map((q) => {
                      const Icon = TYPE_ICON[q.type] || Info;
                      return (
                        <div key={q.id} className={cn("rounded-lg border p-3", q.active ? "border-border/30 bg-background/40" : "border-border/20 bg-background/20 opacity-60")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{q.label}</p>
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[q.type]}</Badge>
                                  {q.applicableGender && <Badge variant="outline" className="text-[10px] capitalize">{q.applicableGender} only</Badge>}
                                  {(q.minAgeDays != null || q.maxAgeDays != null) && <Badge variant="outline" className="text-[10px]">Age gated</Badge>}
                                  {q.options.filter((o) => o.flagSeverity).map((o) => (
                                    <Badge key={o.label} variant="outline" className={cn("text-[10px] border", FLAG_COLORS[o.flagSeverity])}>{o.label} → {o.flagSeverity}</Badge>
                                  ))}
                                  {q.numericFlagSeverity && <Badge variant="outline" className={cn("text-[10px] border", FLAG_COLORS[q.numericFlagSeverity])}>{q.numericOperator} {q.numericThreshold} → {q.numericFlagSeverity}</Badge>}
                                  {q.numericFlagSeverity2 && <Badge variant="outline" className={cn("text-[10px] border", FLAG_COLORS[q.numericFlagSeverity2])}>{q.numericOperator2} {q.numericThreshold2} → {q.numericFlagSeverity2}</Badge>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => openEditQuestion(q)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => deleteQuestion(q)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {selectedModule.questions.length === 0 && <p className="text-sm text-muted-foreground">No questions in this module yet.</p>}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 border-border/50 bg-card/60 text-center">
                <p className="text-sm text-muted-foreground">Select a module on the left, or add a new one.</p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ---------- Question create/edit dialog ---------- */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestionId ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Label</Label>
                <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className="bg-background/60" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Local translation (optional)</Label>
                <Input value={draft.labelLocal} onChange={(e) => setDraft((d) => ({ ...d, labelLocal: e.target.value }))} className="bg-background/60" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Type</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft((d) => ({ ...d, type: v }))}>
                  <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Applies to gender</Label>
                <Select value={draft.applicableGender || "any"} onValueChange={(v) => setDraft((d) => ({ ...d, applicableGender: v === "any" ? "" : v }))}>
                  <SelectTrigger className="bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="male">Male only</SelectItem>
                    <SelectItem value="female">Female only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Min age (days)</Label>
                  <Input type="number" value={draft.minAgeDays} onChange={(e) => setDraft((d) => ({ ...d, minAgeDays: e.target.value }))} className="bg-background/60" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Max age (days)</Label>
                  <Input type="number" value={draft.maxAgeDays} onChange={(e) => setDraft((d) => ({ ...d, maxAgeDays: e.target.value }))} className="bg-background/60" />
                </div>
              </div>
            </div>

            {draft.type === "instruction" && (
              <div>
                <Label className="text-xs mb-1 block">Instruction text (read verbatim)</Label>
                <Textarea value={draft.instructionText} onChange={(e) => setDraft((d) => ({ ...d, instructionText: e.target.value }))} className="bg-background/60" rows={2} />
              </div>
            )}

            {(draft.type === "single_select" || draft.type === "multi_select") && (
              <div>
                <Label className="text-xs mb-2 block">Options</Label>
                <div className="space-y-2">
                  {draft.options.map((o, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input placeholder="Option label" value={o.label} onChange={(e) => updateDraftOption(idx, { label: e.target.value })} className="bg-background/60" />
                      <Select value={o.flagSeverity || "none"} onValueChange={(v) => updateDraftOption(idx, { flagSeverity: v === "none" ? "" : v })}>
                        <SelectTrigger className="bg-background/60 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No flag</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="yellow">Yellow</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                        </SelectContent>
                      </Select>
                      <button onClick={() => removeDraftOption(idx)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addDraftOption}><Plus className="h-3.5 w-3.5" /> Add Option</Button>
                </div>
              </div>
            )}

            {draft.type === "numeric" && (
              <div className="space-y-3">
                <Label className="text-xs block">Flag rules (up to two independent threshold checks)</Label>
                {[1, 2].map((n) => {
                  const opKey = n === 1 ? "numericOperator" : "numericOperator2";
                  const thKey = n === 1 ? "numericThreshold" : "numericThreshold2";
                  const sevKey = n === 1 ? "numericFlagSeverity" : "numericFlagSeverity2";
                  return (
                    <div key={n} className="grid grid-cols-3 gap-2">
                      <Select value={(draft as any)[opKey] || "none"} onValueChange={(v) => setDraft((d) => ({ ...d, [opKey]: v === "none" ? "" : v }))}>
                        <SelectTrigger className="bg-background/60"><SelectValue placeholder="Operator" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value=">">{"> greater than"}</SelectItem>
                          <SelectItem value="<">{"< less than"}</SelectItem>
                          <SelectItem value=">=">{">= at least"}</SelectItem>
                          <SelectItem value="<=">{"<= at most"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Threshold" value={(draft as any)[thKey]} onChange={(e) => setDraft((d) => ({ ...d, [thKey]: e.target.value }))} className="bg-background/60" />
                      <Select value={(draft as any)[sevKey] || "none"} onValueChange={(v) => setDraft((d) => ({ ...d, [sevKey]: v === "none" ? "" : v }))}>
                        <SelectTrigger className="bg-background/60"><SelectValue placeholder="Flag" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No flag</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="yellow">Yellow</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveQuestion} disabled={savingQuestion}>
              {savingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
