"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge, ageFromDob, daysAgo, estimateDobFromAgeValue, type AgeUnit } from "@/lib/age";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect, FloatingSplitField, FieldError } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";
import {
  Search, Loader2, UserPlus, Stethoscope, PartyPopper, ChevronLeft, X, History, IdCard,
} from "lucide-react";

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

interface Result {
  patientLabel: string;
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

export function PatientRegistrationWizard() {
  const router = useRouter();
  const goToPatients = () => router.push("/facility/patients");

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

  // Doctor
  const [doctorId, setDoctorId] = useState("");

  // Payment (optional)
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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
  }, []);

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
  };

  const resetAll = () => {
    setSearchMobile(""); setSearchName(""); setCandidates(null);
    clearForm();
    setDoctorId("");
    setAmount(""); setPaymentMode("");
    setResult(null);
  };

  const runSearch = async () => {
    if (!searchMobile && !searchName) {
      toast.error("Enter a mobile number or name to search");
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchMobile) params.set("mobile", searchMobile);
      if (searchName) params.set("name", searchName);
      const res = await api.get<{ candidates: Candidate[] }>(`/api/facility/patients/search?${params.toString()}`);
      setCandidates(res.candidates || []);
    } catch (e: any) {
      toast.error(e.message || "Search failed");
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

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!phone.trim()) errs.phone = "Mobile number is required";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

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
      if (pid) {
        const res = await api.patch<{ patient: { id: string; patientCode: string; name: string } }>(`/api/facility/patients/${pid}`, payload);
        pLabel = `${res.patient.name} (${res.patient.patientCode})`;
      } else {
        const res = await api.post<{ patient: { id: string; patientCode: string; name: string } }>("/api/facility/patients", payload);
        pid = res.patient.id;
        pLabel = `${res.patient.name} (${res.patient.patientCode})`;
      }

      const visitRes = await api.post<{ visit: { id: string; visitCode: string } }>("/api/facility/visits", {
        patientId: pid, doctorId: doctorId || null,
      });

      let paymentRecorded: { amount: string; mode: string } | null = null;
      if (amount && paymentMode) {
        await api.post("/api/facility/payments", {
          visitId: visitRes.visit.id, amount, mode: paymentMode, status: "Paid",
          amountReceived: amount,
        });
        paymentRecorded = { amount, mode: paymentMode };
      }

      setResult({
        patientLabel: pLabel,
        visitId: visitRes.visit.id,
        visitCode: visitRes.visit.visitCode,
        doctorName: doctors.find((d) => d.id === doctorId)?.name,
        paymentRecorded,
      });
    } catch (e: any) {
      toast.error(e.message || "Could not complete registration");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <button onClick={goToPatients} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="mb-4">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">Register Patient</h1>
      </div>

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
            {/* Identify */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Find Existing Patient</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <FloatingField id="searchMobile" label="Mobile number" value={searchMobile} onChange={(e) => setSearchMobile(e.target.value)} />
                <FloatingField id="searchName" label="Name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={runSearch} disabled={searching} variant="outline">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                </Button>
                <Button onClick={openNewPatient} variant="outline">
                  <UserPlus className="h-4 w-4" /> Add New Patient
                </Button>
              </div>

              {candidates !== null && (
                <div>
                  {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No existing patients matched. Click "Add New Patient" to register one.</p>
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
                                <Badge className="mt-0.5 bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[10px]">
                                  {c.patientCode}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.gender || "—"} · {formatAge(c.dob)} · {c.phone || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <History className="h-3 w-3 shrink-0" />
                            {c.lastVisitAt ? `Last visit: ${daysAgo(c.lastVisitAt)}` : "No prior visit here"}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-auto">
                            {typeof c.matchScore === "number" ? (
                              <Badge variant="outline" className="text-xs shrink-0">Match {c.matchScore}%</Badge>
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

            {formOpen && (
              <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient Details</h2>
                  {editingId ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono flex items-center gap-1">
                        <IdCard className="h-3 w-3" /> {editingCode}
                      </Badge>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <History className="h-3 w-3" /> {lastVisitAt ? `Last visit: ${daysAgo(lastVisitAt)}` : "No prior visit here"}
                      </Badge>
                      <button onClick={clearForm} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <X className="h-3 w-3" /> Change patient
                      </button>
                    </div>
                  ) : (
                    <button onClick={clearForm} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <FloatingSplitField
                      label="Patient Name"
                      inputId="name"
                      selectValue={titlePrefix}
                      onSelectChange={setTitlePrefix}
                      selectOptions={meta.patient_title?.options || []}
                      selectPlaceholder="Title"
                      autoComplete="off"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      error={!!fieldErrors.name}
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
                    <FloatingSelect id="gender" label="Gender" value={gender} onValueChange={setGender} placeholder="Select">
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
                  />

                  <div>
                    <FloatingField id="phone" label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} error={!!fieldErrors.phone} />
                    <FieldError message={fieldErrors.phone} />
                  </div>
                  <div className="lg:col-span-2">
                    <FloatingField id="address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  {meta.city && (
                    <FloatingCombobox
                      id="cityState"
                      label="City"
                      value={cityState}
                      onValueChange={setCityState}
                      options={meta.city.options}
                      placeholder="Search city…"
                    />
                  )}
                </div>

                <Card className="p-4 gap-2 border-border/50 bg-card/60">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency Contact</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FloatingField id="emergencyContactName" label="Name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
                    <FloatingField id="emergencyContact" label="Mobile number" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
                  </div>
                </Card>

                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor</h2>
                  <FloatingSelect id="doctorId" label="Preferred Doctor (optional)" value={doctorId} onValueChange={setDoctorId} placeholder="Any available doctor">
                    {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.designation ? ` — ${d.designation}` : ""}</SelectItem>)}
                  </FloatingSelect>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment (optional)</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FloatingField id="amount" type="number" label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    {meta.payment_mode && (
                      <FloatingSelect id="paymentMode" label="Payment Mode" value={paymentMode} onValueChange={setPaymentMode} placeholder="Select">
                        {meta.payment_mode.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </FloatingSelect>
                    )}
                  </div>
                </section>

                <div className="flex items-center justify-end pt-2">
                  <Button size="lg" onClick={submit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                    {editingId ? "Save & Register Visit" : "Register Patient"}
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
