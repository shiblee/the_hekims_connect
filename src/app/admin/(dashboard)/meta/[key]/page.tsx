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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Plus, ListChecks, Pencil, X,
  CircleDot, CheckSquare, Hash, Type, Info, TriangleAlert, Search, Pill, Leaf, Tablets, TrendingUp, TrendingDown, PersonStanding, Hourglass,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SupplementProfileDialog } from "@/components/admin/supplement-profile-dialog";
import { AsbabAdmin } from "@/components/admin/asbab-admin";
import { TashkheesAdmin } from "@/components/admin/tashkhees-admin";
import { ANATOMICAL_REGION_ICONS, REGION_GENDERS, regionIcon } from "@/lib/anatomical-region-icons";
import { BODY_ZONES } from "@/lib/body-zones";
import { sortByLabel } from "@/lib/sort-options";

interface Section {
  id: string;
  key: string;
  label: string;
  category: string;
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
  updatedAt?: string;
}

type CountScope = "facility" | "staff" | "patient" | "payment" | "vitals" | "referralDecline" | "none";

const SCOPE_NOUN: Record<CountScope, [string, string]> = {
  facility: ["facility", "facilities"],
  staff: ["staff member", "staff members"],
  patient: ["patient", "patients"],
  payment: ["payment", "payments"],
  vitals: ["vitals record", "vitals records"],
  referralDecline: ["declined referral", "declined referrals"],
  none: ["record", "records"],
};

function countNoun(scope: CountScope, n: number): string {
  const [singular, plural] = SCOPE_NOUN[scope];
  return n === 1 ? singular : plural;
}

// ---------- L1 Screening types (Chief Complaints / Allergies / Medications & Herbs) ----------
interface ChiefComplaintRow { id: string; key: string; label: string; labelLocal: string | null; category: string; active: boolean }
interface ScreeningConfig { complaints: ChiefComplaintRow[] }
interface FactorTagRow { id: string; kind: "aggravating" | "relieving"; label: string; sortOrder: number; active: boolean; updatedAt?: string }
type FactorKind = FactorTagRow["kind"];
// Aggravating / Relieving factor chips offered to the doctor in the Chief
// Complaint Matrix (stored as ComplaintFactorTag rows).
const FACTOR_META: Record<FactorKind, { title: string; muted: string; placeholder: string }> = {
  aggravating: { title: "Aggravating Factors (Muharrikat)", muted: "Aggravating Factor", placeholder: "e.g. Cold exposure" },
  relieving: { title: "Relieving Factors (Musakkinat)", muted: "Relieving Factor", placeholder: "e.g. Rest" },
};
interface OnsetRow { id: string; label: string; description: string | null; sortOrder: number; active: boolean }
interface RegionRow { id: string; label: string; localTerms: string | null; icon: string; gender: string; bodyZone: string | null; sortOrder: number; active: boolean }
interface AllergyRow { id: string; label: string; sortOrder: number; active: boolean; patientCount: number; patientPercent: number }
interface MedicationRow { id: string; kind: string; label: string; sortOrder: number; active: boolean; patientCount: number; patientPercent: number }
interface RedFlagRow { id: string; label: string; description: string | null; sortOrder: number; active: boolean; updatedAt?: string }
interface AcuteSymptomRow { id: string; label: string; description: string | null; sortOrder: number; active: boolean; updatedAt?: string }

