"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import {
  Loader2, Save, LayoutGrid, MapPin, Gauge, Stethoscope, UserCog, KeyRound, History, IndianRupee, Lock, GraduationCap,
} from "lucide-react";
import { TeamView } from "./team";
import { PermissionsView } from "./permissions";
import { ActivityLogView } from "./activity-log";
import { FeesView } from "./fees";
import { canOpenPage } from "@/lib/staff-permissions";
import { useAppStore } from "@/lib/store";
import { LearningCenter } from "@/components/guidance/learning-center";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const SECTIONS = [
  { key: "overview", icon: LayoutGrid },
  { key: "location", icon: MapPin },
  { key: "capacity", icon: Gauge },
  { key: "services", icon: Stethoscope },
  { key: "fees", icon: IndianRupee },
];
const STAFF_SECTIONS = [{ key: "staff", icon: UserCog }, { key: "permissions", icon: KeyRound }, { key: "activity", icon: History }, { key: "learning", icon: GraduationCap }];

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
  const perms = useAppStore((st) => (st.staff && st.permissions !== null ? st.permissions : null));
  const router = useRouter();
  const setSection = (s: string) => router.push(`/facility/profile/${s}`);
  const [facility, setFacility] = useState<FacilityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const msg = useNotice(); // shown right above each section's Save button
  const [meta, setMeta] = useState<MetaSections>({});
  const t = useTranslations("clinic.profile");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  // 7 Jan 2024 was a Sunday, so day d of the week is 7 + d.
  const dayName = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString(dl, { weekday: "long" });
  const groupQuestion = (key: string, label: string) => (t.has(`q_${key}`) ? t(`q_${key}`) : t("q_generic", { label: label.toLowerCase() }));

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api.get<{ facility: FacilityProfile }>("/api/facility/profile")
      .then((res) => setFacility(res.facility))
      .catch((e) => setLoadError(e.message || tc("network_error")))
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
      msg.success(tc("saved"), t("saved_at", { time: new Date().toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) }));
    } catch (err: any) {
      msg.error(tc("not_saved"), t("still_filled", { error: err.message || tc("network_error") }), { retry: () => save(payload), retryLabel: t("save_again") });
    } finally {
      setSaving(false);
    }
  };

  const SaveButton = ({ onClick }: { onClick: () => void }) => (
    <>
    <NoticeSlot state={msg} />
    <div className="flex justify-end border-t border-border pt-5">
      <Button
        className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
        disabled={saving}
        onClick={onClick}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tc("save_changes")}
      </Button>
    </div>
    </>
  );

  if (!loading && loadError) return <LoadFailed what={t("what")} detail={loadError} onRetry={load} />;
  if (loading || !facility) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold">{t("title")}</h2>
      </div>

      <div className="grid md:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <div className="space-y-4 h-fit md:sticky md:top-24 md:self-start">
          <Card className="p-2 border-border/50 bg-card/60">
            <div className="space-y-1">
              {SECTIONS.filter(() => canOpenPage(perms, "/facility/profile")).map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-start transition-colors",
                      section === s.key ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t(`s_${s.key}`)}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-2 border-border/50 bg-card/60">
            <div className="space-y-1">
              {STAFF_SECTIONS.filter((s) => canOpenPage(perms, `/facility/profile/${s.key}`)).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-start transition-colors",
                    section === s.key ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                  )}
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t(`s_${s.key}`)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {section === "overview" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">{t("identity")}</h2>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
                <FloatingField id="facilityName" label={t("facility_name")} value={facilityName} onChange={(e) => setFacilityName(e.target.value)} />
                {meta.facility_type ? (
                  <FloatingSelect id="facilityType" label={t("facility_type")} value={facilityType} onValueChange={setFacilityType} placeholder={t("select_type")}>
                    {meta.facility_type.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                ) : (
                  <FloatingField id="facilityType" label={t("facility_type")} value={facilityType} onChange={(e) => setFacilityType(e.target.value)} />
                )}
                {facility?.hfrNumber ? (
                  <div>
                    <FloatingField id="hfrNumber" label={t("hfr")} value={hfrNumber} readOnly aria-readonly className="cursor-not-allowed bg-muted/50 text-muted-foreground focus:border-input" endAdornment={<Lock className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />} />
                    <p className="mt-1.5 text-xs text-muted-foreground">{t("hfr_locked")}</p>
                  </div>
                ) : (
                  <FloatingField id="hfrNumber" label={t("hfr")} value={hfrNumber} onChange={(e) => setHfrNumber(e.target.value.toUpperCase())} />
                )}
                <FloatingField id="establishmentDate" type="month" label={t("established")} value={establishmentDate} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setEstablishmentDate(e.target.value)} />
                <FloatingField id="alternateContactNumber" label={t("alt_contact")} value={alternateContactNumber} onChange={(e) => setAlternateContactNumber(e.target.value)} />
              </div>
            </div>

            <SaveButton onClick={() => save({ facilityName, facilityType, hfrNumber, establishmentDate, alternateContactNumber })} />
          </Card>
        )}

        {section === "location" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">{t("address")}</h2>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
                <FloatingField id="addressLine1" label={t("address1")} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
                <FloatingField id="addressLine2" label={t("address2")} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
                <FloatingField id="locality" label={t("locality")} value={locality} onChange={(e) => setLocality(e.target.value)} />
                <FloatingField id="city" label={t("city")} value={city} onChange={(e) => setCity(e.target.value)} />
                <FloatingField id="district" label={t("district")} value={district} onChange={(e) => setDistrict(e.target.value)} />
                <FloatingField id="state" label={t("state")} value={state} onChange={(e) => setState(e.target.value)} />
                <FloatingField id="country" label={t("country")} value={country} onChange={(e) => setCountry(e.target.value)} />
                <FloatingField id="pincode" label={t("pincode")} value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
            </div>
            <SaveButton onClick={() => save({ addressLine1, addressLine2, locality, city, district, state, country, pincode })} />
          </Card>
        )}

        {section === "capacity" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">{t("capacity")}</h2>
              <div className="grid sm:grid-cols-3 gap-x-4 gap-y-6">
                <FloatingField id="bedCapacity" type="number" label={t("beds")} value={bedCapacity} onChange={(e) => setBedCapacity(e.target.value)} />
                <FloatingField id="dailyOpdCount" type="number" label={t("daily_opd")} value={dailyOpdCount} onChange={(e) => setDailyOpdCount(e.target.value)} />
              </div>
            </div>

            <div>
              <h2 className="font-serif text-lg font-semibold mb-4">{t("hours")}</h2>
              <div className="space-y-4">
                <ToggleRow title={t("open_247")} checked={is24x7} onCheckedChange={setIs24x7} />
                {!is24x7 && (
                  <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border/50 text-start text-muted-foreground">
                          <th rowSpan={2} className="py-2 font-medium align-bottom">{t("day")}</th>
                          <th rowSpan={2} className="py-2 font-medium align-bottom">{t("open")}</th>
                          <th colSpan={2} className="py-2 font-medium text-center">{t("shift1")}</th>
                          <th colSpan={2} className="py-2 font-medium text-center">{t("shift2")}</th>
                        </tr>
                        <tr className="border-b border-border/50 text-start text-muted-foreground">
                          <th className="py-1.5 font-medium">{t("opening")}</th>
                          <th className="py-1.5 font-medium">{t("closing")}</th>
                          <th className="py-1.5 font-medium">{t("opening")}</th>
                          <th className="py-1.5 font-medium">{t("closing")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DAY_ORDER.map((d) => {
                          const row = hours[d] || { isOpen: false, open: "", close: "", open2: "", close2: "" };
                          return (
                            <tr key={d} className="border-b border-border/30 last:border-0">
                              <td className="py-2 pe-2 whitespace-nowrap">{dayName(d)}</td>
                              <td className="py-2 pe-2">
                                <Switch checked={row.isOpen} onCheckedChange={(v) => setHours((h) => ({ ...h, [d]: { ...row, isOpen: v } }))} />
                              </td>
                              <td className="py-2 pe-2">
                                <input type="time" disabled={!row.isOpen} value={row.open} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...row, open: e.target.value } }))} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm disabled:opacity-40" />
                              </td>
                              <td className="py-2 pe-2">
                                <input type="time" disabled={!row.isOpen} value={row.close} onChange={(e) => setHours((h) => ({ ...h, [d]: { ...row, close: e.target.value } }))} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm disabled:opacity-40" />
                              </td>
                              <td className="py-2 pe-2">
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

        {section === "services" && (() => {
          const groups: { key: string; label: string; options: string[]; selected: string[]; toggle: (v: string) => void }[] = [
            { key: "specialization", label: t("specializations"), options: meta.specialization?.options || specializations, selected: specializations, toggle: (v) => toggleInList(specializations, setSpecializations, v) },
            ...(serviceGroups.length
              ? serviceGroups.map(([key, group]) => ({ key, label: group.label, options: group.options, selected: services, toggle: (v: string) => toggleInList(services, setServices, v) }))
              : [{ key: "services", label: t("services_word"), options: services, selected: services, toggle: (v: string) => toggleInList(services, setServices, v) }]),
          ];
          return (
            <Card className="p-6 border-border/50 bg-card/60">
              <div className="divide-y divide-border">
                {groups.map((g) => {
                  const count = g.options.filter((o) => g.selected.includes(o)).length;
                  return (
                    <section key={g.key} className="py-5 first:pt-0">
                      <div className="mb-3 flex items-baseline justify-between gap-3">
                        <p className="text-[15px] font-semibold">{groupQuestion(g.key, g.label)}</p>
                        <span className={cn("shrink-0 text-xs font-medium", count ? "text-primary" : "text-muted-foreground")}>{count ? tc("n_selected", { count }) : t("none_selected")}</span>
                      </div>
                      <div className="gap-2 sm:columns-2 xl:columns-3 [&>label]:mb-2">
                        {g.options.map((item) => {
                          const checked = g.selected.includes(item);
                          return (
                            <label key={item} className={cn(
                              "flex break-inside-avoid items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium leading-snug cursor-pointer transition-colors",
                              checked ? "border-primary/50 bg-primary/5" : "border-input bg-background/60 hover:border-primary/30"
                            )}>
                              <Checkbox className="mt-0.5" checked={checked} onCheckedChange={() => g.toggle(item)} />
                              <span className="min-w-0">{item}</span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
                <section className="pt-5">
                  <p className="mb-3 text-[15px] font-semibold">{t("q_emergency")}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ToggleRow title={t("emergency")} checked={emergencyServices} onCheckedChange={setEmergencyServices} />
                    <ToggleRow title={t("ambulance")} checked={ambulanceAvailable} onCheckedChange={setAmbulanceAvailable} />
                  </div>
                </section>
              </div>

              <SaveButton onClick={() => save({ specializations, services, emergencyServices, ambulanceAvailable })} />
            </Card>
          );
        })()}

        {section === "staff" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <TeamView />
          </Card>
        )}

        {section === "fees" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <FeesView />
          </Card>
        )}

        {section === "learning" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <LearningCenter isOwner={!perms} />
          </Card>
        )}

        {section === "activity" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <ActivityLogView />
          </Card>
        )}

        {section === "permissions" && (
          <Card className="p-6 border-border/50 bg-card/60">
            <PermissionsView />
          </Card>
        )}
      </div>
    </div>
  );
}
