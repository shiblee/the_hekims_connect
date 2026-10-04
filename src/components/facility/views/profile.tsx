"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import {
  Loader2, Save, LayoutGrid, MapPin, Gauge, Stethoscope, UserCog,
} from "lucide-react";
import { TeamView } from "./team";

const DAY_LABELS: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "location", label: "Location", icon: MapPin },
  { key: "capacity", label: "Capacity & Schedule", icon: Gauge },
  { key: "services", label: "Services", icon: Stethoscope },
];
const STAFF_SECTION = { key: "staff", label: "Staff", icon: UserCog };

interface OperatingHourRow {
  dayOfWeek: number;
  isOpen: boolean;
  openingTime: string | null;
  closingTime: string | null;
  openingTime2: string | null;
  closingTime2: string | null;
}

interface FacilityProfile {
  id: string; facilityName: string; facilityType: string | null; hfrNumber: string | null;
  establishmentDate: string | null; alternateContactNumber: string | null;
  addressLine1: string | null; addressLine2: string | null; locality: string | null;
  city: string | null; district: string | null; state: string | null; country: string | null;
  pincode: string | null;
  bedCapacity: number | null; dailyOpdCount: number | null; is24x7: boolean;
  emergencyServices: boolean; ambulanceAvailable: boolean;
  specializations: string | null; services: string | null;
  operatingHours: OperatingHourRow[];
}

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

interface HourRow { isOpen: boolean; open: string; close: string; open2: string; close2: string }

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toMonthInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 7);
}