/** "Last updated …" for a manually curated list — the newest change across its rows. */
function LastUpdated({ rows }: { rows: { updatedAt?: string }[] }) {
  const times = rows.map((r) => (r.updatedAt ? new Date(r.updatedAt).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  if (!times.length) return null;
  const last = new Date(Math.max(...times));
  const sameDay = times.filter((t) => new Date(t).toDateString() === last.toDateString()).length;
  const days = Math.floor((Date.now() - last.getTime()) / 86400000);
  const ago = days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : days < 365 ? `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago` : `${Math.floor(days / 365)} year${days < 730 ? "" : "s"} ago`;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground" title={`${sameDay} item${sameDay === 1 ? "" : "s"} changed on that day`}>
      <CalendarClock className="h-3.5 w-3.5" />
      Last updated <span className="font-medium text-foreground">{last.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}, {last.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
      {" "}· {ago} · {rows.length} items
    </p>
  );
}

const SCREENING_TABS = ["complaints", "asbab", "tashkhees", "allergies", "supplements", "medications", "aggravating", "relieving", "redflags", "symptoms", "regions", "onset"] as const;
// Allergies, Supplements & Herbs, Medications and Red Flags are reachable from
// the Patient category's sidebar instead of their own top-bar tabs, so they're
// excluded here.
const PATIENT_SIDEBAR_TABS = ["allergies", "supplements", "medications", "aggravating", "relieving", "redflags", "symptoms", "regions", "onset"];
const TOP_BAR_SCREENING_TABS = SCREENING_TABS.filter((t) => !PATIENT_SIDEBAR_TABS.includes(t));

// Sections whose "X records registered in total" stats badge isn't meaningful
// enough to show — payment_mode counts transactions not patients.
const HIDE_STATS_KEYS = ["payment_mode"];
const SCREENING_TAB_LABELS: Record<string, string> = {
  complaints: "Chief Complaints", asbab: "Asbab-e-Sittah", tashkhees: "Tashkhees & Ilaj", allergies: "Allergies",
  supplements: "Unani Medicine", medications: "Allopathic Medicine",
  aggravating: "Aggravating Factors (Muharrikat)", relieving: "Relieving Factors (Musakkinat)",
  redflags: "Emergency Warning Signs", symptoms: "Accompanying Acute Symptoms (Alamat-e-Izafiya)",
  regions: "Anatomical Region & Organ System",
  onset: "Onset Nature & Rhythm",
};

const TYPE_LABEL: Record<string, string> = { single_select: "Single Choice", multi_select: "Multiple Choice", numeric: "Number", text: "Text", instruction: "Instruction" };
const TYPE_ICON: Record<string, any> = { single_select: CircleDot, multi_select: CheckSquare, numeric: Hash, text: Type, instruction: Info };
const FLAG_COLORS: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

export default function MetaSectionPage() {
  const router = useRouter();
  const { key } = useParams<{ key: string }>();

  const [sections, setSections] = useState<Section[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [total, setTotal] = useState(0);
  const [countScope, setCountScope] = useState<CountScope>("facility");
  const [unsetCount, setUnsetCount] = useState(0);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [newOption, setNewOption] = useState("");
  const [addingOption, setAddingOption] = useState(false);
  const [addOptionDialogOpen, setAddOptionDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingActive, setEditingActive] = useState(true);
  const [savingOptionEdit, setSavingOptionEdit] = useState(false);

  // Screening tabs are real URLs (/admin/meta/complaints, /admin/meta/allergies, …),
  // same as any other section — derived straight from the URL so it's correct on
  // first paint, not just after section data loads.
  const isScreeningTab = (SCREENING_TABS as readonly string[]).includes(key || "");

  const selected = useMemo(() => (isScreeningTab ? null : sections.find((s) => s.key === key) || null), [sections, key, isScreeningTab]);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const s of sections) if (!seen.includes(s.category)) seen.push(s.category);
    return seen;
  }, [sections]);

  // Keep the active tab in sync with whichever section (or screening tab) the
  // URL points at, so deep-linking /admin/meta/[key] lands on the right tab.
  useEffect(() => {
    if (isScreeningTab) {
      setActiveCategory(key);
    } else if (selected) {
      setActiveCategory(selected.category);
    } else if (!activeCategory && categories.length) {
      setActiveCategory(categories[0]);
    }
  }, [selected, categories, isScreeningTab, key]);

  // Red Flags and Allergies live in the Patient category's sidebar rather
  // than having their own — so while viewing either, the sidebar still
  // shows Patient's sections (plus these two) instead of going blank.
  const sidebarCategory = activeCategory && PATIENT_SIDEBAR_TABS.includes(activeCategory) ? "Patient" : activeCategory;
  const sectionsInActiveCategory = useMemo(
    () => sections.filter((s) => s.category === sidebarCategory),
    [sections, sidebarCategory]
  );

  const loadSections = () => {
    setLoadingSections(true);
    adminApi.get<{ sections: Section[] }>("/api/admin/metadata/sections")
      .then((res) => setSections(res.sections))
      .finally(() => setLoadingSections(false));
  };

  useEffect(() => { loadSections(); }, []);

  // If the URL points at a key that doesn't exist (typo, deleted section), fall back to the first one.
  useEffect(() => {
    if (!loadingSections && !isScreeningTab && sections.length && !sections.some((s) => s.key === key)) {
      router.replace(`/admin/meta/${sections[0].key}`);
    }
  }, [loadingSections, sections, key, router, isScreeningTab]);

  // Category tabs (Facility/Patient/…) are a client-side filter over the section
  // sidebar, not a destination of their own — but screening tabs ARE a real
  // destination, so clicking one navigates to its own URL.
  const onTabChange = (value: string) => {
    if ((SCREENING_TABS as readonly string[]).includes(value)) {
      router.push(`/admin/meta/${value}`);
      return;
    }
    // Category tabs navigate to their first section, so every tab has its own
    // real, bookmarkable URL instead of silently staying on whatever section
    // happened to be open before.
    const firstInCategory = sections.find((s) => s.category === value);
    if (firstInCategory) router.push(`/admin/meta/${firstInCategory.key}`);
    else setActiveCategory(value);
  };

  const loadOptions = (section: Section) => {
    setLoadingOptions(true);
    adminApi.get<{ options: Option[]; total: number; scope: CountScope; unsetCount: number }>(`/api/admin/metadata/sections/${section.id}/options`)
      .then((res) => { setOptions(res.options); setTotal(res.total); setCountScope(res.scope); setUnsetCount(res.unsetCount || 0); })
      .finally(() => setLoadingOptions(false));
  };

  useEffect(() => { if (selected) loadOptions(selected); }, [selected?.id]);

  const addOption = async () => {
    if (!selected || !newOption.trim()) return;
    setAddingOption(true);
    try {
      const res = await adminApi.post<{ option: Option }>(`/api/admin/metadata/sections/${selected.id}/options`, { label: newOption });
      setOptions((o) => [...o, { ...res.option, count: 0 }]);
      setNewOption("");
      setAddOptionDialogOpen(false);
      setSections((s) => s.map((sec) => sec.id === selected.id ? { ...sec, _count: { options: sec._count.options + 1 } } : sec));
    } catch (err: any) {
      toast.error(err.message || "Could not add option");
    } finally {
      setAddingOption(false);
    }
  };

  const saveOptionLabel = async () => {
    if (!editingId || !editingLabel.trim()) return;
    setSavingOptionEdit(true);
    try {
      const res = await adminApi.patch<{ option: Option }>(`/api/admin/metadata/options/${editingId}`, { label: editingLabel, active: editingActive });
      setOptions((o) => o.map((x) => x.id === editingId ? { ...res.option, count: x.count } : x));
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message || "Could not save the option");
    } finally {
      setSavingOptionEdit(false);
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


  // ==================== L1 Screening state & handlers ====================
  const [screeningConfig, setScreeningConfig] = useState<ScreeningConfig | null>(null);
  const [loadingScreening, setLoadingScreening] = useState(true);

  const loadScreening = () => {
    setLoadingScreening(true);
    adminApi.get<ScreeningConfig>("/api/admin/screening/config")
      .then(setScreeningConfig)
      .catch(() => toast.error("Could not load the screening configuration"))
      .finally(() => setLoadingScreening(false));
  };
  useEffect(() => { loadScreening(); }, []);

  // ---------- Aggravating / Relieving factor tabs ----------
  const [factorTags, setFactorTags] = useState<FactorTagRow[]>([]);
  const [addFactorKind, setAddFactorKind] = useState<FactorKind | null>(null);
  const [newFactorLabel, setNewFactorLabel] = useState("");
  const [savingFactor, setSavingFactor] = useState(false);
  const [editFactor, setEditFactor] = useState<FactorTagRow | null>(null);
  const [editFactorLabel, setEditFactorLabel] = useState("");
  const [editFactorActive, setEditFactorActive] = useState(true);
  const [savingFactorEdit, setSavingFactorEdit] = useState(false);

  const loadFactorTags = () => {
    adminApi.get<{ factorTags: FactorTagRow[] }>("/api/admin/humor/factor-tags")
      .then((res) => setFactorTags(res.factorTags || []))
      .catch(() => toast.error("Could not load factors"));
  };
  useEffect(() => { loadFactorTags(); }, []);
  const factorsOf = (kind: FactorKind) => factorTags.filter((f) => f.kind === kind);

  const addFactorTag = async () => {
    if (!addFactorKind || !newFactorLabel.trim()) return;
    setSavingFactor(true);
    try {
      await adminApi.post("/api/admin/humor/factor-tags", { kind: addFactorKind, label: newFactorLabel });
      setNewFactorLabel("");
      setAddFactorKind(null);
      loadFactorTags();
    } catch (e: any) {
      toast.error(e.message || "Could not add factor");
    } finally {
      setSavingFactor(false);
    }
  };

  const toggleFactorActive = async (f: FactorTagRow) => {
    try {
      await adminApi.patch(`/api/admin/humor/factor-tags/${f.id}`, { active: !f.active });
      loadFactorTags();
    } catch (e: any) {
      toast.error(e.message || "Could not update factor");
    }
  };

  const openEditFactor = (f: FactorTagRow) => {
    setEditFactor(f);
    setEditFactorLabel(f.label);
    setEditFactorActive(f.active);
  };

  const saveFactorEdit = async () => {
    if (!editFactor || !editFactorLabel.trim()) return;
    setSavingFactorEdit(true);
    try {
      await adminApi.patch(`/api/admin/humor/factor-tags/${editFactor.id}`, { label: editFactorLabel, active: editFactorActive });
      setEditFactor(null);
      loadFactorTags();
    } catch (e: any) {
      toast.error(e.message || "Could not update factor");
    } finally {
      setSavingFactorEdit(false);
    }
  };


  const renderFactorRows = (kind: FactorKind) => {
    const list = factorsOf(kind);
    const Icon = kind === "aggravating" ? TrendingUp : TrendingDown;
    return (
      <div className="space-y-1.5">
        {sortByLabel(list).map((f) => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", kind === "aggravating" ? "text-destructive" : "text-emerald-500")} />
            <span className="flex-1 text-sm font-medium truncate">{f.label}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditFactor(f)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <span className={cn("text-xs font-medium w-14 text-right", f.active ? "text-emerald-500" : "text-muted-foreground")}>
              {f.active ? "Active" : "Inactive"}
            </span>
            <Switch checked={f.active} onCheckedChange={() => toggleFactorActive(f)} />
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No factors yet.</p>}
      </div>
    );
  };

  // ---------- Anatomical Region & Organ System tab (Stage 3 selector cards) ----------
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionDialog, setRegionDialog] = useState<{ id: string | null; label: string; localTerms: string; icon: string; gender: string; bodyZone: string; active: boolean } | null>(null);
  const [savingRegion, setSavingRegion] = useState(false);

  const loadRegions = () => {
    adminApi.get<{ regions: RegionRow[] }>("/api/admin/anatomical-regions")
      .then((res) => setRegions(res.regions || []))
      .catch(() => toast.error("Could not load anatomical regions"));
  };
  useEffect(() => { loadRegions(); }, []);

  const saveRegion = async () => {
    if (!regionDialog || !regionDialog.label.trim()) return;
    setSavingRegion(true);
    try {
      const body = { label: regionDialog.label, localTerms: regionDialog.localTerms, icon: regionDialog.icon, gender: regionDialog.gender, bodyZone: regionDialog.bodyZone === "none" ? null : regionDialog.bodyZone };
      if (regionDialog.id) await adminApi.patch(`/api/admin/anatomical-regions/${regionDialog.id}`, { ...body, active: regionDialog.active });
      else await adminApi.post("/api/admin/anatomical-regions", body);
      setRegionDialog(null);
      loadRegions();
    } catch (e: any) {
      toast.error(e.message || "Could not save region");
    } finally {
      setSavingRegion(false);
    }
  };

  const toggleRegionActive = async (r: RegionRow) => {
    try {
      await adminApi.patch(`/api/admin/anatomical-regions/${r.id}`, { active: !r.active });
      loadRegions();
    } catch (e: any) {
      toast.error(e.message || "Could not update region");
    }
  };


  // ---------- Onset Nature & Rhythm tab (Stage 3 options) ----------
  const [onsetPatterns, setOnsetPatterns] = useState<OnsetRow[]>([]);
  const [onsetDialog, setOnsetDialog] = useState<{ id: string | null; label: string; description: string; active: boolean } | null>(null);
  const [savingOnset, setSavingOnset] = useState(false);

  const loadOnsetPatterns = () => {
    adminApi.get<{ patterns: OnsetRow[] }>("/api/admin/onset-patterns")
      .then((res) => setOnsetPatterns(res.patterns || []))
      .catch(() => toast.error("Could not load onset options"));
  };
  useEffect(() => { loadOnsetPatterns(); }, []);

  const saveOnset = async () => {
    if (!onsetDialog || !onsetDialog.label.trim()) return;
    setSavingOnset(true);
    try {
      const body = { label: onsetDialog.label, description: onsetDialog.description };
      if (onsetDialog.id) await adminApi.patch(`/api/admin/onset-patterns/${onsetDialog.id}`, { ...body, active: onsetDialog.active });
      else await adminApi.post("/api/admin/onset-patterns", body);
      setOnsetDialog(null);
      loadOnsetPatterns();
    } catch (e: any) {
      toast.error(e.message || "Could not save option");
    } finally {
      setSavingOnset(false);
    }
  };

  const toggleOnsetActive = async (o: OnsetRow) => {
    try {
      await adminApi.patch(`/api/admin/onset-patterns/${o.id}`, { active: !o.active });
      loadOnsetPatterns();
    } catch (e: any) {
      toast.error(e.message || "Could not update option");
    }
  };


  // ---------- Allergies tab ----------
  const [allergies, setAllergies] = useState<AllergyRow[]>([]);
  const [allergyTotalPatients, setAllergyTotalPatients] = useState(0);
  const [newAllergyLabel, setNewAllergyLabel] = useState("");
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [addAllergyDialogOpen, setAddAllergyDialogOpen] = useState(false);
  const [editAllergyId, setEditAllergyId] = useState<string | null>(null);
  const [editAllergyLabel, setEditAllergyLabel] = useState("");
  const [editAllergyActive, setEditAllergyActive] = useState(true);
  const [savingAllergyEdit, setSavingAllergyEdit] = useState(false);

  const loadAllergies = () => {
    adminApi.get<{ allergies: AllergyRow[]; totalPatients: number }>("/api/admin/allergies")
      .then((res) => { setAllergies(res.allergies || []); setAllergyTotalPatients(res.totalPatients || 0); })
      .catch(() => toast.error("Could not load allergies"));
  };
  useEffect(() => { loadAllergies(); }, []);

  const addAllergy = async () => {
    if (!newAllergyLabel.trim()) { toast.error("Enter a label"); return; }
    setSavingAllergy(true);
    try {
      await adminApi.post("/api/admin/allergies", { label: newAllergyLabel });
      setNewAllergyLabel("");
      setAddAllergyDialogOpen(false);
      loadAllergies();
    } catch (e: any) {
      toast.error(e.message || "Could not add the allergy");
    } finally {
      setSavingAllergy(false);
    }
  };

  const toggleAllergyActive = async (a: AllergyRow) => {
    try {
      await adminApi.patch(`/api/admin/allergies/${a.id}`, { active: !a.active });
      loadAllergies();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const openEditAllergy = (a: AllergyRow) => {
    setEditAllergyId(a.id);
    setEditAllergyLabel(a.label);
    setEditAllergyActive(a.active);
  };

  const saveAllergyEdit = async () => {
    if (!editAllergyId || !editAllergyLabel.trim()) return;
    setSavingAllergyEdit(true);
    try {
      await adminApi.patch(`/api/admin/allergies/${editAllergyId}`, { label: editAllergyLabel, active: editAllergyActive });
      setEditAllergyId(null);
      loadAllergies();
    } catch (e: any) {
      toast.error(e.message || "Could not save the allergy");
    } finally {
      setSavingAllergyEdit(false);
    }
  };


  // ---------- Medications & Herbs tab ----------
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [newMedicationLabel, setNewMedicationLabel] = useState({ supplement: "", medication: "" });
  const [savingMedication, setSavingMedication] = useState<string | null>(null);
  const [medicationTotalPatients, setMedicationTotalPatients] = useState(0);
  const [addMedicationDialogOpen, setAddMedicationDialogOpen] = useState(false);
  const [addMedicationKind, setAddMedicationKind] = useState<"supplement" | "medication">("supplement");
  const [editMedicationId, setEditMedicationId] = useState<string | null>(null);
  const [editMedicationLabel, setEditMedicationLabel] = useState("");
  const [editMedicationActive, setEditMedicationActive] = useState(true);
  const [savingMedicationEdit, setSavingMedicationEdit] = useState(false);

  const loadMedications = () => {
    adminApi.get<{ medications: MedicationRow[]; totalPatients: number }>("/api/admin/medications")
      .then((res) => { setMedications(res.medications || []); setMedicationTotalPatients(res.totalPatients || 0); })
      .catch(() => toast.error("Could not load medications"));
  };
  useEffect(() => { loadMedications(); }, []);

  // Reference profile status per supplement / medication (built in the background).
  const [profileStatuses, setProfileStatuses] = useState<Record<string, { status: string; sourced: boolean; completeness: number; pendingReview: number }>>({});
  const [profileTagId, setProfileTagId] = useState<string | null>(null);
  const loadProfileStatuses = () => {
    const kind = activeCategory === "medications" ? "medication" : "supplement";
    adminApi.get<{ statuses: typeof profileStatuses }>(`/api/admin/supplement-profiles?kind=${kind}`)
      .then((res) => setProfileStatuses((prev) => ({ ...prev, ...(res.statuses || {}) })))
      .catch(() => {});
  };
  useEffect(() => { if (activeCategory === "supplements" || activeCategory === "medications") loadProfileStatuses(); }, [activeCategory]);
  // While any supplement's profile is still being built, refresh the badges.
  const profileKind = activeCategory === "medications" ? "medication" : "supplement";
  const anyProfilePending = (activeCategory === "supplements" || activeCategory === "medications") &&
    medications.some((m) => m.kind === profileKind && profileStatuses[m.id] && profileStatuses[m.id].status !== "enriched" && profileStatuses[m.id].status !== "failed");
  useEffect(() => {
    if (!anyProfilePending) return;
    const t = setInterval(loadProfileStatuses, 6000);
    return () => clearInterval(t);
  }, [anyProfilePending]);

  // Rows for Supplements & Herbs (shown inside the Patient sidebar) and
  // Medications (its own tab) — one renderer so both stay identical.
  const renderMedicationRows = (kind: "supplement" | "medication") => {
    const list = medications.filter((m) => m.kind === kind);
    return (
      <div className="space-y-1.5">
        {sortByLabel(list).map((m) => (
          <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
            <span className={cn("flex-1 text-sm", !m.active && "text-muted-foreground line-through")}>{m.label}</span>
            {(() => {
              const info = profileStatuses[m.id];
              const st = info?.status;
              return (
                <button
                  type="button"
                  onClick={() => setProfileTagId(m.id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-background",
                    st === "enriched" && info.sourced ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : st === "enriched" ? "border-border text-muted-foreground"
                      : st === "failed" ? "border-destructive/30 text-destructive"
                      : st ? "border-amber-400/40 text-amber-600 dark:text-amber-400"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {st === "enriched" ? <Info className="h-3 w-3" /> : st === "failed" ? <TriangleAlert className="h-3 w-3" /> : st ? <Loader2 className="h-3 w-3 animate-spin" /> : <Info className="h-3 w-3" />}
                  {st === "enriched"
                    ? info.sourced ? `Profile · ${info.completeness}%${info.pendingReview ? ` · ${info.pendingReview} to review` : ""}` : "Profile · not yet sourced"
                    : st === "failed" ? "Profile failed" : st ? "Building profile" : "No profile yet"}
                </button>
              );
            })()}
            <Badge variant="secondary" className="shrink-0 font-normal text-xs whitespace-nowrap">
              {m.patientCount} patient{m.patientCount === 1 ? "" : "s"} ({m.patientPercent}%)
            </Badge>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditMedication(m)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <span className={cn("text-xs font-medium w-14 text-right", m.active ? "text-emerald-500" : "text-muted-foreground")}>
              {m.active ? "Active" : "Inactive"}
            </span>
            <Switch checked={m.active} onCheckedChange={() => toggleMedicationActive(m)} />
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">{kind === "supplement" ? "No Unani medicines yet." : "No allopathic medicines yet."}</p>
        )}
      </div>
    );
  };

  const addMedicationTag = async (kind: "supplement" | "medication") => {
    const label = newMedicationLabel[kind];
    if (!label.trim()) { toast.error("Enter a label"); return; }
    setSavingMedication(kind);
    try {
      await adminApi.post("/api/admin/medications", { kind, label });
      setNewMedicationLabel((v) => ({ ...v, [kind]: "" }));
      setAddMedicationDialogOpen(false);
      loadMedications();
    } catch (e: any) {
      toast.error(e.message || "Could not add");
    } finally {
      setSavingMedication(null);
    }
  };

  const toggleMedicationActive = async (m: MedicationRow) => {
    try {
      await adminApi.patch(`/api/admin/medications/${m.id}`, { active: !m.active });
      loadMedications();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  const openEditMedication = (m: MedicationRow) => {
    setEditMedicationId(m.id);
    setEditMedicationLabel(m.label);
    setEditMedicationActive(m.active);
  };

  const saveMedicationEdit = async () => {
    if (!editMedicationId || !editMedicationLabel.trim()) return;
    setSavingMedicationEdit(true);
    try {
      await adminApi.patch(`/api/admin/medications/${editMedicationId}`, { label: editMedicationLabel, active: editMedicationActive });
      setEditMedicationId(null);
      loadMedications();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSavingMedicationEdit(false);
    }
  };

  // ---------- Red Flags tab ----------
  const [redFlags, setRedFlags] = useState<RedFlagRow[]>([]);
  const [addRedFlagDialogOpen, setAddRedFlagDialogOpen] = useState(false);
  const [newRedFlagLabel, setNewRedFlagLabel] = useState("");
  const [newRedFlagDescription, setNewRedFlagDescription] = useState("");
  const [savingRedFlag, setSavingRedFlag] = useState(false);
  const [editRedFlagId, setEditRedFlagId] = useState<string | null>(null);
  const [editRedFlagLabel, setEditRedFlagLabel] = useState("");
  const [editRedFlagDescription, setEditRedFlagDescription] = useState("");
  const [editRedFlagActive, setEditRedFlagActive] = useState(true);
  const [savingRedFlagEdit, setSavingRedFlagEdit] = useState(false);

  const loadRedFlags = () => {
    adminApi.get<{ criteria: RedFlagRow[] }>("/api/admin/red-flags")
      .then((res) => setRedFlags(res.criteria || []))
      .catch(() => toast.error("Could not load red flags"));
  };
  useEffect(() => { loadRedFlags(); }, []);

  const addRedFlag = async () => {
    if (!newRedFlagLabel.trim()) { toast.error("Enter a label"); return; }
    setSavingRedFlag(true);
    try {
      await adminApi.post("/api/admin/red-flags", { label: newRedFlagLabel, description: newRedFlagDescription || undefined });
      setNewRedFlagLabel(""); setNewRedFlagDescription("");
      setAddRedFlagDialogOpen(false);
      loadRedFlags();
    } catch (e: any) {
      toast.error(e.message || "Could not add");
    } finally {
      setSavingRedFlag(false);
    }
  };

  const toggleRedFlagActive = async (r: RedFlagRow) => {
    try {
      await adminApi.patch(`/api/admin/red-flags/${r.id}`, { active: !r.active });
      loadRedFlags();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };


  const openEditRedFlag = (r: RedFlagRow) => {
    setEditRedFlagId(r.id);
    setEditRedFlagLabel(r.label);
    setEditRedFlagDescription(r.description || "");
    setEditRedFlagActive(r.active);
  };

  const saveRedFlagEdit = async () => {
    if (!editRedFlagId || !editRedFlagLabel.trim()) return;
    setSavingRedFlagEdit(true);
    try {
      await adminApi.patch(`/api/admin/red-flags/${editRedFlagId}`, {
        label: editRedFlagLabel, description: editRedFlagDescription || null, active: editRedFlagActive,
      });
      setEditRedFlagId(null);
      loadRedFlags();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSavingRedFlagEdit(false);
    }
  };

  // ---------- Acute Symptoms tab ----------
  const [acuteSymptoms, setAcuteSymptoms] = useState<AcuteSymptomRow[]>([]);
  const [addSymptomDialogOpen, setAddSymptomDialogOpen] = useState(false);
  const [newSymptomLabel, setNewSymptomLabel] = useState("");
  const [newSymptomDescription, setNewSymptomDescription] = useState("");
  const [savingSymptom, setSavingSymptom] = useState(false);
  const [editSymptomId, setEditSymptomId] = useState<string | null>(null);
  const [editSymptomLabel, setEditSymptomLabel] = useState("");
  const [editSymptomDescription, setEditSymptomDescription] = useState("");
  const [editSymptomActive, setEditSymptomActive] = useState(true);
  const [savingSymptomEdit, setSavingSymptomEdit] = useState(false);

  const loadAcuteSymptoms = () => {
    adminApi.get<{ symptoms: AcuteSymptomRow[] }>("/api/admin/acute-symptoms")
      .then((res) => setAcuteSymptoms(res.symptoms || []))
      .catch(() => toast.error("Could not load acute symptoms"));
  };
  useEffect(() => { loadAcuteSymptoms(); }, []);

  const addAcuteSymptom = async () => {
    if (!newSymptomLabel.trim()) { toast.error("Enter a label"); return; }
    setSavingSymptom(true);
    try {
      await adminApi.post("/api/admin/acute-symptoms", { label: newSymptomLabel, description: newSymptomDescription || undefined });
      setNewSymptomLabel(""); setNewSymptomDescription("");
      setAddSymptomDialogOpen(false);
      loadAcuteSymptoms();
    } catch (e: any) {
      toast.error(e.message || "Could not add");
    } finally {
      setSavingSymptom(false);
    }
  };

  const toggleAcuteSymptomActive = async (s: AcuteSymptomRow) => {
    try {
      await adminApi.patch(`/api/admin/acute-symptoms/${s.id}`, { active: !s.active });
      loadAcuteSymptoms();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };


  const openEditAcuteSymptom = (s: AcuteSymptomRow) => {
    setEditSymptomId(s.id);
    setEditSymptomLabel(s.label);
    setEditSymptomDescription(s.description || "");
    setEditSymptomActive(s.active);
  };

  const saveAcuteSymptomEdit = async () => {
    if (!editSymptomId || !editSymptomLabel.trim()) return;
    setSavingSymptomEdit(true);
    try {
      await adminApi.patch(`/api/admin/acute-symptoms/${editSymptomId}`, {
        label: editSymptomLabel, description: editSymptomDescription || null, active: editSymptomActive,
      });
      setEditSymptomId(null);
      loadAcuteSymptoms();
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSavingSymptomEdit(false);
    }
  };


  // ---------- Chief Complaints tab ----------
  const [newComplaintLabel, setNewComplaintLabel] = useState("");
  const [newComplaintLocal, setNewComplaintLocal] = useState("");
  const [newComplaintCategory, setNewComplaintCategory] = useState("");
  const [savingComplaint, setSavingComplaint] = useState(false);
  const [selectedComplaintCategory, setSelectedComplaintCategory] = useState<string | null>(null);
  const [addComplaintDialogOpen, setAddComplaintDialogOpen] = useState(false);
  // Categories aren't a standalone entity — a category only exists because
  // some ChiefComplaint references it — so "adding a category" really means
  // adding its first complaint. This flag just changes the dialog's copy and
  // stops it from silently falling back to whatever category was previously
  // selected if the admin forgets to type the new one.
  const [addingNewCategory, setAddingNewCategory] = useState(false);

  const existingComplaintCategories = useMemo(() => {
    if (!screeningConfig) return [];
    return Array.from(new Set(screeningConfig.complaints.map((c) => c.category))).sort();
  }, [screeningConfig]);

  useEffect(() => {
    if (!selectedComplaintCategory && existingComplaintCategories.length) {
      setSelectedComplaintCategory(existingComplaintCategories[0]);
    }
  }, [existingComplaintCategories]);

  const complaintsInSelectedCategory = useMemo(
    () => sortByLabel((screeningConfig?.complaints || []).filter((c) => c.category === selectedComplaintCategory)),
    [screeningConfig, selectedComplaintCategory]
  );

  const addComplaint = async () => {
    if (!newComplaintLabel.trim()) { toast.error("Enter a label"); return; }
    if (addingNewCategory && !newComplaintCategory.trim()) { toast.error("Enter a name for the new category"); return; }
    const category = addingNewCategory ? newComplaintCategory.trim() : (newComplaintCategory || selectedComplaintCategory || undefined);
    setSavingComplaint(true);
    try {
      await adminApi.post("/api/admin/screening/complaints", {
        label: newComplaintLabel, labelLocal: newComplaintLocal || undefined,
        category,
      });
      if (addingNewCategory && category) setSelectedComplaintCategory(category);
      setNewComplaintLabel(""); setNewComplaintLocal(""); setNewComplaintCategory("");
      setAddComplaintDialogOpen(false);
      loadScreening();
    } catch (e: any) {
      toast.error(e.message || "Could not add the complaint");
    } finally {
      setSavingComplaint(false);
    }
  };

  const toggleComplaintActive = async (c: ChiefComplaintRow) => {
    try {
      await adminApi.patch(`/api/admin/screening/complaints/${c.id}`, { active: !c.active });
      loadScreening();
    } catch (e: any) {
      toast.error(e.message || "Could not update");
    }
  };

  // ---------- Chief Complaint edit dialog ----------
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
  const [editingComplaintId, setEditingComplaintId] = useState<string | null>(null);
  const [complaintDraft, setComplaintDraft] = useState({ label: "", labelLocal: "", category: "", active: true });
  const [savingComplaintEdit, setSavingComplaintEdit] = useState(false);

  const openEditComplaint = (c: ChiefComplaintRow) => {
    setEditingComplaintId(c.id);
    setComplaintDraft({ label: c.label, labelLocal: c.labelLocal || "", category: c.category, active: c.active });
    setComplaintDialogOpen(true);
  };

  const saveComplaintEdit = async () => {
    if (!editingComplaintId) return;
    if (!complaintDraft.label.trim()) { toast.error("Enter a label"); return; }
    setSavingComplaintEdit(true);
    try {
      await adminApi.patch(`/api/admin/screening/complaints/${editingComplaintId}`, {
        label: complaintDraft.label, labelLocal: complaintDraft.labelLocal || null, category: complaintDraft.category || "General", active: complaintDraft.active,
      });
      setComplaintDialogOpen(false);
      if (complaintDraft.category && complaintDraft.category !== selectedComplaintCategory) {
        setSelectedComplaintCategory(complaintDraft.category);
      }
      loadScreening();
    } catch (e: any) {
      toast.error(e.message || "Could not save the complaint");
    } finally {
      setSavingComplaintEdit(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Meta ({sections.length})</h1>
        </div>
        {activeCategory === "complaints" ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => { setNewComplaintLabel(""); setNewComplaintLocal(""); setNewComplaintCategory(""); setAddingNewCategory(true); setAddComplaintDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Category
            </Button>
            <Button
              size="sm"
              disabled={!selectedComplaintCategory}
              onClick={() => { setNewComplaintLabel(""); setNewComplaintLocal(""); setNewComplaintCategory(selectedComplaintCategory || ""); setAddingNewCategory(false); setAddComplaintDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Complaint
            </Button>
          </div>
        ) : activeCategory === "allergies" ? (
          <Button size="sm" onClick={() => setAddAllergyDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "supplements" ? (
          <Button size="sm" onClick={() => { setAddMedicationKind("supplement"); setAddMedicationDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "medications" ? (
          <Button size="sm" onClick={() => { setAddMedicationKind("medication"); setAddMedicationDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "aggravating" || activeCategory === "relieving" ? (
          <Button size="sm" onClick={() => { setNewFactorLabel(""); setAddFactorKind(activeCategory); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "onset" ? (
          <Button size="sm" onClick={() => setOnsetDialog({ id: null, label: "", description: "", active: true })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "regions" ? (
          <Button size="sm" onClick={() => setRegionDialog({ id: null, label: "", localTerms: "", icon: "activity", gender: "all", bodyZone: "none", active: true })}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "redflags" ? (
          <Button size="sm" onClick={() => setAddRedFlagDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : activeCategory === "symptoms" ? (
          <Button size="sm" onClick={() => setAddSymptomDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        ) : !isScreeningTab && selected && (
          <Button size="sm" onClick={() => setAddOptionDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add New
          </Button>
        )}
      </div>

      {/* Red Flags has no top-bar tab of its own (it lives in the Patient
          category's sidebar instead) — use sidebarCategory here too so
          viewing it highlights "Patient" rather than leaving every tab
          unselected because "redflags" doesn't match any TabsTrigger. */}
      <Tabs value={sidebarCategory || categories[0] || SCREENING_TABS[0]} onValueChange={onTabChange} className="mb-6">
        <TabsList>
          {categories.map((c) => (
            <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
          ))}
          {TOP_BAR_SCREENING_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>{SCREENING_TAB_LABELS[t]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ==================== L1 Screening panels ==================== */}
      {activeCategory === "complaints" && (
        loadingScreening ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : screeningConfig && (
          <div className="grid md:grid-cols-[260px_1fr] gap-6">
            <Card className="p-2 border-border/50 bg-card/60 h-fit">
              <div className="space-y-1">
                {existingComplaintCategories.map((cat) => {
                  const count = screeningConfig.complaints.filter((c) => c.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedComplaintCategory(cat)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                        selectedComplaintCategory === cat ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ListChecks className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{cat}</span>
                      </span>
                      <Badge variant={selectedComplaintCategory === cat ? "outline" : "secondary"} className={cn("shrink-0", selectedComplaintCategory === cat && "border-primary-foreground/40 text-primary-foreground")}>
                        {count}
                      </Badge>
                    </button>
                  );
                })}
                {existingComplaintCategories.length === 0 && <p className="text-sm text-muted-foreground p-3">No categories yet.</p>}
              </div>
            </Card>

            <Card className="p-5 border-border/50 bg-card/60 gap-4">
              <div>
                <h2 className="font-serif text-lg font-semibold">{selectedComplaintCategory || "Select a category"}</h2>
                <p className="text-sm text-muted-foreground mt-1">{complaintsInSelectedCategory.length} chief complaint{complaintsInSelectedCategory.length === 1 ? "" : "s"} in this category</p>
              </div>

              <div className="space-y-1.5">
                {complaintsInSelectedCategory.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{c.label}</span>
                      {c.labelLocal && <span className="text-xs text-muted-foreground ml-2">{c.labelLocal}</span>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditComplaint(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <span className={cn("text-xs font-medium w-14 text-right", c.active ? "text-emerald-500" : "text-muted-foreground")}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                    <Switch checked={c.active} onCheckedChange={() => toggleComplaintActive(c)} />
                  </div>
                ))}
                {complaintsInSelectedCategory.length === 0 && <p className="text-sm text-muted-foreground">No chief complaints in this category yet.</p>}
              </div>
            </Card>
          </div>
        )
      )}

      <datalist id="screening-categories">
        {existingComplaintCategories.map((cat) => <option key={cat} value={cat} />)}
      </datalist>

      {/* ---------- Add Chief Complaint dialog ---------- */}
      <Dialog open={addComplaintDialogOpen} onOpenChange={setAddComplaintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addingNewCategory ? "New Category" : `Add to ${selectedComplaintCategory}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addingNewCategory && (
              <p className="text-sm text-muted-foreground -mt-1">
                Categories aren&apos;t a separate list — they exist as soon as a chief complaint uses them. Name the new category and its first complaint below.
              </p>
            )}
            <FloatingField
              id="newComplaintCategory"
              label={addingNewCategory ? "New category name" : "Category"}
              value={newComplaintCategory}
              onChange={(e) => setNewComplaintCategory(e.target.value)}
              list={addingNewCategory ? undefined : "screening-categories"}
              required={addingNewCategory}
            />
            <FloatingField
              id="newComplaintLabel"
              label="Label (e.g. Fever)"
              value={newComplaintLabel}
              onChange={(e) => setNewComplaintLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addComplaint(); }}
              required
            />
            <FloatingField
              id="newComplaintLocal"
              label="Local translation (optional)"
              value={newComplaintLocal}
              onChange={(e) => setNewComplaintLocal(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddComplaintDialogOpen(false)}>Cancel</Button>
            <Button onClick={addComplaint} disabled={savingComplaint || !newComplaintLabel.trim() || (addingNewCategory && !newComplaintCategory.trim())}>
              {savingComplaint ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Chief Complaint edit dialog ---------- */}
      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Chief Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editComplaintLabel"
              label="Label"
              value={complaintDraft.label}
              onChange={(e) => setComplaintDraft((d) => ({ ...d, label: e.target.value }))}
            />
            <FloatingField
              id="editComplaintLocal"
              label="Local translation (optional)"
              value={complaintDraft.labelLocal}
              onChange={(e) => setComplaintDraft((d) => ({ ...d, labelLocal: e.target.value }))}
            />
            <FloatingField
              id="editComplaintCategory"
              label="Category"
              value={complaintDraft.category}
              onChange={(e) => setComplaintDraft((d) => ({ ...d, category: e.target.value }))}
              list="screening-categories"
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", complaintDraft.active ? "text-emerald-500" : "text-muted-foreground")}>
                {complaintDraft.active ? "Active" : "Inactive"}
              </span>
              <Switch checked={complaintDraft.active} onCheckedChange={(v) => setComplaintDraft((d) => ({ ...d, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplaintDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveComplaintEdit} disabled={savingComplaintEdit}>
              {savingComplaintEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeCategory === "asbab" && <AsbabAdmin />}
      {activeCategory === "tashkhees" && <TashkheesAdmin />}

      {/* ---------- Add / Edit Onset option dialog ---------- */}
      <Dialog open={onsetDialog !== null} onOpenChange={(open) => { if (!open) setOnsetDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{onsetDialog?.id ? "Edit Onset Option" : "Add Onset Option"}</DialogTitle>
          </DialogHeader>
          {onsetDialog && (
            <div className="space-y-4">
              <FloatingField
                id="onsetLabel"
                label="Option (e.g. Nocturnal Exacerbation (Layli))"
                value={onsetDialog.label}
                onChange={(e) => setOnsetDialog((d) => d && { ...d, label: e.target.value })}
              />
              <FloatingField
                id="onsetDescription"
                label="Short description (e.g. Worse at night)"
                value={onsetDialog.description}
                onChange={(e) => setOnsetDialog((d) => d && { ...d, description: e.target.value })}
              />
              {onsetDialog.id && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
                  <span className={cn("text-sm font-medium", onsetDialog.active ? "text-emerald-500" : "text-muted-foreground")}>
                    {onsetDialog.active ? "Active" : "Inactive"}
                  </span>
                  <Switch checked={onsetDialog.active} onCheckedChange={(v) => setOnsetDialog((d) => d && { ...d, active: v })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOnsetDialog(null)}>Cancel</Button>
            <Button onClick={saveOnset} disabled={savingOnset || !onsetDialog?.label.trim()}>
              {savingOnset ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {onsetDialog?.id ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Add / Edit Anatomical Region dialog ---------- */}
      <Dialog open={regionDialog !== null} onOpenChange={(open) => { if (!open) setRegionDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{regionDialog?.id ? "Edit Region" : "Add Region"}</DialogTitle>
          </DialogHeader>
          {regionDialog && (
            <div className="space-y-4">
              <FloatingField
                id="regionLabel"
                label="Region / organ system (e.g. Renal / Urinary)"
                value={regionDialog.label}
                onChange={(e) => setRegionDialog((d) => d && { ...d, label: e.target.value })}
              />
              <FloatingField
                id="regionLocalTerms"
                label="Unani terms (e.g. Kulyah / Masanah)"
                value={regionDialog.localTerms}
                onChange={(e) => setRegionDialog((d) => d && { ...d, localTerms: e.target.value })}
              />
              <FloatingSelect id="regionIcon" label="Icon" value={regionDialog.icon} onValueChange={(v) => setRegionDialog((d) => d && { ...d, icon: v })}>
                {Object.entries(ANATOMICAL_REGION_ICONS).map(([key, { label, Icon }]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</span>
                  </SelectItem>
                ))}
              </FloatingSelect>
              <FloatingSelect id="regionZone" label="Body area (Stage 3 body map)" value={regionDialog.bodyZone} onValueChange={(v) => setRegionDialog((d) => d && { ...d, bodyZone: v })}>
                <SelectItem value="none">Not shown on the body map</SelectItem>
                {Object.entries(BODY_ZONES).map(([key, z]) => (
                  <SelectItem key={key} value={key}>{z.label}{z.front && z.back ? "" : z.back ? " (back view)" : " (front view)"}</SelectItem>
                ))}
              </FloatingSelect>
              <FloatingSelect id="regionGender" label="Applies to" value={regionDialog.gender} onValueChange={(v) => setRegionDialog((d) => d && { ...d, gender: v })}>
                {REGION_GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </FloatingSelect>
              {regionDialog.id && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
                  <span className={cn("text-sm font-medium", regionDialog.active ? "text-emerald-500" : "text-muted-foreground")}>
                    {regionDialog.active ? "Active" : "Inactive"}
                  </span>
                  <Switch checked={regionDialog.active} onCheckedChange={(v) => setRegionDialog((d) => d && { ...d, active: v })} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegionDialog(null)}>Cancel</Button>
            <Button onClick={saveRegion} disabled={savingRegion || !regionDialog?.label.trim()}>
              {savingRegion ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {regionDialog?.id ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Add Factor dialog ---------- */}
      <Dialog open={addFactorKind !== null} onOpenChange={(open) => { if (!open) setAddFactorKind(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {addFactorKind ? FACTOR_META[addFactorKind].muted : "Factor"}</DialogTitle>
          </DialogHeader>
          <FloatingField
            id="newFactorLabel"
            label={addFactorKind ? `Label (${FACTOR_META[addFactorKind].placeholder})` : "Label"}
            value={newFactorLabel}
            onChange={(e) => setNewFactorLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addFactorTag(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFactorKind(null)}>Cancel</Button>
            <Button onClick={addFactorTag} disabled={savingFactor || !newFactorLabel.trim()}>
              {savingFactor ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Edit Factor dialog ---------- */}
      <Dialog open={editFactor !== null} onOpenChange={(open) => { if (!open) setEditFactor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editFactor ? FACTOR_META[editFactor.kind].muted : "Factor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editFactorLabel"
              label="Label"
              value={editFactorLabel}
              onChange={(e) => setEditFactorLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveFactorEdit(); }}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", editFactorActive ? "text-emerald-500" : "text-muted-foreground")}>
                {editFactorActive ? "Active" : "Inactive"}
              </span>
              <Switch checked={editFactorActive} onCheckedChange={setEditFactorActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFactor(null)}>Cancel</Button>
            <Button onClick={saveFactorEdit} disabled={savingFactorEdit}>
              {savingFactorEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Add Allergy dialog ---------- */}
      <Dialog open={addAllergyDialogOpen} onOpenChange={setAddAllergyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Allergy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="newAllergyLabel"
              label="Label (e.g. Penicillin)"
              value={newAllergyLabel}
              onChange={(e) => setNewAllergyLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addAllergy(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAllergyDialogOpen(false)}>Cancel</Button>
            <Button onClick={addAllergy} disabled={savingAllergy || !newAllergyLabel.trim()}>
              {savingAllergy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Edit Allergy dialog ---------- */}
      <Dialog open={editAllergyId !== null} onOpenChange={(open) => { if (!open) setEditAllergyId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Allergy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editAllergyLabel"
              label="Label"
              value={editAllergyLabel}
              onChange={(e) => setEditAllergyLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAllergyEdit(); }}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", editAllergyActive ? "text-emerald-500" : "text-muted-foreground")}>
                {editAllergyActive ? "Active" : "Inactive"}
              </span>
              <Switch checked={editAllergyActive} onCheckedChange={setEditAllergyActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAllergyId(null)}>Cancel</Button>
            <Button onClick={saveAllergyEdit} disabled={savingAllergyEdit}>
              {savingAllergyEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ---------- Add Acute Symptom dialog ---------- */}
      <Dialog open={addSymptomDialogOpen} onOpenChange={setAddSymptomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Acute Symptom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="newSymptomLabel"
              label="Label (e.g. Burning epigastric sensation)"
              value={newSymptomLabel}
              onChange={(e) => setNewSymptomLabel(e.target.value)}
            />
            <FloatingField
              id="newSymptomDescription"
              label="Unani term / description (optional)"
              value={newSymptomDescription}
              onChange={(e) => setNewSymptomDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addAcuteSymptom(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSymptomDialogOpen(false)}>Cancel</Button>
            <Button onClick={addAcuteSymptom} disabled={savingSymptom || !newSymptomLabel.trim()}>
              {savingSymptom ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Edit Acute Symptom dialog ---------- */}
      <Dialog open={editSymptomId !== null} onOpenChange={(open) => { if (!open) setEditSymptomId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Acute Symptom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editSymptomLabel"
              label="Label"
              value={editSymptomLabel}
              onChange={(e) => setEditSymptomLabel(e.target.value)}
            />
            <FloatingField
              id="editSymptomDescription"
              label="Unani term / description (optional)"
              value={editSymptomDescription}
              onChange={(e) => setEditSymptomDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAcuteSymptomEdit(); }}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", editSymptomActive ? "text-emerald-500" : "text-muted-foreground")}>
                {editSymptomActive ? "Active" : "Inactive"}
              </span>
              <Switch checked={editSymptomActive} onCheckedChange={setEditSymptomActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSymptomId(null)}>Cancel</Button>
            <Button onClick={saveAcuteSymptomEdit} disabled={savingSymptomEdit}>
              {savingSymptomEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <SupplementProfileDialog
        tagId={profileTagId}
        onOpenChange={(open) => { if (!open) setProfileTagId(null); }}
        onEnriched={loadProfileStatuses}
      />

      {/* ---------- Add Medication dialog ---------- */}
      <Dialog open={addMedicationDialogOpen} onOpenChange={setAddMedicationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addMedicationKind === "supplement" ? "Add Unani Medicine" : "Add Allopathic Medicine"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="newMedicationLabel"
              label={addMedicationKind === "supplement" ? "Label (e.g. Khamira Gaozaban)" : "Label (e.g. Levothyroxine)"}
              value={newMedicationLabel[addMedicationKind]}
              onChange={(e) => setNewMedicationLabel((v) => ({ ...v, [addMedicationKind]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") addMedicationTag(addMedicationKind); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMedicationDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => addMedicationTag(addMedicationKind)} disabled={savingMedication === addMedicationKind || !newMedicationLabel[addMedicationKind].trim()}>
              {savingMedication === addMedicationKind ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Edit Medication dialog ---------- */}
      <Dialog open={editMedicationId !== null} onOpenChange={(open) => { if (!open) setEditMedicationId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editMedicationLabel"
              label="Label"
              value={editMedicationLabel}
              onChange={(e) => setEditMedicationLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveMedicationEdit(); }}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", editMedicationActive ? "text-emerald-500" : "text-muted-foreground")}>
                {editMedicationActive ? "Active" : "Inactive"}
              </span>
              <Switch checked={editMedicationActive} onCheckedChange={setEditMedicationActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMedicationId(null)}>Cancel</Button>
            <Button onClick={saveMedicationEdit} disabled={savingMedicationEdit}>
              {savingMedicationEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Add Red Flag dialog ---------- */}
      <Dialog open={addRedFlagDialogOpen} onOpenChange={setAddRedFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Red Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="newRedFlagLabel"
              label="Label (e.g. Severe acute chest pain / Angina)"
              value={newRedFlagLabel}
              onChange={(e) => setNewRedFlagLabel(e.target.value)}
            />
            <FloatingField
              id="newRedFlagDescription"
              label="Clinical rationale (optional)"
              value={newRedFlagDescription}
              onChange={(e) => setNewRedFlagDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRedFlag(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRedFlagDialogOpen(false)}>Cancel</Button>
            <Button onClick={addRedFlag} disabled={savingRedFlag || !newRedFlagLabel.trim()}>
              {savingRedFlag ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Edit Red Flag dialog ---------- */}
      <Dialog open={editRedFlagId !== null} onOpenChange={(open) => { if (!open) setEditRedFlagId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Red Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editRedFlagLabel"
              label="Label"
              value={editRedFlagLabel}
              onChange={(e) => setEditRedFlagLabel(e.target.value)}
            />
            <FloatingField
              id="editRedFlagDescription"
              label="Clinical rationale (optional)"
              value={editRedFlagDescription}
              onChange={(e) => setEditRedFlagDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveRedFlagEdit(); }}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", editRedFlagActive ? "text-emerald-500" : "text-muted-foreground")}>
                {editRedFlagActive ? "Active" : "Inactive"}
              </span>
              <Switch checked={editRedFlagActive} onCheckedChange={setEditRedFlagActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRedFlagId(null)}>Cancel</Button>
            <Button onClick={saveRedFlagEdit} disabled={savingRedFlagEdit}>
              {savingRedFlagEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Generic Meta section editor ==================== */}
      {(!isScreeningTab || (activeCategory !== null && PATIENT_SIDEBAR_TABS.includes(activeCategory))) && (
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <Card className="p-2 border-border/50 bg-card/60 h-fit">
            {loadingSections ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : (
              <div className="space-y-1">
                {sectionsInActiveCategory.map((s) => (
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
                {sectionsInActiveCategory.length === 0 && <p className="text-sm text-muted-foreground p-3">No sections in this category yet.</p>}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/allergies")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "allergies" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Pill className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Allergies</span>
                    </span>
                    <Badge
                      variant={activeCategory === "allergies" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "allergies" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {allergies.length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/supplements")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "supplements" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Leaf className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Unani Medicine</span>
                    </span>
                    <Badge
                      variant={activeCategory === "supplements" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "supplements" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {medications.filter((m) => m.kind === "supplement").length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/medications")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "medications" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Tablets className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Allopathic Medicine</span>
                    </span>
                    <Badge
                      variant={activeCategory === "medications" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "medications" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {medications.filter((m) => m.kind === "medication").length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/aggravating")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "aggravating" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">Aggravating Factors <span className="whitespace-nowrap">(Muharrikat)</span></span>
                    </span>
                    <Badge
                      variant={activeCategory === "aggravating" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "aggravating" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {factorsOf("aggravating").length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/relieving")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "relieving" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">Relieving Factors <span className="whitespace-nowrap">(Musakkinat)</span></span>
                    </span>
                    <Badge
                      variant={activeCategory === "relieving" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "relieving" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {factorsOf("relieving").length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/redflags")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "redflags" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">Emergency Warning Signs</span>
                    </span>
                    <Badge
                      variant={activeCategory === "redflags" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "redflags" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {redFlags.length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/symptoms")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "symptoms" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ListChecks className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">Accompanying Acute Symptoms <span className="whitespace-nowrap">(Alamat-e-Izafiya)</span></span>
                    </span>
                    <Badge
                      variant={activeCategory === "symptoms" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "symptoms" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {acuteSymptoms.length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/regions")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "regions" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <PersonStanding className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">Anatomical Region &amp; Organ System</span>
                    </span>
                    <Badge
                      variant={activeCategory === "regions" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "regions" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {regions.length}
                    </Badge>
                  </button>
                )}
                {sidebarCategory === "Patient" && (
                  <button
                    onClick={() => router.push("/admin/meta/onset")}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      activeCategory === "onset" ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Hourglass className="h-3.5 w-3.5 shrink-0" />
                      <span className="leading-snug">Onset Nature &amp; Rhythm</span>
                    </span>
                    <Badge
                      variant={activeCategory === "onset" ? "outline" : "secondary"}
                      className={cn("shrink-0", activeCategory === "onset" && "border-primary-foreground/40 text-primary-foreground")}
                    >
                      {onsetPatterns.length}
                    </Badge>
                  </button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 border-border/50 bg-card/60">
            {activeCategory === "redflags" ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="font-serif text-lg font-semibold">Emergency Warning Signs</h2>
                  <LastUpdated rows={redFlags} />
                </div>
                <div className="space-y-1.5">
                {sortByLabel(redFlags).map((r) => (
                  <div key={r.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
                    <TriangleAlert className="h-3.5 w-3.5 text-destructive shrink-0 mt-1" />
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="text-sm font-medium">{r.label}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openEditRedFlag(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <span className={cn("text-xs font-medium w-14 text-right shrink-0", r.active ? "text-emerald-500" : "text-muted-foreground")}>
                      {r.active ? "Active" : "Inactive"}
                    </span>
                    <Switch checked={r.active} onCheckedChange={() => toggleRedFlagActive(r)} />
                  </div>
                ))}
                {redFlags.length === 0 && <p className="text-sm text-muted-foreground">No red flags yet.</p>}
                </div>
              </>
            ) : activeCategory === "aggravating" || activeCategory === "relieving" ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="font-serif text-lg font-semibold">{FACTOR_META[activeCategory].title}</h2>
                  <LastUpdated rows={factorTags.filter((f) => f.kind === activeCategory)} />
                </div>
                {renderFactorRows(activeCategory)}
              </>
            ) : activeCategory === "onset" ? (
              <>
                <h2 className="font-serif text-lg font-semibold">Onset Nature &amp; Rhythm</h2>
                <p className="text-sm text-muted-foreground mb-3">Active options appear in Stage 3 (Mizaj &amp; Morphometry) under Onset &amp; Chronology — doctors can pick more than one.</p>
                <div className="space-y-1.5">
                  {sortByLabel(onsetPatterns).map((o) => (
                    <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
                      <Hourglass className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="text-sm font-medium">{o.label}</p>
                        {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                        onClick={() => setOnsetDialog({ id: o.id, label: o.label, description: o.description || "", active: o.active })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <span className={cn("text-xs font-medium w-14 text-right shrink-0", o.active ? "text-emerald-500" : "text-muted-foreground")}>
                        {o.active ? "Active" : "Inactive"}
                      </span>
                      <Switch checked={o.active} onCheckedChange={() => toggleOnsetActive(o)} />
                    </div>
                  ))}
                  {onsetPatterns.length === 0 && <p className="text-sm text-muted-foreground">No options yet.</p>}
                </div>
              </>
            ) : activeCategory === "regions" ? (
              <>
                <h2 className="font-serif text-lg font-semibold">Anatomical Region &amp; Organ System</h2>
                <p className="text-sm text-muted-foreground mb-3">Active regions appear as multi-select cards at the top of Stage 3 (Mizaj &amp; Morphometry). Female-only and male-only regions are shown only to patients of that recorded gender.</p>
                <div className="space-y-1.5">
                  {sortByLabel(regions).map((r) => {
                    const Icon = regionIcon(r.icon);
                    return (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0 py-0.5">
                          <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                            {r.label}
                            {r.gender !== "all" && (
                              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{r.gender === "female" ? "Female only" : "Male only"}</Badge>
                            )}
                          </p>
                          {r.localTerms && <p className="text-xs text-muted-foreground">{r.localTerms}</p>}
                          <p className="text-[11px] text-muted-foreground/80">Body map: {r.bodyZone && BODY_ZONES[r.bodyZone] ? BODY_ZONES[r.bodyZone].label : "not shown"}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                          onClick={() => setRegionDialog({ id: r.id, label: r.label, localTerms: r.localTerms || "", icon: r.icon, gender: r.gender, bodyZone: r.bodyZone || "none", active: r.active })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <span className={cn("text-xs font-medium w-14 text-right shrink-0", r.active ? "text-emerald-500" : "text-muted-foreground")}>
                          {r.active ? "Active" : "Inactive"}
                        </span>
                        <Switch checked={r.active} onCheckedChange={() => toggleRegionActive(r)} />
                      </div>
                    );
                  })}
                  {regions.length === 0 && <p className="text-sm text-muted-foreground">No regions yet.</p>}
                </div>
              </>
            ) : activeCategory === "symptoms" ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="font-serif text-lg font-semibold">Accompanying Acute Symptoms (Alamat-e-Izafiya)</h2>
                  <LastUpdated rows={acuteSymptoms} />
                </div>
        <div className="space-y-1.5">
          {sortByLabel(acuteSymptoms).map((s) => (
            <div key={s.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
              <ListChecks className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm font-medium">{s.label}</p>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openEditAcuteSymptom(s)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <span className={cn("text-xs font-medium w-14 text-right shrink-0", s.active ? "text-emerald-500" : "text-muted-foreground")}>
                {s.active ? "Active" : "Inactive"}
              </span>
              <Switch checked={s.active} onCheckedChange={() => toggleAcuteSymptomActive(s)} />
            </div>
          ))}
          {acuteSymptoms.length === 0 && <p className="text-sm text-muted-foreground">No acute symptoms yet.</p>}
        </div>
              </>
            ) : activeCategory === "allergies" ? (
              <>
                <h2 className="font-serif text-lg font-semibold">Allergies</h2>
                <div className="space-y-1.5">
                {sortByLabel(allergies).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">
                    <TriangleAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">{a.label}</span>
                    <Badge variant="secondary" className="shrink-0 font-normal text-xs whitespace-nowrap">
                      {a.patientCount} patient{a.patientCount === 1 ? "" : "s"} ({a.patientPercent}%)
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditAllergy(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <span className={cn("text-xs font-medium w-14 text-right", a.active ? "text-emerald-500" : "text-muted-foreground")}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                    <Switch checked={a.active} onCheckedChange={() => toggleAllergyActive(a)} />
                  </div>
                ))}
                {allergies.length === 0 && <p className="text-sm text-muted-foreground">No allergies yet.</p>}
                </div>
              </>
            ) : activeCategory === "supplements" ? (
              <>
                <h2 className="font-serif text-lg font-semibold">Unani Medicine</h2>
                {renderMedicationRows("supplement")}
              </>
            ) : activeCategory === "medications" ? (
              <>
                <h2 className="font-serif text-lg font-semibold">Allopathic Medicine</h2>
                {renderMedicationRows("medication")}
              </>
            ) : !selected ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <h2 className="font-serif text-lg font-semibold">{selected.label}</h2>
                    {!loadingOptions && <LastUpdated rows={options} />}
                  </div>
                  {!HIDE_STATS_KEYS.includes(selected.key) && (
                    <p className="text-sm text-muted-foreground mt-1">{total} {countNoun(countScope, total)} registered in total</p>
                  )}
                </div>

                {loadingOptions ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : options.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6">No options yet — use &quot;Add New&quot; above to add one.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sortByLabel(options).map((o) => (
                      <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40">

                        <span className={cn("flex-1 text-sm", !o.active && "text-muted-foreground line-through")}>{o.label}</span>
                        {!HIDE_STATS_KEYS.includes(selected.key) && (
                          <Badge variant="secondary" className="shrink-0 font-normal text-xs whitespace-nowrap">
                            {o.count} {countNoun(countScope, o.count)} · {total > 0 ? Math.round((o.count / total) * 100) : 0}%
                          </Badge>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(o.id); setEditingLabel(o.label); setEditingActive(o.active); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <span className={cn("text-xs font-medium w-14 text-right", o.active ? "text-emerald-500" : "text-muted-foreground")}>
                          {o.active ? "Active" : "Inactive"}
                        </span>
                        <Switch checked={o.active} onCheckedChange={() => toggleActive(o)} />
                      </div>
                    ))}
                    {unsetCount > 0 && !HIDE_STATS_KEYS.includes(selected.key) && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 bg-background/20">
                        <span className="flex-1 text-sm text-muted-foreground italic">Not set</span>
                        <Badge variant="outline" className="shrink-0 font-normal text-xs whitespace-nowrap text-muted-foreground">
                          {unsetCount} {countNoun(countScope, unsetCount)} · {total > 0 ? Math.round((unsetCount / total) * 100) : 0}%
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      <Dialog open={addOptionDialogOpen} onOpenChange={setAddOptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to {selected?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="newOptionLabel"
              label="Label"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addOption(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOptionDialogOpen(false)}>Cancel</Button>
            <Button onClick={addOption} disabled={addingOption || !newOption.trim()}>
              {addingOption ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Option</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingField
              id="editOptionLabel"
              label="Label"
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveOptionLabel(); }}
            />
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
              <span className={cn("text-sm font-medium", editingActive ? "text-emerald-500" : "text-muted-foreground")}>
                {editingActive ? "Active" : "Inactive"}
              </span>
              <Switch checked={editingActive} onCheckedChange={setEditingActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveOptionLabel} disabled={savingOptionEdit || !editingLabel.trim()}>
              {savingOptionEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
