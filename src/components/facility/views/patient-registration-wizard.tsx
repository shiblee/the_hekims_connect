"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge, ageFromDob, daysAgo, estimateDobFromAgeValue, type AgeUnit } from "@/lib/age";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect, FloatingSplitField, FieldError, FloatingMultiSelect, FloatingTextarea } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";
import { PatientStageTracker, PATIENT_JOURNEY_STEPS } from "@/components/facility/views/patient-stage-tracker";
import { InlineNotice, type Notice } from "@/components/shared/inline-notice";
import { setFlash } from "@/lib/flash";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Loader2, UserPlus, PartyPopper, ChevronLeft, X, History, IdCard, User, Contact, QrCode,
  BriefcaseMedical, Plus, TriangleAlert, Leaf, Pill, PersonStanding, Accessibility, Activity,
  Bookmark, ArrowRight, Save, CheckCircle2, RotateCw, ChevronRight,
} from "lucide-react";
import QRCode from "qrcode";

// 10-digit Indian mobile number, no leading 0/+91 — matches the backend's
// own validation on save so a bad number is caught here instead of round-tripping.
const PHONE_PATTERN = /^[6-9]\d{9}$/;

// A message shown in place on the form, optionally with a retry action.
// `kind` marks notices that resolve themselves as the form is corrected.
type ActionNotice = Notice & { retry?: () => void; retryLabel?: string; kind?: "fields" | "missing" };

const FIELD_LABELS: Record<string, string> = { name: "Patient name", phone: "Mobile number", emergencyContact: "Emergency contact number" };

/** Scrolls a field (or a section) into view and puts the cursor in it. */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = el.matches("input, button, textarea, [tabindex]") ? el : el.querySelector<HTMLElement>("input, button, textarea");
  target?.focus({ preventScroll: true });
  // Brief highlight so the eye lands on the right spot after the scroll.
  const ring = ["ring-2", "ring-amber-500/60", "ring-offset-4", "ring-offset-card", "rounded-lg", "transition-shadow"];
  el.classList.add(...ring);
  setTimeout(() => el.classList.remove(...ring), 1800);
}

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

interface Candidate {
  id: string; patientCode: string | null; name: string; titlePrefix: string | null;
  relationship: string | null; gender: string | null; dob: string | null; dobApprox?: boolean;
  maritalStatus: string | null; phone: string | null; email: string | null; avatarColor: string;
  address: string | null; state: string | null; city: string | null;
  emergencyContact: string | null; emergencyContactName: string | null;
  lastVisitAt: string | null; matchScore?: number;
}

interface Doctor { id: string; name: string; staffCode: string; designation: string | null }

interface ComplaintOption { id: string; label: string; active: boolean }
interface AllergyOption { id: string; label: string }
interface MedicationOption { id: string; kind: string; label: string }
interface MedicationEntry { label: string; kind: "supplement" | "medication" }

const ONSET_OPTIONS = [
  { value: "<24h", label: "< 24 Hours" },
  { value: "1-7d", label: "1 – 7 Days" },
  { value: ">1m", label: "> 1 Month (Chronic)" },
];

interface Result {
  patientLabel: string;
  patientCode: string;
  visitId: string;
  visitCode: string;
  doctorName?: string;
  paymentRecorded: { amount: string; mode: string } | null;
}

const emptyFormFields = {
  titlePrefix: "", name: "", relationship: "Self", gender: "",
  approxAge: "", ageUnit: "Years", maritalStatus: "", phone: "",
  emergencyContact: "", emergencyContactName: "", address: "",
};

// Normalized fingerprint of every field the reopened edit flow can touch —
// compared against the snapshot taken right after load/save to drive the
// unsaved-changes guard. Pure/stateless so it can run both at prefill time
// (from the just-fetched values) and on every render (from live state).
interface RegistrationSnapshotFields {
  titlePrefix: string; name: string; relationship: string; gender: string; approxAge: string; ageUnit: string;
  maritalStatus: string; phone: string; emergencyContact: string; emergencyContactName: string; address: string;
  cityState: string; doctorId: string; chiefComplaintIds: string[]; narrative: string; onsetTimeline: string;
  allergies: string[]; medications: MedicationEntry[]; mobility: string; amount: string; paymentMode: string;
}
const buildRegistrationSnapshot = (f: RegistrationSnapshotFields) => JSON.stringify(f);