function ToggleRow({ title, checked, onCheckedChange }: { title: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3.5">
      <p className="text-sm font-medium">{title}</p>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function ProfileView({ section }: { section: string }) {
  const router = useRouter();
  const setSection = (s: string) => router.push(`/facility/profile/${s}`);
  const [facility, setFacility] = useState<FacilityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<MetaSections>({});

  const load = () => {
    setLoading(true);
    api.get<{ facility: FacilityProfile }>("/api/facility/profile")
      .then((res) => setFacility(res.facility))
      .catch(() => toast.error("Could not load your profile"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<{ sections: MetaSections }>("/api/facility/metadata")
      .then((res) => setMeta(res.sections))
      .catch(() => {});
  }, []);

  // Overview
  const [facilityName, setFacilityName] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [hfrNumber, setHfrNumber] = useState("");
  const [establishmentDate, setEstablishmentDate] = useState("");
  const [alternateContactNumber, setAlternateContactNumber] = useState("");

  // Location
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [pincode, setPincode] = useState("");

  // Capacity & Schedule
  const [bedCapacity, setBedCapacity] = useState("");
  const [dailyOpdCount, setDailyOpdCount] = useState("");
  const [is24x7, setIs24x7] = useState(false);
  const [hours, setHours] = useState<Record<number, HourRow>>({});

  // Services
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [emergencyServices, setEmergencyServices] = useState(false);
  const [ambulanceAvailable, setAmbulanceAvailable] = useState(false);

  useEffect(() => {
    if (!facility) return;
    setFacilityName(facility.facilityName || "");
    setFacilityType(facility.facilityType || "");
    setHfrNumber(facility.hfrNumber || "");
    setEstablishmentDate(toMonthInput(facility.establishmentDate));
    setAlternateContactNumber(facility.alternateContactNumber || "");

    setAddressLine1(facility.addressLine1 || "");
    setAddressLine2(facility.addressLine2 || "");
    setLocality(facility.locality || "");
    setCity(facility.city || "");
    setDistrict(facility.district || "");
    setState(facility.state || "");
    setCountry(facility.country || "");
    setPincode(facility.pincode || "");

    setBedCapacity(facility.bedCapacity !== null ? String(facility.bedCapacity) : "");
    setDailyOpdCount(facility.dailyOpdCount !== null ? String(facility.dailyOpdCount) : "");
    setIs24x7(facility.is24x7);

    const h: Record<number, HourRow> = {};
    for (const d of DAY_ORDER) {
      const row = facility.operatingHours.find((o) => o.dayOfWeek === d);
      h[d] = {
        isOpen: row?.isOpen ?? false,
        open: row?.openingTime || "",
        close: row?.closingTime || "",
        open2: row?.openingTime2 || "",
        close2: row?.closingTime2 || "",
      };
    }
    setHours(h);

    setSpecializations(parseList(facility.specializations));
    setServices(parseList(facility.services));
    setEmergencyServices(facility.emergencyServices);
    setAmbulanceAvailable(facility.ambulanceAvailable);
  }, [facility]);

  const serviceGroups = useMemo(
    () => Object.entries(meta).filter(([key]) => key.startsWith("service_")),
    [meta]
  );
  const toggleInList = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await api.patch<{ facility: FacilityProfile }>("/api/facility/profile", payload);
      setFacility(res.facility);
      toast.success("Changes saved");
    } catch (err: any) {
      toast.error(err.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const SaveButton = ({ onClick }: { onClick: () => void }) => (
    <Button
      className="self-start h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
      disabled={saving}
      onClick={onClick}
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
    </Button>
  );

  if (loading || !facility) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold">Facility Profile</h2>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-4 h-fit">
          <Card className="p-2 border-border/50 bg-card/60">
            <div className="space-y-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                      section === s.key ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-2 border-border/50 bg-card/60">
            <button
              onClick={() => setSection(STAFF_SECTION.key)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                section === STAFF_SECTION.key ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
              )}
            >
              <STAFF_SECTION.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{STAFF_SECTION.label}</span>
            </button>
          </Card>
        </div>

        {section === "overview" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">Facility Identity</h2>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
                <FloatingField id="facilityName" label="Facility name" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} />
                {meta.facility_type ? (
                  <FloatingSelect id="facilityType" label="Facility type" value={facilityType} onValueChange={setFacilityType} placeholder="Select type">
                    {meta.facility_type.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                ) : (
                  <FloatingField id="facilityType" label="Facility type" value={facilityType} onChange={(e) => setFacilityType(e.target.value)} />
                )}
                <FloatingField id="hfrNumber" label="HFR number" value={hfrNumber} onChange={(e) => setHfrNumber(e.target.value.toUpperCase())} />
                <FloatingField id="establishmentDate" type="month" label="Establishment date" value={establishmentDate} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setEstablishmentDate(e.target.value)} />
                <FloatingField id="alternateContactNumber" label="Alternate contact number" value={alternateContactNumber} onChange={(e) => setAlternateContactNumber(e.target.value)} />
              </div>
            </div>

            <SaveButton onClick={() => save({ facilityName, facilityType, hfrNumber, establishmentDate, alternateContactNumber })} />
          </Card>
        )}

        {section === "location" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">Facility Address</h2>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
                <FloatingField id="addressLine1" label="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
                <FloatingField id="addressLine2" label="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
                <FloatingField id="locality" label="Locality" value={locality} onChange={(e) => setLocality(e.target.value)} />
                <FloatingField id="city" label="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <FloatingField id="district" label="District" value={district} onChange={(e) => setDistrict(e.target.value)} />
                <FloatingField id="state" label="State" value={state} onChange={(e) => setState(e.target.value)} />
                <FloatingField id="country" label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
                <FloatingField id="pincode" label="PIN code" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
            </div>
            <SaveButton onClick={() => save({ addressLine1, addressLine2, locality, city, district, state, country, pincode })} />
          </Card>
        )}

        {section === "capacity" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">Capacity</h2>
              <div className="grid sm:grid-cols-3 gap-x-4 gap-y-6">
                <FloatingField id="bedCapacity" type="number" label="Bed capacity" value={bedCapacity} onChange={(e) => setBedCapacity(e.target.value)} />
                <FloatingField id="dailyOpdCount" type="number" label="Average daily OPD" value={dailyOpdCount} onChange={(e) => setDailyOpdCount(e.target.value)} />
              </div>
            </div>

            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">Operating Hours</h2>
              <div className="space-y-4">
                <ToggleRow title="Open 24×7 (hides the weekly schedule below)" checked={is24x7} onCheckedChange={setIs24x7} />
                {!is24x7 && (
                  <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border/50 text-left text-muted-foreground">
                          <th rowSpan={2} className="py-2 font-medium align-bottom">Day</th>
                          <th rowSpan={2} className="py-2 font-medium align-bottom">Open</th>
                          <th colSpan={2} className="py-2 font-medium text-center">Shift 1</th>
                          <th colSpan={2} className="py-2 font-medium text-center">Shift 2 (optional)</th>
                        </tr>
                        <tr className="border-b border-border/50 text-left text-muted-foreground">
                          <th className="py-1.5 font-medium">Opening</th>
                          <th className="py-1.5 font-medium">Closing</th>
                          <th className="py-1.5 font-medium">Opening</th>
                          <th className="py-1.5 font-medium">Closing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DAY_ORDER.map((d) => {
                          const row = hours[d] || { isOpen: false, open: "", close: "", open2: "", close2: "" };
                          return (
                            <tr key={d} className="border-b border-border/30 last:border-0">
                              <td className="py-2 pr-2 whitespace-nowrap">{DAY_LABELS[d]}</td>
                              <td className="py-2 pr-2">
                                <Switch checked={row.isOpen} onCheckedChange={(v) => setHours((h) => ({ ...h, [d]: { ...row, isOpen: v } }))} />
                              </td>
                              <td className="py-2 pr-2">
                                <input type="time" disabled={!row.isOpen} value={row.open} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...row, open: e.target.value } }))} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm disabled:opacity-40" />
                              </td>
                              <td className="py-2 pr-2">
                                <input type="time" disabled={!row.isOpen} value={row.close} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...row, close: e.target.value } }))} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm disabled:opacity-40" />
                              </td>
                              <td className="py-2 pr-2">
                                <input type="time" disabled={!row.isOpen} value={row.open2} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...row, open2: e.target.value } }))} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm disabled:opacity-40" />
                              </td>
                              <td className="py-2">
                                <input type="time" disabled={!row.isOpen} value={row.close2} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...row, close2: e.target.value } }))} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm disabled:opacity-40" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <SaveButton onClick={() => save({
              bedCapacity, dailyOpdCount, is24x7,
              operatingHours: DAY_ORDER.map((d) => ({
                dayOfWeek: d,
                isOpen: hours[d]?.isOpen ?? false,
                openingTime: hours[d]?.open,
                closingTime: hours[d]?.close,
                openingTime2: hours[d]?.open2,
                closingTime2: hours[d]?.close2,
              })),
            })} />
          </Card>
        )}

        {section === "services" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">Specializations</h2>
              <div className="flex flex-wrap gap-2">
                {(meta.specialization?.options || specializations).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleInList(specializations, setSpecializations, s)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      specializations.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-background/60 text-foreground"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="bg-border/50" />

            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">Services</h2>
              <div className="space-y-5">
                {serviceGroups.length === 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>
                ) : serviceGroups.map(([key, group]) => (
                  <div key={key}>
                    <p className="text-sm font-semibold mb-2">{group.label}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {group.options.map((item) => {
                        const checked = services.includes(item);
                        return (
                          <label key={item} className={cn(
                            "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                            checked ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/60"
                          )}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleInList(services, setServices, item)} />
                            {item}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <ToggleRow title="Emergency services" checked={emergencyServices} onCheckedChange={setEmergencyServices} />
              <ToggleRow title="Ambulance available" checked={ambulanceAvailable} onCheckedChange={setAmbulanceAvailable} />
            </div>

            <SaveButton onClick={() => save({ specializations, services, emergencyServices, ambulanceAvailable })} />
          </Card>
        )}

        {section === "staff" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <TeamView />
          </Card>
        )}
      </div>
    </div>
  );
}
