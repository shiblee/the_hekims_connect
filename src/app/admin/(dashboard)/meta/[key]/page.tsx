"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FloatingField } from "@/components/shared/floating-field";
import { Loader2, Plus, ChevronUp, ChevronDown, ListChecks, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  _count: { options: number };
}

interface Option {
  id: string;
  sectionId: string;
  label: string;
  active: boolean;
  sortOrder: number;
  count: number;
}

export default function MetaSectionPage() {
  const router = useRouter();
  const { key } = useParams<{ key: string }>();

  const [sections, setSections] = useState<Section[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [totalFacilities, setTotalFacilities] = useState(0);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  const [newOption, setNewOption] = useState("");
  const [addingOption, setAddingOption] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const selected = useMemo(() => sections.find((s) => s.key === key) || null, [sections, key]);

  const loadSections = () => {
    setLoadingSections(true);
    adminApi.get<{ sections: Section[] }>("/api/admin/metadata/sections")
      .then((res) => setSections(res.sections))
      .finally(() => setLoadingSections(false));
  };

  useEffect(() => { loadSections(); }, []);

  // If the URL points at a key that doesn't exist (typo, deleted section), fall back to the first one.
  useEffect(() => {
    if (!loadingSections && sections.length && !sections.some((s) => s.key === key)) {
      router.replace(`/admin/meta/${sections[0].key}`);
    }
  }, [loadingSections, sections, key, router]);

  const loadOptions = (section: Section) => {
    setLoadingOptions(true);
    adminApi.get<{ options: Option[]; totalFacilities: number }>(`/api/admin/metadata/sections/${section.id}/options`)
      .then((res) => { setOptions(res.options); setTotalFacilities(res.totalFacilities); })
      .finally(() => setLoadingOptions(false));
  };

  useEffect(() => { if (selected) loadOptions(selected); }, [selected?.id]);

  const createSection = async () => {
    if (!newSectionLabel.trim()) {
      toast.error("Section name is required");
      return;
    }
    setSavingSection(true);
    try {
      const res = await adminApi.post<{ section: Section }>("/api/admin/metadata/sections", {
        label: newSectionLabel,
      });
      toast.success("Section created");
      setAddSectionOpen(false);
      setNewSectionLabel("");
      setSections((s) => [...s, { ...res.section, _count: { options: 0 } }]);
      router.push(`/admin/meta/${res.section.key}`);
    } catch (err: any) {
      toast.error(err.message || "Could not create section");
    } finally {
      setSavingSection(false);
    }
  };

  const addOption = async () => {
    if (!selected || !newOption.trim()) return;
    setAddingOption(true);
    try {
      const res = await adminApi.post<{ option: Option }>(`/api/admin/metadata/sections/${selected.id}/options`, { label: newOption });
      setOptions((o) => [...o, { ...res.option, count: 0 }]);
      setNewOption("");
      setSections((s) => s.map((sec) => sec.id === selected.id ? { ...sec, _count: { options: sec._count.options + 1 } } : sec));
    } catch (err: any) {
      toast.error(err.message || "Could not add option");
    } finally {
      setAddingOption(false);
    }
  };

  const saveOptionLabel = async (option: Option) => {
    if (!editingLabel.trim()) { setEditingId(null); return; }
    try {
      const res = await adminApi.patch<{ option: Option }>(`/api/admin/metadata/options/${option.id}`, { label: editingLabel });
      setOptions((o) => o.map((x) => x.id === option.id ? { ...res.option, count: x.count } : x));
    } catch (err: any) {
      toast.error(err.message || "Could not rename option");
    } finally {
      setEditingId(null);
    }
  };

  const toggleActive = async (option: Option) => {
    try {
      const res = await adminApi.patch<{ option: Option }>(`/api/admin/metadata/options/${option.id}`, { active: !option.active });
      setOptions((o) => o.map((x) => x.id === option.id ? { ...res.option, count: x.count } : x));
    } catch (err: any) {
      toast.error(err.message || "Could not update option");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= options.length) return;
    const a = options[index];
    const b = options[target];
    const reordered = [...options];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setOptions(reordered);
    try {
      await Promise.all([
        adminApi.patch(`/api/admin/metadata/options/${a.id}`, { sortOrder: b.sortOrder }),
        adminApi.patch(`/api/admin/metadata/options/${b.id}`, { sortOrder: a.sortOrder }),
      ]);
    } catch {
      toast.error("Could not reorder — refreshing");
      if (selected) loadOptions(selected);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Meta ({sections.length})</h1>
        </div>
        <Button size="sm" onClick={() => setAddSectionOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Section
        </Button>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <Card className="p-2 border-border/50 bg-card/60 h-fit">
          {loadingSections ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="space-y-1">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/admin/meta/${s.key}`)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                    selected?.id === s.id ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <Badge variant={selected?.id === s.id ? "outline" : "secondary"} className={cn("shrink-0", selected?.id === s.id && "border-primary-foreground/40 text-primary-foreground")}>
                    {s._count.options}
                  </Badge>
                </button>
              ))}
              {sections.length === 0 && <p className="text-sm text-muted-foreground p-3">No sections yet.</p>}
            </div>
          )}
        </Card>

        <Card className="p-6 border-border/50 bg-card/60">
          {!selected ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div>
                <h2 className="font-serif text-lg font-semibold">{selected.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">{totalFacilities} facilit{totalFacilities === 1 ? "y" : "ies"} registered in total</p>
              </div>

              <div className="flex gap-2 mb-1 items-start">
                <div className="flex-1">
                  <FloatingField
                    id="newOptionLabel"
                    label="New option label"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addOption(); }}
                  />
                </div>
                <Button
                  className="h-14 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
                  onClick={addOption}
                  disabled={addingOption || !newOption.trim()}
                >
                  {addingOption ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                </Button>
              </div>

              {loadingOptions ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : options.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6">No options yet — add one above.</p>
              ) : (
                <div className="space-y-1.5">
                  {options.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
                      <div className="flex flex-col -my-1">
                        <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button disabled={i === options.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20 text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {editingId === o.id ? (
                        <div className="flex-1 flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveOptionLabel(o); if (e.key === "Escape") setEditingId(null); }}
                            className="h-8 bg-background/60"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveOptionLabel(o)}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <span className={cn("flex-1 text-sm", !o.active && "text-muted-foreground line-through")}>{o.label}</span>
                      )}

                      {editingId !== o.id && (
                        <>
                          <Badge variant="secondary" className="shrink-0 font-normal text-xs whitespace-nowrap">
                            {o.count} facilit{o.count === 1 ? "y" : "ies"} · {totalFacilities > 0 ? Math.round((o.count / totalFacilities) * 100) : 0}%
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(o.id); setEditingLabel(o.label); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Switch checked={o.active} onCheckedChange={() => toggleActive(o)} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Meta Section</DialogTitle>
            <DialogDescription>
              Create a new master-data category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="sectionLabel"
              label="Section Name"
              value={newSectionLabel}
              onChange={(e) => setNewSectionLabel(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionOpen(false)}>Cancel</Button>
            <Button onClick={createSection} disabled={savingSection}>
              {savingSection ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
