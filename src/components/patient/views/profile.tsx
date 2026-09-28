"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import {
  User, MapPin, Phone, Heart, Activity, AlertTriangle, Pill, Stethoscope,
  Save, Loader2, CheckCircle2, ClipboardList, Droplet, Ruler, Weight, Briefcase,
} from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Male", "Female", "Other"];
const MIZAJ_OPTIONS = ["Damwi", "Safrawi", "Balghami", "Saudawi", "Balanced", "Unknown"];

export function ProfileView() {
  const patient = useAppStore((s) => s.patient);
  const setPatient = useAppStore((s) => s.setPatient);
  const [form, setForm] = useState<any>(patient || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (patient) setForm(patient); }, [patient]);

  if (!patient) return null;

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put<{ user: any }>("/api/patient/me", form);
      setPatient(r.user);
      toast.success("Medical profile saved");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const sections = [
    { id: "basic", title: "Basic Information", icon: User, desc: "Identity & demographics" },
    { id: "contact", title: "Address & Emergency", icon: MapPin, desc: "Where you live & who to call" },
    { id: "family", title: "Family Medical History", icon: Heart, desc: "Hereditary conditions in your family" },
    { id: "personal", title: "Personal Medical History", icon: Activity, desc: "Your past & present conditions" },
    { id: "allergies", title: "Allergies & Medications", icon: AlertTriangle, desc: "Critical for safe prescribing" },
    { id: "lifestyle", title: "Lifestyle & Surgery", icon: Stethoscope, desc: "Habits & surgical history" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">Medical Profile</h2>
          <p className="text-sm text-muted-foreground">Complete information for your Hakim & any emergency officer.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Profile"}
        </Button>
      </div>

      {/* Emergency banner */}
      <Card className="p-4 border-accent/30 bg-accent/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent">This profile is shared with your consulting Hakim</p>
            <p className="text-xs text-muted-foreground mt-0.5">A complete profile enables safer prescriptions and faster emergency care. Fill every section.</p>
          </div>
        </div>
      </Card>

      {/* Basic Information */}
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div>
          <div>
            <h3 className="font-serif text-base font-semibold">Basic Information</h3>
            <p className="text-xs text-muted-foreground">Identity & demographics</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} className="bg-background/60" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} className="bg-background/60" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email || ""} disabled className="bg-background/40 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} className="bg-background/60" />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={form.gender || ""} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger className="bg-background/60"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Blood Group</Label>
            <Select value={form.bloodGroup || ""} onValueChange={(v) => set("bloodGroup", v)}>
              <SelectTrigger className="bg-background/60"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label><Ruler className="inline h-3.5 w-3.5 mr-1" />Height</Label>
            <Input value={form.height || ""} onChange={(e) => set("height", e.target.value)} placeholder="178 cm" className="bg-background/60" />
          </div>
          <div className="space-y-1.5">
            <Label><Weight className="inline h-3.5 w-3.5 mr-1" />Weight</Label>
            <Input value={form.weight || ""} onChange={(e) => set("weight", e.target.value)} placeholder="82 kg" className="bg-background/60" />
          </div>
          <div className="space-y-1.5">
            <Label><Briefcase className="inline h-3.5 w-3.5 mr-1" />Occupation</Label>
            <Input value={form.occupation || ""} onChange={(e) => set("occupation", e.target.value)} placeholder="Software Engineer" className="bg-background/60" />
          </div>
          <div className="space-y-1.5">
            <Label>Mizaj (Temperament)</Label>
            <Select value={form.mizaj || ""} onValueChange={(v) => set("mizaj", v)}>
              <SelectTrigger className="bg-background/60"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{MIZAJ_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Address & Emergency */}
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center"><MapPin className="h-4 w-4 text-accent" /></div>
          <div>
            <h3 className="font-serif text-base font-semibold">Address & Emergency Contact</h3>
            <p className="text-xs text-muted-foreground">Where to reach you & who to call</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Home Address</Label>
            <Textarea value={form.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="House, street, city, state, pincode" className="bg-background/60 min-h-[60px]" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label><Phone className="inline h-3.5 w-3.5 mr-1" />Emergency Contact</Label>
            <Input value={form.emergencyContact || ""} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="+91 98765 43210 (Spouse)" className="bg-background/60" />
          </div>
        </div>
      </Card>

      {/* Family History */}
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-rose-500/15 flex items-center justify-center"><Heart className="h-4 w-4 text-rose-400" /></div>
          <div>
            <h3 className="font-serif text-base font-semibold">Family Medical History</h3>
            <p className="text-xs text-muted-foreground">Hereditary conditions across generations</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Conditions in your family (parents, siblings, grandparents)</Label>
          <Textarea value={form.familyHistory || ""} onChange={(e) => set("familyHistory", e.target.value)} placeholder="e.g. Father: Type 2 Diabetes; Mother: Hypertension; Paternal grandfather: Cardiac disease" className="bg-background/60 min-h-[90px]" />
        </div>
      </Card>

      {/* Personal Medical History */}
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center"><Activity className="h-4 w-4 text-primary" /></div>
          <div>
            <h3 className="font-serif text-base font-semibold">Personal Medical History</h3>
            <p className="text-xs text-muted-foreground">Your past & present conditions</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Medical History (past illnesses, hospitalisations)</Label>
            <Textarea value={form.medicalHistory || ""} onChange={(e) => set("medicalHistory", e.target.value)} placeholder="e.g. Chronic lower back pain since 2021. Occasional migraines." className="bg-background/60 min-h-[70px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Chronic / Long-standing Conditions</Label>
            <Textarea value={form.chronicConditions || ""} onChange={(e) => set("chronicConditions", e.target.value)} placeholder="e.g. Chronic back pain, Pre-diabetes, Hypertension" className="bg-background/60 min-h-[60px]" />
          </div>
        </div>
      </Card>

      {/* Allergies & Medications */}
      <Card className="p-5 border-accent/30 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-accent" /></div>
          <div>
            <h3 className="font-serif text-base font-semibold">Allergies & Current Medications</h3>
            <p className="text-xs text-muted-foreground">Critical for safe prescribing</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Known Allergies</Label>
            <Textarea value={form.allergies || ""} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. Penicillin, Pollen, Dust" className="bg-background/60 min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label><Pill className="inline h-3.5 w-3.5 mr-1" />Current Medications</Label>
            <Textarea value={form.currentMedications || ""} onChange={(e) => set("currentMedications", e.target.value)} placeholder="e.g. Majoon Suranjan 5g BD, Metformin 500mg OD" className="bg-background/60 min-h-[80px]" />
          </div>
        </div>
      </Card>

      {/* Lifestyle & Surgery */}
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-lg bg-violet-500/15 flex items-center justify-center"><Stethoscope className="h-4 w-4 text-violet-300" /></div>
          <div>
            <h3 className="font-serif text-base font-semibold">Lifestyle & Surgical History</h3>
            <p className="text-xs text-muted-foreground">Habits and past procedures</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Lifestyle (diet, sleep, exercise, habits)</Label>
            <Textarea value={form.lifestyle || ""} onChange={(e) => set("lifestyle", e.target.value)} placeholder="e.g. Sedentary, irregular meals, disturbed sleep, occasional smoker" className="bg-background/60 min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Surgical History</Label>
            <Textarea value={form.surgicalHistory || ""} onChange={(e) => set("surgicalHistory", e.target.value)} placeholder="e.g. Appendectomy (2015)" className="bg-background/60 min-h-[80px]" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Complete Profile"}
        </Button>
      </div>
    </div>
  );
}