export function PatientRegistrationWizard({ visitId, patientId }: { visitId?: string; patientId?: string } = {}) {
  const router = useRouter();
  const goToPatients = () => router.push("/facility/patients");
  // Reopened either for one specific visit (doctor's "Edit Registration" link)
  // or for a patient (clicking them on the Patients list) — the latter
  // resolves to that patient's latest visit once loaded, below.
  const directEntry = !!visitId || !!patientId;
  const [resolvedVisitId, setResolvedVisitId] = useState<string | undefined>(visitId);
  const visitEditMode = !!resolvedVisitId;
  const [loadingVisit, setLoadingVisit] = useState(directEntry);

  const [meta, setMeta] = useState<MetaSections>({});
  const [defaults, setDefaults] = useState({ state: "", city: "" });
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Identify
  const [searchMobile, setSearchMobile] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  // Whether the Patient Details section is open at all, and whether it's
  // editing a pre-filled existing patient vs. a blank new one.
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);

  // Patient details form
  const [titlePrefix, setTitlePrefix] = useState(emptyFormFields.titlePrefix);
  const [name, setName] = useState(emptyFormFields.name);
  const [relationship, setRelationship] = useState(emptyFormFields.relationship);
  const [gender, setGender] = useState(emptyFormFields.gender);
  const [approxAge, setApproxAge] = useState(emptyFormFields.approxAge);
  const [ageUnit, setAgeUnit] = useState(emptyFormFields.ageUnit);
  const [maritalStatus, setMaritalStatus] = useState(emptyFormFields.maritalStatus);
  const [phone, setPhone] = useState(emptyFormFields.phone);
  const [emergencyContact, setEmergencyContact] = useState(emptyFormFields.emergencyContact);
  const [emergencyContactName, setEmergencyContactName] = useState(emptyFormFields.emergencyContactName);
  const [address, setAddress] = useState(emptyFormFields.address);
  const [cityState, setCityState] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (key: string) => setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  // On-screen messages (no pop-ups): each sits next to what it's about.
  const [loadNotice, setLoadNotice] = useState<ActionNotice | null>(null);
  const [searchNotice, setSearchNotice] = useState<(ActionNotice & { empty?: boolean }) | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const [printNotice, setPrintNotice] = useState<Notice | null>(null);

  // Doctor
  const [doctorId, setDoctorId] = useState("");

  // Chief Complaint (front-desk intake)
  const [complaintOptions, setComplaintOptions] = useState<ComplaintOption[]>([]);
  const [chiefComplaintIds, setChiefComplaintIds] = useState<string[]>([]);
  const [complaintSearch, setComplaintSearch] = useState("");
  const [narrative, setNarrative] = useState("");
  const [onsetTimeline, setOnsetTimeline] = useState("");
  const [allergyOptions, setAllergyOptions] = useState<AllergyOption[]>([]);
  const [medicationOptions, setMedicationOptions] = useState<MedicationOption[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [medicationInput, setMedicationInput] = useState("");
  const [medicationKind, setMedicationKind] = useState<"supplement" | "medication">("supplement");
  const [mobility, setMobility] = useState("");

  // Payment (optional)
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [existingPayment, setExistingPayment] = useState<{ amount: number; mode: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Unsaved-edits guard for the reopened edit flow (directEntry) — a doctor
  // reaching this page from the Clinical Record's stepper mid-visit must
  // never lose typed-but-unsaved changes by navigating away. `savedSnapshotRef`
  // holds the last loaded-or-saved field values; null until a prefill/save
  // has actually run, so the guard stays off until there's something to lose.
  const savedSnapshotRef = useRef<string | null>(null);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api.get<{ sections: MetaSections; patientDefaults: { state: string; city: string } }>("/api/facility/metadata")
      .then((res) => {
        setMeta(res.sections || {});
        const d = res.patientDefaults || { state: "", city: "" };
        setDefaults(d);
        setCityState((cs) => cs || (d.city && d.state ? `${d.city}, ${d.state}` : ""));
      })
      .catch(() => {});
    api.get<{ staff: Doctor[] }>("/api/facility/staff?employeeType=Hakim%20(Unani%20Physician)&active=true")
      .then((res) => setDoctors(res.staff || []))
      .catch(() => {});
    api.get<{ complaints: ComplaintOption[] }>("/api/facility/screening/config")
      .then((res) => setComplaintOptions((res.complaints || []).filter((c) => c.active)))
      .catch(() => {});
    api.get<{ allergies: AllergyOption[] }>("/api/facility/allergies")
      .then((res) => setAllergyOptions(res.allergies || []))
      .catch(() => {});
    api.get<{ medications: MedicationOption[] }>("/api/facility/medications")
      .then((res) => setMedicationOptions(res.medications || []))
      .catch(() => {});
  }, []);

  // Shared prefill — pre-fills every field from a visit's existing
  // registration data, used by both re-entry paths below.
  const applyRegistrationPrefill = (res: {
    patient: {
      id: string; patientCode: string; name: string; titlePrefix: string | null; relationship: string | null;
      gender: string | null; dob: string | null; dobApprox: boolean; maritalStatus: string | null; phone: string | null;
      address: string | null; state: string | null; city: string | null;
      emergencyContact: string | null; emergencyContactName: string | null;
    };
    visit: { id: string; visitCode: string; doctorId: string | null; lastPayment: { amount: number; mode: string } | null };
    intake: {
      chiefComplaintIds: string[]; narrative: string | null; onsetTimeline: string | null;
      allergies: string; medications: string; mobility: string | null;
    } | null;
  }) => {
    const p = res.patient;
    setFormOpen(true);
    setEditingId(p.id);
    setEditingCode(p.patientCode);
    const nextTitlePrefix = p.titlePrefix || "";
    const nextRelationship = p.relationship || "Self";
    const nextGender = p.gender || "";
    const age = ageFromDob(p.dob);
    const nextApproxAge = age ? String(age.value) : "";
    const nextAgeUnit = age ? age.unit.charAt(0).toUpperCase() + age.unit.slice(1) : "Years";
    const nextMaritalStatus = p.maritalStatus || "";
    const nextPhone = p.phone || "";
    const nextEmergencyContact = p.emergencyContact || "";
    const nextEmergencyContactName = p.emergencyContactName || "";
    const nextAddress = p.address || "";
    const nextCityState = p.city && p.state ? `${p.city}, ${p.state}` : "";
    const nextDoctorId = res.visit.doctorId || "";
    const nextChiefComplaintIds = res.intake?.chiefComplaintIds || [];
    const nextNarrative = res.intake?.narrative || "";
    const nextOnsetTimeline = res.intake?.onsetTimeline || "";
    const nextAllergies: string[] = (() => { try { return JSON.parse(res.intake?.allergies || "[]"); } catch { return []; } })();
    const nextMedications: MedicationEntry[] = (() => { try { return JSON.parse(res.intake?.medications || "[]"); } catch { return []; } })();
    const nextMobility = res.intake?.mobility || "";

    setTitlePrefix(nextTitlePrefix);
    setName(p.name);
    setRelationship(nextRelationship);
    setGender(nextGender);
    setApproxAge(nextApproxAge);
    setAgeUnit(nextAgeUnit);
    setMaritalStatus(nextMaritalStatus);
    setPhone(nextPhone);
    setEmergencyContact(nextEmergencyContact);
    setEmergencyContactName(nextEmergencyContactName);
    setAddress(nextAddress);
    setCityState(nextCityState);
    setDoctorId(nextDoctorId);
    setExistingPayment(res.visit.lastPayment);
    if (res.intake) {
      setChiefComplaintIds(nextChiefComplaintIds);
      setNarrative(nextNarrative);
      setOnsetTimeline(nextOnsetTimeline);
      setAllergies(nextAllergies);
      setMedications(nextMedications);
      setMobility(nextMobility);
    }

    // Baseline for the unsaved-edits guard — reflects exactly what was just
    // loaded, not stale pre-prefill state (setters above haven't flushed yet).
    savedSnapshotRef.current = buildRegistrationSnapshot({
      titlePrefix: nextTitlePrefix, name: p.name, relationship: nextRelationship, gender: nextGender,
      approxAge: nextApproxAge, ageUnit: nextAgeUnit, maritalStatus: nextMaritalStatus, phone: nextPhone,
      emergencyContact: nextEmergencyContact, emergencyContactName: nextEmergencyContactName, address: nextAddress,
      cityState: nextCityState, doctorId: nextDoctorId,
      chiefComplaintIds: res.intake ? nextChiefComplaintIds : [], narrative: res.intake ? nextNarrative : "",
      onsetTimeline: res.intake ? nextOnsetTimeline : "", allergies: res.intake ? nextAllergies : [],
      medications: res.intake ? nextMedications : [], mobility: res.intake ? nextMobility : "",
      amount: "", paymentMode: "",
    });
  };

  // Junior-doctor edit entry point ("Edit Registration" on Doctor Review) —
  // one specific visit is already known.
  useEffect(() => {
    if (!visitId) return;
    api.get(`/api/facility/visits/${visitId}/registration`)
      .then((res: any) => applyRegistrationPrefill(res))
      .catch((e: any) => setLoadNotice({
        tone: "error", title: "This visit's registration couldn't be loaded",
        detail: `${e.message || "Network error"}. The form below may be incomplete — don't save until it loads.`,
        retry: () => window.location.reload(), retryLabel: "Reload",
      }))
      .finally(() => setLoadingVisit(false));
  }, [visitId]);

  // Patients-list entry point — only a patientId is known, so resolve it to
  // their latest visit first. A patient with no Visit yet (appointment-only,
  // never walked in) falls back to a plain editable profile instead, same
  // as picking them from the dedupe-search candidates below.
  useEffect(() => {
    if (!patientId || visitId) return;
    (async () => {
      try {
        const v = await api.get<{ visits: { id: string; visitDate: string }[] }>(`/api/facility/visits?patientId=${patientId}`);
        const latest = [...(v.visits || [])].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
        if (latest) {
          setResolvedVisitId(latest.id);
          const res = await api.get(`/api/facility/visits/${latest.id}/registration`);
          applyRegistrationPrefill(res as any);
        } else {
          const res = await api.get<{ patient: Candidate }>(`/api/facility/patients/${patientId}`);
          selectCandidate({ ...res.patient, lastVisitAt: null });
        }
      } catch (e: any) {
        setLoadNotice({
          tone: "error", title: "This patient's details couldn't be loaded",
          detail: `${e.message || "Network error"}. The form below may be incomplete — don't save until it loads.`,
          retry: () => window.location.reload(), retryLabel: "Reload",
        });
      } finally {
        setLoadingVisit(false);
      }
    })();
  }, [patientId, visitId]);

  const toggleComplaint = (id: string) => {
    setChiefComplaintIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  // Only meaningful in the reopened edit flow — a fresh registration has no
  // "previous saved state" to lose, so the guard stays inert for it.
  const isDirty = directEntry && !!editingId && savedSnapshotRef.current !== null && savedSnapshotRef.current !== buildRegistrationSnapshot({
    titlePrefix, name, relationship, gender, approxAge, ageUnit, maritalStatus, phone,
    emergencyContact, emergencyContactName, address, cityState, doctorId,
    chiefComplaintIds, narrative, onsetTimeline, allergies, medications, mobility, amount, paymentMode,
  });

  const guardedNavigate = (action: () => void) => {
    if (isDirty) {
      pendingNavRef.current = action;
      setUnsavedDialogOpen(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const complaintSearchResults = (() => {
    const q = complaintSearch.trim().toLowerCase();
    if (!q) return [];
    return complaintOptions.filter((c) => !chiefComplaintIds.includes(c.id) && c.label.toLowerCase().includes(q)).slice(0, 8);
  })();

  // The front-desk handover checklist — spans Sections 1 and 4. Emergency
  // Contact (Section 2), Doctor, and Payment are explicitly optional
  // elsewhere in the form, so they're excluded from this gate.
  const readiness = [
    { label: "Patient name", ok: !!name.trim(), target: "name" },
    { label: "Mobile number", ok: !!phone.trim(), target: "phone" },
    { label: "Gender", ok: !!gender, target: "gender" },
    { label: "Age", ok: !!approxAge, target: "approxAge" },
    { label: "Address", ok: !!address.trim(), target: "address" },
    { label: "Chief complaint", ok: chiefComplaintIds.length > 0, target: "reg-complaints" },
    { label: "Onset timeline", ok: !!onsetTimeline, target: "reg-onset" },
    { label: "Mobility", ok: !!mobility, target: "reg-mobility" },
  ];
  const mandatoryChecklist = readiness.map((r) => r.ok);

  // Self-resolving notices update live and vanish once the form is fixed.
  const openFieldErrors = Object.entries(fieldErrors).filter(([k, v]) => v && k in FIELD_LABELS);
  const footerNotice: ActionNotice | null = !actionNotice ? null
    : actionNotice.kind === "fields"
      ? openFieldErrors.length
        ? {
          ...actionNotice,
          title: openFieldErrors.length === 1 ? "1 field needs fixing before saving" : `${openFieldErrors.length} fields need fixing before saving`,
          detail: (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {openFieldErrors.map(([k, msg]) => (
                <button key={k} type="button" onClick={() => jumpTo(k)} className="underline underline-offset-2 hover:text-foreground">
                  {FIELD_LABELS[k]}: {msg}
                </button>
              ))}
            </span>
          ),
        }
        : null
      : actionNotice.kind === "missing" && mandatoryChecklist.every(Boolean) ? null : actionNotice;
  const verifiedCount = mandatoryChecklist.filter(Boolean).length;
  const mandatoryDone = verifiedCount === mandatoryChecklist.length;

  const printWristband = async (data: { patientLabel: string; patientCode: string; visitCode: string }): Promise<Notice | null> => {
    const qrValue = `${data.patientCode}|${data.visitCode}`;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrValue, { width: 220, margin: 1 });
    } catch {
      return { tone: "error", title: "The wristband barcode couldn't be generated", detail: "The patient is registered — try printing again." };
    }
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) {
      return {
        tone: "warning", title: "The print window was blocked",
        detail: "Your browser stopped the wristband window from opening. Allow pop-ups for this site (icon at the right of the address bar), then print again.",
      };
    }
    const escaped = data.patientLabel.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    win.document.write(`<!doctype html><html><head><title>Wristband — ${data.patientCode}</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        p { font-size: 13px; margin: 2px 0; color: #333; }
        img { margin-top: 16px; }
        .code { font-family: monospace; font-size: 14px; letter-spacing: 1px; margin-top: 8px; }
      </style></head>
      <body>
        <h1>${escaped}</h1>
        <p>Patient Code: ${data.patientCode}</p>
        <p>Visit: ${data.visitCode}</p>
        <img src="${qrDataUrl}" width="220" height="220" alt="QR code" />
        <p class="code">${qrValue}</p>
        <script>window.onload = () => window.print();</script>
      </body></html>`);
    win.document.close();
    win.focus();
    return null;
  };

  const addAllergy = (value?: string) => {
    const v = (value ?? allergyInput).trim();
    if (!v) return;
    setAllergies((a) => (a.some((x) => x.toLowerCase() === v.toLowerCase()) ? a : [...a, v]));
    setAllergyInput("");
  };
  const removeAllergy = (i: number) => setAllergies((a) => a.filter((_, idx) => idx !== i));

  const allergySearchResults = (() => {
    const q = allergyInput.trim().toLowerCase();
    if (!q) return [];
    return allergyOptions.filter((a) => !allergies.some((x) => x.toLowerCase() === a.label.toLowerCase()) && a.label.toLowerCase().includes(q)).slice(0, 6);
  })();

  const addMedication = (value?: string) => {
    const v = (value ?? medicationInput).trim();
    if (!v) return;
    setMedications((m) => (m.some((x) => x.kind === medicationKind && x.label.toLowerCase() === v.toLowerCase()) ? m : [...m, { label: v, kind: medicationKind }]));
    setMedicationInput("");
  };
  const removeMedication = (i: number) => setMedications((m) => m.filter((_, idx) => idx !== i));

  const medicationSearchResults = (() => {
    const q = medicationInput.trim().toLowerCase();
    if (!q) return [];
    return medicationOptions.filter((o) =>
      o.kind === medicationKind &&
      !medications.some((x) => x.kind === medicationKind && x.label.toLowerCase() === o.label.toLowerCase()) &&
      o.label.toLowerCase().includes(q)
    ).slice(0, 6);
  })();

  const clearForm = () => {
    setFormOpen(false);
    setEditingId(null); setEditingCode(null); setLastVisitAt(null);
    setTitlePrefix(emptyFormFields.titlePrefix); setName(emptyFormFields.name);
    setRelationship(emptyFormFields.relationship); setGender(emptyFormFields.gender);
    setApproxAge(emptyFormFields.approxAge); setAgeUnit(emptyFormFields.ageUnit);
    setMaritalStatus(emptyFormFields.maritalStatus); setPhone(emptyFormFields.phone);
    setEmergencyContact(emptyFormFields.emergencyContact); setEmergencyContactName(emptyFormFields.emergencyContactName);
    setAddress(emptyFormFields.address);
    setCityState(defaults.city && defaults.state ? `${defaults.city}, ${defaults.state}` : "");
    setFieldErrors({});
    setActionNotice(null);
    setChiefComplaintIds([]); setComplaintSearch(""); setNarrative(""); setOnsetTimeline("");
    setAllergies([]); setAllergyInput("");
    setMedications([]); setMedicationInput(""); setMedicationKind("supplement");
    setMobility("");
  };

  const resetAll = () => {
    setSearchMobile(""); setSearchName(""); setCandidates(null);
    clearForm();
    setDoctorId("");
    setAmount(""); setPaymentMode("");
    setResult(null);
    setPrintNotice(null);
    setSearchNotice(null);
  };

  const runSearch = async () => {
    if (!searchMobile && !searchName.trim()) {
      setSearchNotice({
        tone: "warning", empty: true,
        title: "Enter a mobile number or name to search",
        detail: "Either one is enough — the mobile number gives the most accurate match. If the patient is new here, use Add New Patient instead.",
      });
      document.getElementById("searchMobile")?.focus();
      return;
    }
    setSearchNotice(null);
    if (searchMobile && !PHONE_PATTERN.test(searchMobile)) {
      setFieldErrors((prev) => ({ ...prev, searchMobile: "Enter a valid 10-digit mobile number" }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, searchMobile: "" }));
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchMobile) params.set("mobile", searchMobile);
      if (searchName) params.set("name", searchName);
      const res = await api.get<{ candidates: Candidate[] }>(`/api/facility/patients/search?${params.toString()}`);
      setCandidates(res.candidates || []);
    } catch (e: any) {
      setCandidates(null);
      setSearchNotice({
        tone: "error", title: "The search didn't go through",
        detail: `${e.message || "Network error"}. Nothing was changed — try again.`,
        retry: () => runSearch(), retryLabel: "Search again",
      });
    } finally {
      setSearching(false);
    }
  };

  const openNewPatient = () => {
    clearForm();
    setPhone(searchMobile);
    setName(searchName);
    setFormOpen(true);
  };

  const selectCandidate = (c: Candidate) => {
    setFormOpen(true);
    setEditingId(c.id);
    setEditingCode(c.patientCode);
    setLastVisitAt(c.lastVisitAt);
    setTitlePrefix(c.titlePrefix || "");
    setName(c.name);
    setRelationship(c.relationship || "Self");
    setGender(c.gender || "");
    const age = ageFromDob(c.dob);
    setApproxAge(age ? String(age.value) : "");
    setAgeUnit(age ? age.unit.charAt(0).toUpperCase() + age.unit.slice(1) : "Years");
    setMaritalStatus(c.maritalStatus || "");
    setPhone(c.phone || "");
    setEmergencyContact(c.emergencyContact || "");
    setEmergencyContactName(c.emergencyContactName || "");
    setAddress(c.address || "");
    setCityState(c.city && c.state ? `${c.city}, ${c.state}` : "");
    setFieldErrors({});
  };

  // Field-level messages sit under each field; this summary by the save
  // buttons says what's wrong and jumps straight to it.
  const showFieldErrors = (errs: Record<string, string>) => {
    setActionNotice({ tone: "error", title: "", kind: "fields" });
    jumpTo(Object.keys(errs)[0]);
  };

  const submitWith = async (mode: "hold" | "print" | "transfer") => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!phone.trim()) errs.phone = "Mobile number is required";
    else if (!PHONE_PATTERN.test(phone.trim())) errs.phone = "Enter a valid 10-digit mobile number";
    if (emergencyContact.trim() && !PHONE_PATTERN.test(emergencyContact.trim())) errs.emergencyContact = "Enter a valid 10-digit mobile number";
    setFieldErrors(errs);
    if (Object.keys(errs).length) { showFieldErrors(errs); return; }
    if (mode === "transfer" && !mandatoryDone) {
      const missing = readiness.filter((r) => !r.ok);
      setActionNotice({
        tone: "warning", kind: "missing",
        title: `${missing.length} required ${missing.length === 1 ? "field is" : "fields are"} still empty`,
        detail: "Fill in the fields listed below before transferring to Triage & Vitals.",
      });
      jumpTo(missing[0].target);
      return;
    }

    setActionNotice(null);
    setSubmitting(true);
    try {
      const finalDob = approxAge ? estimateDobFromAgeValue(parseFloat(approxAge), ageUnit.toLowerCase() as AgeUnit) : null;
      const [city, state] = cityState.split(",").map((s) => s.trim());
      const payload = {
        name, titlePrefix, registrationFor: relationship, relationship: relationship !== "Self" ? relationship : null,
        gender, dob: finalDob, dobApprox: true,
        maritalStatus, phone,
        emergencyContact, emergencyContactName,
        address, state: state || null, city: city || null,
      };

      let pid = editingId;
      let pLabel = "";
      let pCode = "";
      if (pid) {
        const res = await api.patch<{ patient: { id: string; patientCode: string; name: string } }>(`/api/facility/patients/${pid}`, payload);
        pLabel = `${res.patient.name} (${res.patient.patientCode})`;
        pCode = res.patient.patientCode;
      } else {
        const res = await api.post<{ patient: { id: string; patientCode: string; name: string } }>("/api/facility/patients", payload);
        pid = res.patient.id;
        // If a later step fails, a retry must update this patient rather than create a duplicate.
        setEditingId(res.patient.id); setEditingCode(res.patient.patientCode);
        pLabel = `${res.patient.name} (${res.patient.patientCode})`;
        pCode = res.patient.patientCode;
      }

      const visitRes = await api.post<{ visit: { id: string; visitCode: string } }>("/api/facility/visits", {
        patientId: pid, doctorId: doctorId || null, status: mode === "hold" ? "waiting" : "registered",
      });

      let paymentRecorded: { amount: string; mode: string } | null = null;
      if (amount && paymentMode) {
        await api.post("/api/facility/payments", {
          visitId: visitRes.visit.id, amount, mode: paymentMode, status: "Paid",
          amountReceived: amount,
        });
        paymentRecorded = { amount, mode: paymentMode };
      }

      const hasIntakeData = chiefComplaintIds.length > 0 || !!narrative.trim() || !!onsetTimeline
        || allergies.length > 0 || medications.length > 0 || !!mobility;
      if (hasIntakeData) {
        await api.post(`/api/facility/visits/${visitRes.visit.id}/intake`, {
          chiefComplaintIds, narrative, onsetTimeline, allergies, medications, mobility,
        });
      }

      const printProblem = mode === "print"
        ? await printWristband({ patientLabel: pLabel, patientCode: pCode, visitCode: visitRes.visit.visitCode })
        : null;

      if (mode === "transfer") {
        // Registration and the next stage (vitals, screening, doctor review…)
        // are frequently handled by different staff at different times, not
        // one continuous sitting — so hand control back to the patient list
        // rather than forcing whoever's at the desk into the Vitals page.
        setFlash({ tone: "success", title: `${pLabel} registered`, detail: "Ready for Triage & Vitals — they now appear in the patient list below." });
        router.push("/facility/patients");
        return;
      }

      setResult({
        patientLabel: pLabel,
        patientCode: pCode,
        visitId: visitRes.visit.id,
        visitCode: visitRes.visit.visitCode,
        doctorName: doctors.find((d) => d.id === doctorId)?.name,
        paymentRecorded,
      });
      setPrintNotice(printProblem);
    } catch (e: any) {
      setActionNotice({
        tone: "error", title: "Registration wasn't completed",
        detail: `${e.message || "Network error"}. Everything you entered is still here — check it and try again.`,
        retry: () => submitWith(mode), retryLabel: "Try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Junior-doctor edit path — updates the existing patient/visit in place
  // (no new Visit, unlike submitWith) and returns to the Clinical Record.
  // This is a plain data save, independent of and never gating the visit's
  // own stage-completion ("Proceed to Mizaj Morphometry" on the record page
  // is still the only thing that advances the visit itself).
  const saveAndReturn = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!phone.trim()) errs.phone = "Mobile number is required";
    else if (!PHONE_PATTERN.test(phone.trim())) errs.phone = "Enter a valid 10-digit mobile number";
    if (emergencyContact.trim() && !PHONE_PATTERN.test(emergencyContact.trim())) errs.emergencyContact = "Enter a valid 10-digit mobile number";
    setFieldErrors(errs);
    if (Object.keys(errs).length) { showFieldErrors(errs); return; }
    if (!editingId || !resolvedVisitId) return;

    setActionNotice(null);
    setSubmitting(true);
    try {
      const finalDob = approxAge ? estimateDobFromAgeValue(parseFloat(approxAge), ageUnit.toLowerCase() as AgeUnit) : null;
      const [city, state] = cityState.split(",").map((s) => s.trim());
      await api.patch(`/api/facility/patients/${editingId}`, {
        name, titlePrefix, registrationFor: relationship, relationship: relationship !== "Self" ? relationship : null,
        gender, dob: finalDob, dobApprox: true,
        maritalStatus, phone,
        emergencyContact, emergencyContactName,
        address, state: state || null, city: city || null,
      });

      await api.patch(`/api/facility/visits/${resolvedVisitId}`, { doctorId: doctorId || null });

      const hasIntakeData = chiefComplaintIds.length > 0 || !!narrative.trim() || !!onsetTimeline
        || allergies.length > 0 || medications.length > 0 || !!mobility;
      if (hasIntakeData) {
        await api.post(`/api/facility/visits/${resolvedVisitId}/intake`, {
          chiefComplaintIds, narrative, onsetTimeline, allergies, medications, mobility,
        });
      }

      if (amount && paymentMode) {
        await api.post("/api/facility/payments", {
          visitId: resolvedVisitId, amount, mode: paymentMode, status: "Paid", amountReceived: amount,
        });
      }

      savedSnapshotRef.current = buildRegistrationSnapshot({
        titlePrefix, name, relationship, gender, approxAge, ageUnit, maritalStatus, phone,
        emergencyContact, emergencyContactName, address, cityState, doctorId,
        chiefComplaintIds, narrative, onsetTimeline, allergies, medications, mobility, amount, paymentMode,
      });
      setFlash({ tone: "success", title: "Registration updated", detail: `Changes to ${name.trim()}'s registration were saved.` });
      router.push(`/facility/patients/${editingId}/record`);
    } catch (e: any) {
      setActionNotice({
        tone: "error", title: "Your changes weren't saved",
        detail: `${e.message || "Network error"}. Everything you entered is still here — try saving again.`,
        retry: () => saveAndReturn(), retryLabel: "Save again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingVisit) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="w-full">
      <button onClick={() => guardedNavigate(goToPatients)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">
            {directEntry ? "Review & Edit Registration" : "Register Patient"}
          </h1>
          {isDirty && (
            <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] font-semibold uppercase tracking-wide">
              Unsaved Changes
            </Badge>
          )}
        </div>
        {editingId && directEntry && (
          <button
            onClick={() => guardedNavigate(() => router.push(`/facility/patients/${editingId}/record`))}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            View Full Clinical Record <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <PatientStageTracker
        steps={PATIENT_JOURNEY_STEPS.map((s) => (s.key === "registration" && isDirty ? { ...s, variant: "warning" as const, variantLabel: "Unsaved Changes" } : s))}
        activeKey="registration"
        completedKeys={[]}
        onNavigate={(href) => guardedNavigate(() => router.push(href))}
      />

      {loadNotice && (
        <InlineNotice
          {...loadNotice}
          className="mb-4"
          action={loadNotice.retry && (
            <Button size="sm" variant="outline" onClick={loadNotice.retry}>
              <RotateCw className="h-3.5 w-3.5" /> {loadNotice.retryLabel ?? "Try again"}
            </Button>
          )}
        />
      )}

      <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        {result ? (
          <div className="text-center space-y-4 py-6">
            <PartyPopper className="h-10 w-10 text-primary mx-auto" />
            <div>
              <h3 className="font-serif text-lg font-semibold">Patient Registered Successfully</h3>
              <p className="text-sm text-muted-foreground mt-1">{result.patientLabel}</p>
            </div>
            <Card className="p-4 gap-1 border-border/50 bg-card/60 text-left text-sm max-w-sm mx-auto">
              <p><span className="text-muted-foreground">Visit ID:</span> {result.visitCode}</p>
              {result.doctorName && <p><span className="text-muted-foreground">Doctor:</span> {result.doctorName}</p>}
              {result.paymentRecorded ? (
                <p><span className="text-muted-foreground">Payment:</span> ₹{result.paymentRecorded.amount} ({result.paymentRecorded.mode})</p>
              ) : (
                <p className="text-muted-foreground italic">No payment recorded yet.</p>
              )}
            </Card>
            {printNotice && (
              <InlineNotice
                {...printNotice}
                className="max-w-xl mx-auto text-left"
                action={
                  <Button size="sm" variant="outline" onClick={async () => {
                    setPrintNotice(await printWristband({ patientLabel: result.patientLabel, patientCode: result.patientCode, visitCode: result.visitCode }));
                  }}>
                    <QrCode className="h-3.5 w-3.5" /> Print again
                  </Button>
                }
              />
            )}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button variant="outline" onClick={resetAll}>Register Another Patient</Button>
              <Button variant="outline" onClick={goToPatients}>View Patient</Button>
              <Button onClick={() => router.push(`/facility/visits/${result.visitId}/vitals`)}>
                Continue to Assessment
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identify — not applicable once reopened directly for a known visit/patient */}
            {!directEntry && (
            <section className="space-y-3 pb-6 border-b border-border/40">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Find Existing Patient</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <FloatingField
                  id="searchName" label="Patient Name" value={searchName}
                  onChange={(e) => { setSearchName(e.target.value); if (searchNotice?.empty) setSearchNotice(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                  error={!!searchNotice?.empty}
                />
                <div>
                  <FloatingField
                    id="searchMobile" label="Mobile number" value={searchMobile}
                    onChange={(e) => {
                      setSearchMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                      clearFieldError("searchMobile");
                      if (searchNotice?.empty) setSearchNotice(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                    error={!!fieldErrors.searchMobile || !!searchNotice?.empty}
                    type="tel" inputMode="numeric" maxLength={10}
                  />
                  <FieldError message={fieldErrors.searchMobile} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-end">
                <Button onClick={runSearch} disabled={searching} variant="secondary">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                </Button>
                {/* One Add New Patient button; it's highlighted when the search found nobody. */}
                <Button
                  onClick={openNewPatient}
                  className={cn(candidates?.length === 0 && !formOpen && "ring-2 ring-primary/40 ring-offset-2 ring-offset-card animate-pulse [animation-iteration-count:2]")}
                >
                  <UserPlus className="h-4 w-4" /> Add New Patient
                </Button>
              </div>

              {searchNotice && (
                <InlineNotice
                  {...searchNotice}
                  onDismiss={() => setSearchNotice(null)}
                  action={searchNotice.retry && (
                    <Button size="sm" variant="outline" onClick={searchNotice.retry}>
                      <RotateCw className="h-3.5 w-3.5" /> {searchNotice.retryLabel ?? "Try again"}
                    </Button>
                  )}
                />
              )}

              {candidates !== null && (
                <div>
                  {candidates.length === 0 ? (
                    <InlineNotice
                      tone="info"
                      title="No existing patient matches this search"
                      detail="Check the spelling or the number. If this is their first visit here, use Add New Patient above — what you searched for is carried into the form."
                    />
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {candidates.map((c) => (
                        <Card
                          key={c.id}
                          className={cn(
                            "p-4 gap-3 border-border/50 bg-card/60 flex flex-col cursor-pointer transition-colors hover:border-primary/40",
                            editingId === c.id && "border-primary/50 ring-1 ring-primary/30"
                          )}
                          onClick={() => selectCandidate(c)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-semibold text-white shrink-0", avatarGradient(c.avatarColor))}>
                              {initials(c.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              {c.patientCode && (
                                <Badge className="mt-0.5 bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-sm">
                                  {c.patientCode}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {c.gender || "—"} · {formatAge(c.dob)} · {c.phone || "—"}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                            <History className="h-3 w-3 shrink-0" />
                            {c.lastVisitAt ? `Last visit: ${daysAgo(c.lastVisitAt)}` : "No prior visit here"}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-auto">
                            {typeof c.matchScore === "number" ? (
                              <Badge variant="outline" className="text-sm shrink-0">Match {c.matchScore}%</Badge>
                            ) : <span />}
                            <Button size="sm" variant={editingId === c.id ? "default" : "outline"} onClick={(e) => { e.stopPropagation(); selectCandidate(c); }}>
                              {editingId === c.id ? "Selected" : "Select"}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
            )}

            {formOpen && (
              <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground leading-tight">Primary Patient Identification</h2>
                    </div>
                  </div>
                  {editingId ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono flex items-center gap-1">
                        <IdCard className="h-3 w-3" /> {editingCode}
                      </Badge>
                      {!directEntry && (
                        <Badge variant="outline" className="text-sm flex items-center gap-1">
                          <History className="h-3 w-3" /> {lastVisitAt ? `Last visit: ${daysAgo(lastVisitAt)}` : "No prior visit here"}
                        </Badge>
                      )}
                      {!directEntry && (
                        <button onClick={clearForm} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <X className="h-3 w-3" /> Change patient
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={clearForm} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </div>

                <div className="grid lg:grid-cols-10 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <FloatingField
                          id="name"
                          label="Patient Name"
                          autoComplete="off"
                          value={name}
                          onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                          error={!!fieldErrors.name}
                          required
                        />
                        <FieldError message={fieldErrors.name} />
                      </div>

                      {meta.relationship && (
                        <FloatingCombobox
                          id="relationship"
                          label="Relationship to Patient"
                          value={relationship}
                          onValueChange={setRelationship}
                          options={meta.relationship.options}
                          placeholder="Search relationship…"
                        />
                      )}

                      {meta.gender && (
                        <FloatingSelect id="gender" label="Gender" value={gender} onValueChange={setGender} placeholder="Select" required>
                          {meta.gender.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </FloatingSelect>
                      )}
                      {meta.marital_status && (
                        <FloatingSelect id="maritalStatus" label="Marital Status" value={maritalStatus} onValueChange={setMaritalStatus} placeholder="Select">
                          {meta.marital_status.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </FloatingSelect>
                      )}
                      <FloatingSplitField
                        label="Age"
                        inputId="approxAge"
                        type="number"
                        step="any"
                        min="0"
                        value={approxAge}
                        onChange={(e) => setApproxAge(e.target.value)}
                        selectPosition="right"
                        selectWidthClassName="w-28"
                        selectValue={ageUnit}
                        onSelectChange={setAgeUnit}
                        selectOptions={["Years", "Months", "Days"]}
                        required
                      />

                      <div>
                        <FloatingField
                          id="phone" label="Mobile number" value={phone}
                          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); clearFieldError("phone"); }}
                          error={!!fieldErrors.phone}
                          type="tel" inputMode="numeric" maxLength={10}
                          required
                        />
                        <FieldError message={fieldErrors.phone} />
                      </div>
                      <div className="lg:col-span-2">
                        <FloatingField id="address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} required />
                      </div>
                    </div>

                    <section className="space-y-3 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                          <Contact className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-foreground leading-tight">Emergency Contact &amp; Next of Kin</h2>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FloatingField id="emergencyContactName" label="Name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
                        <div>
                          <FloatingField
                            id="emergencyContact" label="Mobile number" value={emergencyContact}
                            onChange={(e) => { setEmergencyContact(e.target.value.replace(/\D/g, "").slice(0, 10)); clearFieldError("emergencyContact"); }}
                            error={!!fieldErrors.emergencyContact}
                            type="tel" inputMode="numeric" maxLength={10}
                          />
                          <FieldError message={fieldErrors.emergencyContact} />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <QrCode className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-foreground leading-tight">Billing, Payer Authorization &amp; Attending Hekim</h2>
                        </div>
                      </div>
                      <FloatingSelect id="doctorId" label="Preferred Doctor (optional)" value={doctorId} onValueChange={setDoctorId} placeholder="Any available doctor">
                        {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.designation ? ` — ${d.designation}` : ""}</SelectItem>)}
                      </FloatingSelect>
                    </section>

                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payment (optional)</h2>
                      {existingPayment && (
                        <p className="text-sm text-muted-foreground">Already collected: ₹{existingPayment.amount} ({existingPayment.mode}). Fields below add another payment, if needed.</p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FloatingField id="amount" type="number" label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        {meta.payment_mode && (
                          <FloatingSelect id="paymentMode" label="Payment Mode" value={paymentMode} onValueChange={setPaymentMode} placeholder="Select">
                            {meta.payment_mode.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </FloatingSelect>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="lg:col-span-3">
                    <section className="space-y-4 lg:sticky lg:top-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                          <BriefcaseMedical className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-foreground leading-tight">Chief Complaint</h2>
                        </div>
                      </div>

                      <div id="reg-complaints" className="scroll-mt-24">
                        <FloatingMultiSelect
                          id="complaintSearch"
                          label="Fast Symptom Selector"
                          required
                          selected={chiefComplaintIds.flatMap((cid) => complaintOptions.filter((o) => o.id === cid))}
                          onRemove={toggleComplaint}
                          query={complaintSearch}
                          onQueryChange={setComplaintSearch}
                          results={complaintSearchResults}
                          onPick={toggleComplaint}
                        />
                      </div>

                      <FloatingTextarea
                        id="narrative"
                        label="Patient Stated Narrative"
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        rows={3}
                      />

                      <div id="reg-onset" className="scroll-mt-24">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Symptom Onset Timeline <span className="text-destructive">*</span></p>
                        <div className="grid grid-cols-3 gap-2">
                          {ONSET_OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => setOnsetTimeline(onsetTimeline === o.value ? "" : o.value)}
                              className={cn(
                                "rounded-lg border px-1.5 py-2 text-sm leading-tight text-center transition-colors",
                                onsetTimeline === o.value
                                  ? "bg-amber-400/15 border-amber-400/50 text-amber-600 dark:text-amber-400 font-medium"
                                  : "border-border/60 text-muted-foreground hover:border-border"
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
                        <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                          <TriangleAlert className="h-3.5 w-3.5" /> Critical Allergies / Red Flags
                        </p>
                        {allergies.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {allergies.map((a, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 px-3 py-1 text-sm">
                                {a}
                                <button type="button" onClick={() => removeAllergy(i)} className="hover:text-destructive/70">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <input
                            value={allergyInput}
                            onChange={(e) => setAllergyInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergy(); } }}
                            placeholder="Type an allergy…"
                            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
                          />
                          {allergyInput.trim() && allergySearchResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/50 bg-card shadow-lg max-h-40 overflow-y-auto divide-y divide-border/40">
                              {allergySearchResults.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => addAllergy(a.label)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5"
                                >
                                  <TriangleAlert className="h-3 w-3 text-destructive shrink-0" /> {a.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => addAllergy()} className="w-full">
                          <Plus className="h-3 w-3" /> Add as Custom Allergy
                        </Button>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Active Routine Medications / Herbs</p>
                        {medications.length > 0 && (
                          <div className="space-y-1.5 mb-2">
                            {medications.map((m, i) => (
                              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-sm">
                                {m.kind === "supplement" ? <Leaf className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Pill className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <span className="flex-1">{m.label}</span>
                                <button type="button" onClick={() => removeMedication(i)} className="text-muted-foreground hover:text-destructive">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => { setMedicationKind("supplement"); setMedicationInput(""); }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
                              medicationKind === "supplement" ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-600 dark:text-emerald-400" : "border-border/60 text-muted-foreground"
                            )}
                          >
                            <Leaf className="h-3 w-3" /> Supplement / Herb
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMedicationKind("medication"); setMedicationInput(""); }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
                              medicationKind === "medication" ? "bg-primary/15 border-primary/40 text-primary" : "border-border/60 text-muted-foreground"
                            )}
                          >
                            <Pill className="h-3 w-3" /> Medication
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            value={medicationInput}
                            onChange={(e) => setMedicationInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMedication(); } }}
                            placeholder={medicationKind === "supplement" ? "Type a supplement or herb…" : "Type a medication…"}
                            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          {medicationInput.trim() && medicationSearchResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/50 bg-card shadow-lg max-h-40 overflow-y-auto divide-y divide-border/40">
                              {medicationSearchResults.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => addMedication(o.label)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5"
                                >
                                  {medicationKind === "supplement" ? <Leaf className="h-3 w-3 text-emerald-500 shrink-0" /> : <Pill className="h-3 w-3 text-muted-foreground shrink-0" />} {o.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => addMedication()} className="w-full mt-2">
                          <Plus className="h-3 w-3" /> Add as Custom {medicationKind === "supplement" ? "Supplement/Herb" : "Medication"}
                        </Button>
                      </div>

                      <div id="reg-mobility" className="scroll-mt-24">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Mobility / Special Accompaniment <span className="text-destructive">*</span></p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setMobility(mobility === "independent" ? "" : "independent")}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs leading-tight text-center transition-colors",
                              mobility === "independent"
                                ? "bg-emerald-400/15 border-emerald-400/50 text-emerald-600 dark:text-emerald-400 font-medium"
                                : "border-border/60 text-muted-foreground hover:border-border"
                            )}
                          >
                            <PersonStanding className="h-4 w-4" /> Walking Independently
                          </button>
                          <button
                            type="button"
                            onClick={() => setMobility(mobility === "wheelchair" ? "" : "wheelchair")}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs leading-tight text-center transition-colors",
                              mobility === "wheelchair"
                                ? "bg-amber-400/15 border-amber-400/50 text-amber-600 dark:text-amber-400 font-medium"
                                : "border-border/60 text-muted-foreground hover:border-border"
                            )}
                          >
                            <Accessibility className="h-4 w-4" /> Wheelchair Request
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Next Step</p>
                          <p className="text-sm font-medium">Vitals &amp; Pulse Triage Booth</p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="-mx-6 sm:-mx-8 -mb-6 sm:-mb-8 mt-2 px-6 sm:px-8 py-4 border-t border-border/50 bg-muted/20 rounded-b-2xl flex flex-wrap items-center justify-end gap-3">
                  {footerNotice && (
                    <InlineNotice
                      {...footerNotice}
                      className="w-full"
                      onDismiss={() => setActionNotice(null)}
                      action={footerNotice.retry && (
                        <Button size="sm" variant="outline" onClick={footerNotice.retry}>
                          <RotateCw className="h-3.5 w-3.5" /> {footerNotice.retryLabel ?? "Try again"}
                        </Button>
                      )}
                    />
                  )}
                  {!visitEditMode && <ReadinessStrip items={readiness} />}
                  {visitEditMode ? (
                    <>
                      {isDirty && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mr-auto">
                          <TriangleAlert className="h-3.5 w-3.5" /> Unsaved changes — save before leaving this page
                        </p>
                      )}
                      <Button
                        size="lg"
                        onClick={saveAndReturn}
                        disabled={submitting}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save &amp; Return to Clinical Record <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap mr-auto">
                        <Button type="button" variant="outline" onClick={() => submitWith("hold")} disabled={submitting}>
                          <Bookmark className="h-4 w-4" /> Hold in Waiting Queue
                        </Button>
                        <Button type="button" variant="outline" onClick={() => submitWith("print")} disabled={submitting}>
                          <QrCode className="h-4 w-4" /> Print Barcode &amp; Wristband
                        </Button>
                      </div>
                      <Button
                        size="lg"
                        onClick={() => submitWith("transfer")}
                        disabled={submitting}
                        aria-disabled={!mandatoryDone}
                        className={cn("bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50", !mandatoryDone && "opacity-60")}
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Confirm &amp; Transfer to Triage &amp; Vitals Station <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </Card>

      <Dialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You&apos;ve made changes to this patient&apos;s registration that haven&apos;t been saved yet. What would you like to do?
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setUnsavedDialogOpen(false)}>Keep Editing</Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => {
                setUnsavedDialogOpen(false);
                const nav = pendingNavRef.current;
                pendingNavRef.current = null;
                nav?.();
              }}
            >
              Discard &amp; Leave
            </Button>
            <Button
              onClick={async () => {
                setUnsavedDialogOpen(false);
                pendingNavRef.current = null;
                await saveAndReturn();
              }}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save &amp; Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Live handover checklist above the transfer button: how many required fields
 * are done and, by name, which are still missing — each one jumps to its field.
 */
function ReadinessStrip({ items }: { items: { label: string; ok: boolean; target: string }[] }) {
  const done = items.filter((i) => i.ok).length;
  const missing = items.filter((i) => !i.ok);
  const pct = Math.round((done / items.length) * 100);

  if (!missing.length) {
    return (
      <div role="status" className="w-full flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm">
        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-400">All {items.length} required fields are complete</span>
        <span className="text-muted-foreground">— ready to transfer to Triage &amp; Vitals.</span>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold">
          {done} of {items.length} required fields complete
        </p>
        <div className="h-1.5 flex-1 min-w-24 max-w-56 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground basis-full sm:basis-auto sm:ml-auto">
          Hold and Print need only the name and mobile number.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm text-muted-foreground mr-1">Still needed to transfer:</span>
        {missing.map((m) => (
          <button
            key={m.target}
            type="button"
            onClick={() => jumpTo(m.target)}
            className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/5 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            {m.label} <ChevronRight className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
