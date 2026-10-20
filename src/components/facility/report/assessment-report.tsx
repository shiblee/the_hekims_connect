"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useValueLabel } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatAge, ageFromDob } from "@/lib/age";
import { calculateBmi } from "@/lib/bmi";
import { courseFor } from "@/lib/chronology";
import { bpStatus, pulseStatus, spo2Status, temperatureStatus, bmiStatus, type VitalStatus } from "@/lib/vital-status";
import { LoadFailed } from "@/components/shared/inline-notice";
import { BodyFigure } from "@/components/facility/views/body-map";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";

type R = any;
const HUMOURS = [
  { key: "dam", label: "Dam", color: "#dc2626" },
  { key: "safra", label: "Safra", color: "#d97706" },
  { key: "balgham", label: "Balgham", color: "#0284c7" },
  { key: "sauda", label: "Sauda", color: "#7c3aed" },
];
const PILLAR_EMOJI: Record<string, string> = { hawa: "🌬️", makool: "🍽️", harkat_badani: "🏃", harkat_nafsani: "🧠", naum: "😴", ihtibas: "💧" };

const ONSET: Record<string, string> = { "<24h": "onset_24h", "1-7d": "onset_7d", ">1m": "onset_1m" };
/** Dates follow the page language (set on <html lang>), with Western digits; English uses Indian day-month order. */
const reportLocale = () => { const l = typeof document !== "undefined" ? document.documentElement.lang : "en"; return !l || l === "en" ? "en-IN" : `${l}-u-nu-latn`; };
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(reportLocale(), { day: "numeric", month: "short", year: "numeric" }) : "—");
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString(reportLocale(), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

function parseInsight(text: string | null | undefined) {
  if (!text) return null;
  try {
    const p = JSON.parse(text);
    if (p && typeof p.headline === "string") return p as { headline: string; findings: { text: string; severity: string }[]; unani: string; priority: string };
  } catch { /* plain text */ }
  return { headline: text, findings: [], unani: "", priority: "" };
}

/**
 * The printable Comprehensive Patient Assessment Report for one visit.
 * On screen: a paper preview with a toolbar. On paper / PDF: only the report,
 * A4, with a repeating header and page numbers. Read-only — it never changes
 * the visit or its stage.
 */
export function AssessmentReport({ patientId, visitId }: { patientId: string; visitId?: string }) {
  const router = useRouter();
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("clinic.report");
  const tc = useTranslations("common");
  const t3 = useTranslations("clinic.stage3");
  const ts = useTranslations("clinic.vital_status");
  const vl = useValueLabel();
  const UNITS = ["hours", "days", "weeks", "months", "years"];
  const dur = (n: number, u: string | null | undefined) => (u && UNITS.includes(u) ? t3(`n_${u}`, { count: n }) : `${n} ${u ?? ""}`.trim());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let vid = visitId;
        if (!vid) {
          const v = await api.get<{ visits: { id: string; visitDate: string }[] }>(`/api/facility/visits?patientId=${patientId}`);
          vid = [...(v.visits || [])].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]?.id;
        }
        if (!vid) throw new Error(t("no_visit"));
        const res = await api.get<R>(`/api/facility/visits/${vid}/report`);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e.message || tc("network_error"));
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, visitId]);

  if (error) return <div className="max-w-3xl"><LoadFailed what={t("the_report")} detail={error} /></div>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-12"><Loader2 className="h-4 w-4 animate-spin" /> {t("preparing")}</div>;

  // ---------------------------------------------------------------- status
  const ws = data.warningSigns;
  const decided = ws && ["cleared", "referred", "continued_ama"].includes(ws.outcome);
  const chron = data.later?.chronology;
  const course = chron?.durationValue != null ? courseFor(String(chron.durationValue), chron.durationUnit || "days") : null;
  const mz = data.later?.mizajAssessment;
  const regionItems = data.later?.regionDetails || [];
  const asbab = data.later?.asbab;
  const dos = data.later?.dossier;
  const dalail = data.later?.dalail;
  const asbabAnswered = asbab?.pillars?.some((pl: R) => pl.answers.length > 0);
  const drift: Record<string, number> | null = asbab?.humoral?.percent || null;
  const driftLead = asbab?.humoral?.dominant ? HUMOURS.find((h) => h.key === asbab.humoral.dominant)?.label : null;
  const seniorDoctor = [data.later?.regionsRecordedBy, chron?.recordedBy, data.visit.doctor].find((d: R) => d?.name)?.name || null;
  const stage3UpdatedAt = [data.later?.regionsUpdatedAt, chron?.updatedAt].filter(Boolean).sort().pop() || null;
  const missing = [
    !data.vitals && t("m_vitals"),
    !(data.complaints?.length) && t("m_complaints"),
    !decided && t("m_signs"),
    !data.otherSymptoms && t("m_other"),
  ].filter(Boolean) as string[];
  const complete = missing.length === 0;
  const stage3 = data.later?.regions?.length > 0 || !!chron;
  const stage4 = data.later?.asbab?.status === "completed";
  const statusLabel = data.referral ? t("st_referred") : data.later?.dossier?.status === "finalized" ? t("st_final") : complete ? (stage4 ? t("st_4") : stage3 ? t("st_3") : t("st_2")) : t("st_draft");

  const p = data.patient;
  const v = data.vitals || {};
  const age = ageFromDob(p.dob);
  const isChild = !!age && ((age.unit === "years" && age.value < 18) || age.unit !== "years");
  const heightCm = v.heightCm ?? data.carriedMeasure?.heightCm ?? null;
  const weightKg = v.weightKg ?? data.carriedMeasure?.weightKg ?? null;
  const measureCarried = v.heightCm == null && v.weightKg == null && !!data.carriedMeasure;
  const bmi = calculateBmi(heightCm, weightKg);
  const nr = data.normalRanges;
  const sev = (n: number | null) => (n == null ? null : data.severityLabels.find((s: R) => s.level === n)?.label ?? null);
  const allergies: string[] = Array.from(new Set([...(p.allergies ? String(p.allergies).split(/[,;]\s*/) : []), ...(data.intake?.allergies || [])].map((a: string) => a.trim()).filter(Boolean)));
  const doctor = data.visit.doctor;
  const b = data.branding;
  const year = new Date(data.report.generatedAt).getFullYear();

  const vitalRows: { label: string; value: string; unit: string; status: VitalStatus | null; note?: string }[] = [
    { label: t("v_bp"), value: v.bpSystolic != null || v.bpDiastolic != null ? `${v.bpSystolic ?? "—"}/${v.bpDiastolic ?? "—"}` : "", unit: "mmHg", status: bpStatus(v.bpSystolic ?? null, v.bpDiastolic ?? null, nr, ts) },
    { label: t("v_pulse"), value: v.pulse != null ? String(v.pulse) : "", unit: "bpm", status: pulseStatus(v.pulse ?? null, nr, ts) },
    { label: "SpO₂", value: v.spo2 != null ? String(v.spo2) : "", unit: "%", status: spo2Status(v.spo2 ?? null, nr, ts), note: v.spo2Context || undefined },
    { label: t("v_temp"), value: v.temperatureF != null ? String(v.temperatureF) : "", unit: "°F", status: temperatureStatus(v.temperatureF ?? null, nr, ts), note: v.temperatureC != null ? `${v.temperatureC} °C` : undefined },
    { label: t("v_height"), value: heightCm != null ? String(heightCm) : "", unit: "cm", status: null, note: measureCarried && heightCm != null ? t("from_visit", { code: data.carriedMeasure.visitCode }) : undefined },
    { label: t("v_weight"), value: weightKg != null ? String(weightKg) : "", unit: "kg", status: null, note: measureCarried && weightKg != null ? t("from_visit", { code: data.carriedMeasure.visitCode }) : undefined },
    { label: "BMI", value: bmi != null ? bmi.toFixed(1) : "", unit: "kg/m²", status: isChild ? null : bmiStatus(bmi, ts), note: bmi != null && isChild ? t("bmi_child") : bmi != null ? t("bmi_calc") : undefined },
  ];
  if (v.heartRate != null) vitalRows.splice(2, 0, { label: t("v_hr"), value: String(v.heartRate), unit: "bpm", status: null });

  const l1 = parseInsight(data.l1Screening?.insight);
  const pageCss = `
    @page { size: A4; margin: 15mm 13mm 17mm 13mm;
      @bottom-left { content: "${data.report.id.replace(/"/g, "")} · ${t("page_footer").replace(/"/g, "")}"; font: 8.5pt system-ui, sans-serif; color: #6b7280; }
      @bottom-right { content: "${t("page_of").replace(/"/g, "")} " counter(page) " ${t("of").replace(/"/g, "")} " counter(pages); font: 8.5pt system-ui, sans-serif; color: #6b7280; }
    }
    /* Printing uses a copy mounted straight on <body>, so the app's own
       scrolling layout can't clip the report to a single page. */
    #report-print { display: none; }
    @media print {
      html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
      body > *:not(#report-print) { display: none !important; }
      #report-print { display: block !important; }
      #report-print .report-doc { width: 100% !important; box-shadow: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; }
    }
    .report-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-doc section, .report-doc .rpt-keep { break-inside: avoid; }
    .report-doc h2 { break-after: avoid; }
  `;

  const doc = (
        <article className="report-doc w-[210mm] max-w-full bg-white text-[#1f2937] shadow-xl ring-1 ring-black/5 px-[13mm] py-[12mm] text-[11.5pt] leading-snug" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Noto Nastaliq Urdu', sans-serif" }}>
          <table className="w-full border-collapse">
            {/* Repeats at the top of every printed page */}
            <thead>
              <tr><td>
                <div className="flex items-center justify-between gap-3 border-b border-[#0f766e]/40 pb-1.5 mb-4 text-[9pt] text-[#4b5563]">
                  <span className="flex items-center gap-1.5 font-semibold text-[#0f766e]">
                    <img src="/brand/hekim-globe-icon.png" alt="" className="h-4 w-4" />
                    {b.portal_name}
                  </span>
                  <span>{b.report_title} · {p.name}{p.patientCode ? ` (${p.patientCode})` : ""} · {t("visit_n", { code: data.visit.visitCode })}</span>
                </div>
              </td></tr>
            </thead>
            <tfoot><tr><td><div className="h-2" /></td></tr></tfoot>
            <tbody><tr><td>

              {/* ---------------- Masthead ---------------- */}
              <header className="rpt-keep flex items-start justify-between gap-6 pb-4 border-b-2 border-[#0f766e]">
                <div>
                  <img src="/brand/hekim-connect-logo-full.png" alt={b.portal_name} className="h-11 w-auto" />
                  <p className="mt-1.5 text-[10pt] italic text-[#4b5563]">{b.slogan}</p>
                  <p className="text-[9.5pt] text-[#0f766e]">{b.website_url.replace(/^https?:\/\//, "")}</p>
                </div>
                <div className="text-end">
                  <h1 className="font-serif text-[19pt] font-bold leading-tight text-[#111827]">{b.report_title}</h1>
                  <p className="text-[10.5pt] text-[#4b5563]">{b.report_subtitle}</p>
                </div>
              </header>

              {/* Identification */}
              <div className="rpt-keep mt-3 grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-x-4 gap-y-1.5 text-[10pt]">
                <IdField label={t("report_id")} value={data.report.id} mono />
                <IdField label={t("patient_id")} value={p.patientCode || "—"} mono />
                <IdField label={t("visit")} value={data.visit.visitCode} mono />
                <IdField label={t("assessment_date")} value={fmtDate(data.visit.visitDate)} />
                <IdField label={t("generated")} value={fmtDateTime(data.report.generatedAt)} />
                <IdField label={t("generated_by")} value={data.report.generatedBy || "—"} />
                <IdField label={t("version")} value={t("live_v1")} />
                <IdField label={t("status")} value={statusLabel} strong />
              </div>

              {/* Status banner */}
              {!complete && !data.referral ? (
                <div className="rpt-keep mt-3 rounded border-2 border-dashed border-[#b45309] bg-[#fffbeb] px-3 py-2">
                  <p className="text-[11.5pt] font-bold tracking-wide text-[#92400e]">{t("st_draft")}</p>
                  <p className="text-[10pt] text-[#78350f]">{t("draft_banner_hint", { items: missing.join(", ") })}</p>
                </div>
              ) : null}

              {/* Emergency banner */}
              {(data.referral || ws?.present?.length > 0) && (
                <div className="rpt-keep mt-3 rounded border-2 border-[#b91c1c] bg-[#fef2f2] px-3 py-2">
                  <p className="text-[11.5pt] font-bold text-[#991b1b]">{t("emergency")}{data.referral ? t("referred_banner", { urgency: vl(String(data.referral.urgency)).toLocaleUpperCase() }) : ""}</p>
                  {ws?.present?.length > 0 && <p className="text-[10.5pt] text-[#7f1d1d]">{t("signs_present", { items: ws.present.map((s: R) => s.label).join("; ") })}</p>}
                  {data.referral && <p className="text-[10.5pt] text-[#7f1d1d]">{t.rich("referred_to_on", { to: data.referral.referredTo, date: fmtDateTime(data.referral.createdAt), b: (c) => <b>{c}</b> })}</p>}
                </div>
              )}

              {/* Allergy alert */}
              {allergies.length > 0 && (
                <div className="rpt-keep mt-3 rounded border-2 border-[#b91c1c] px-3 py-1.5 text-[11pt]">
                  <b className="text-[#991b1b]">{t("allergy_alert")}</b> {allergies.join(", ")} <span className="text-[9.5pt] text-[#6b7280]">{t("as_reported")}</span>
                </div>
              )}

              {/* ================= PART A ================= */}
              <PartDivider letter="A" emoji="🏥" title={t("part_a")} sub={t("part_a_sub")} />

              {/* ---------------- Patient & clinician ---------------- */}
              <div className="grid grid-cols-2 gap-5">
                <Section emoji="👤" title={t("s_patient")} n={1}>
                  <Facts rows={[
                    [t("f_name"), `${p.titlePrefix ? `${p.titlePrefix} ` : ""}${p.name}`],
                    [t("patient_id"), p.patientCode],
                    [t("f_age_sex"), `${formatAge(p.dob)}${p.dobApprox ? t("approx") : ""} · ${p.gender ? vl(p.gender) : t("sex_none")}`],
                    [t("f_marital"), p.maritalStatus ? vl(p.maritalStatus) : null],
                    [t("f_blood"), p.bloodGroup],
                    [t("f_mobile"), p.phone],
                    [t("f_location"), [p.city, p.state].filter(Boolean).join(", ") || null],
                    [t("f_emergency"), p.emergencyContactName || p.emergencyContact ? `${p.emergencyContactName || t("contact")}${p.emergencyRelationship ? ` (${vl(p.emergencyRelationship)})` : ""}${p.emergencyContact ? ` · ${p.emergencyContact}` : ""}` : null],
                    [t("f_registered"), fmtDate(p.createdAt)],
                    [t("f_earlier"), String(p.previousVisitCount)],
                  ]} />
                </Section>
                <Section emoji="🩺" title={t("s_clinician")} n={2}>
                  <Facts rows={[
                    [t("f_doctor"), doctor ? doctor.name : t("no_doctor")],
                    [t("f_designation"), doctor ? [doctor.designation, doctor.specialization].filter(Boolean).join(" · ") || null : null],
                    [t("f_qualification"), doctor?.qualification],
                    [t("f_regno"), doctor?.registrationNumber],
                    [t("f_staff"), doctor?.staffCode],
                    [t("f_facility"), data.facility?.registeredFacilityName || data.facility?.facilityName],
                    [t("f_facility_type"), data.facility?.facilityType],
                    [t("f_hfr"), data.facility?.hfrNumber],
                    [t("f_address"), [data.facility?.addressLine1, data.facility?.locality, data.facility?.city, data.facility?.state, data.facility?.pincode].filter(Boolean).join(", ") || null],
                    [t("contact"), [data.facility?.phone, data.facility?.email].filter(Boolean).join(" · ") || null],
                    [t("f_registered_by"), data.visit.registeredBy?.name],
                  ]} />
                </Section>
              </div>

              {/* ---------------- Vitals ---------------- */}
              <Section emoji="❤️" title={t("s_vitals")} n={3} meta={data.vitals ? t("recorded_at", { date: fmtDateTime(v.updatedAt) }) : undefined}>
                {!data.vitals && !data.carriedMeasure ? <Empty>{t("no_vitals")}</Empty> : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {vitalRows.map((r) => (
                      <div key={r.label} className={`rpt-keep rounded border px-2 py-1.5 ${r.status && r.status.tone !== "ok" ? "border-[#b91c1c] bg-[#fef2f2]" : "border-[#d1d5db]"}`}>
                        <p className="text-[9pt] uppercase tracking-wide text-[#6b7280]">{r.label}</p>
                        <p className="text-[13.5pt] font-bold leading-tight">{r.value ? <>{r.value} <span className="text-[9.5pt] font-normal text-[#6b7280]">{r.unit}</span></> : <span className="text-[10.5pt] font-normal text-[#9ca3af]">{t("not_recorded")}</span>}</p>
                        {r.status && <p className={`text-[9pt] font-semibold ${r.status.tone === "ok" ? "text-[#047857]" : "text-[#b91c1c]"}`}>{r.status.tone === "ok" ? "✓" : "▲"} {r.status.label}</p>}
                        {r.note && <p className="text-[8.5pt] text-[#6b7280]">{r.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[9pt] text-[#6b7280]">{t("vitals_note")}</p>
                {(v.painNotes || v.primaryFocusArea || v.triageRemarks || v.consciousnessLevel || v.mood) && (
                  <Facts className="mt-2" rows={[
                    [t("f_consciousness"), v.consciousnessLevel], [t("f_mood"), v.mood],
                    [t("f_pain"), v.painNotes], [t("f_focus"), v.primaryFocusArea], [t("f_remarks"), v.triageRemarks],
                  ]} />
                )}
              </Section>

              {/* ---------------- Reason for visit ---------------- */}
              <Section emoji="📝" title={t("s_reason")} n={4}>
                {data.complaints?.length ? (
                  <>
                    <div className="rpt-keep rounded bg-[#f0fdfa] border border-[#99f6e4] px-3 py-2 mb-2">
                      <p className="text-[9pt] uppercase tracking-wide text-[#0f766e] font-semibold">{t("primary_complaint")}</p>
                      <p className="text-[13.5pt] font-bold">{data.complaints[0].chiefComplaintLabel}</p>
                      <p className="text-[10pt] text-[#374151]">
                        {data.complaints[0].onsetValue != null ? t("for_dur", { value: dur(data.complaints[0].onsetValue, data.complaints[0].onsetUnit) }) : t("dur_none")}
                        {" · "}{data.complaints[0].severityScore != null ? t("severity_n", { value: `${data.complaints[0].severityScore}/10${sev(data.complaints[0].severityScore) ? ` (${sev(data.complaints[0].severityScore)})` : ""}` }) : t("sev_none")}
                      </p>
                    </div>
                    <table className="w-full text-[10pt] border-collapse">
                      <thead><tr className="text-start text-[9pt] uppercase tracking-wide text-[#6b7280] border-b border-[#d1d5db]">
                        <th className="py-1 pe-2 font-semibold">{t("th_complaint")}</th><th className="py-1 pe-2 font-semibold">{t("th_duration")}</th><th className="py-1 pe-2 font-semibold">{t("th_severity")}</th><th className="py-1 pe-2 font-semibold">{t("th_worse")}</th><th className="py-1 font-semibold">{t("th_better")}</th>
                      </tr></thead>
                      <tbody>
                        {data.complaints.map((c: R, i: number) => (
                          <tr key={i} className="align-top border-b border-[#f3f4f6]">
                            <td className="py-1 pe-2 font-medium">{c.chiefComplaintLabel}{i === 0 && <span className="ms-1 text-[8.5pt] text-[#0f766e]">{t("primary")}</span>}{c.clinicalNotes && <div className="text-[9pt] text-[#6b7280] font-normal">{c.clinicalNotes}</div>}</td>
                            <td className="py-1 pe-2">{c.onsetValue != null ? dur(c.onsetValue, c.onsetUnit) : <Dim>{t("not_recorded")}</Dim>}</td>
                            <td className="py-1 pe-2">{c.severityScore != null ? `${c.severityScore}/10${sev(c.severityScore) ? ` · ${sev(c.severityScore)}` : ""}` : <Dim>{t("not_recorded")}</Dim>}</td>
                            <td className="py-1 pe-2">{c.aggravatingFactors.length ? c.aggravatingFactors.join(", ") : <Dim>{t("none_recorded")}</Dim>}</td>
                            <td className="py-1">{c.relievingFactors.length ? c.relievingFactors.join(", ") : <Dim>{t("none_recorded")}</Dim>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <Empty>{t("complaints_none")}</Empty>}
                {data.intake && (
                  <Facts className="mt-2" rows={[
                    [t("f_at_reg"), data.intake.chiefComplaints.join(", ") || null],
                    [t("f_started"), data.intake.onsetTimeline ? (ONSET[data.intake.onsetTimeline] ? t(ONSET[data.intake.onsetTimeline]) : data.intake.onsetTimeline) : null],
                    [t("f_arrived"), data.intake.mobility === "wheelchair" ? t("wheelchair") : data.intake.mobility === "independent" ? t("walking") : null],
                  ]} />
                )}
                {data.intake?.narrative && (
                  <blockquote className="rpt-keep mt-2 border-s-4 border-[#d1d5db] ps-3 text-[10.5pt] italic text-[#374151]">
                    <span className="not-italic text-[9pt] uppercase tracking-wide text-[#6b7280] block">{t("own_words")}</span>
                    “{data.intake.narrative}”
                  </blockquote>
                )}
              </Section>

              {/* ---------------- Warning signs ---------------- */}
              <Section emoji="🚨" title={t("s_signs")} n={5} meta={ws?.updatedAt ? t("updated_at", { date: fmtDateTime(ws.updatedAt) }) : undefined}>
                {!ws ? <Empty tone="warn">{t("signs_not_done")}</Empty>
                  : !decided ? (
                    <>
                      <Empty tone="warn">{t("signs_incomplete")}</Empty>
                      {ws.present.length > 0 && <SignList items={ws.present} />}
                    </>
                  ) : ws.present.length > 0 ? (
                    <>
                      <p className="text-[10.5pt] font-semibold text-[#991b1b]">{t("signs_review")}</p>
                      <SignList items={ws.present} />
                    </>
                  ) : (
                    <p className="text-[10.5pt]">{t("signs_none", { reviewed: ws.reviewed, count: ws.criteriaCount, date: fmtDateTime(ws.updatedAt) })}</p>
                  )}
                {data.referral && (
                  <div className="rpt-keep mt-2 rounded border border-[#fca5a5] px-3 py-2">
                    <p className="text-[9.5pt] uppercase tracking-wide font-semibold text-[#991b1b]">{t("referral")}</p>
                    <Facts rows={[
                      [t("f_referred_to"), data.referral.referredTo], [t("f_urgency"), vl(data.referral.urgency)], [t("f_reason"), data.referral.reason],
                      [t("f_notes_rx"), data.referral.notes], [t("f_referred_on"), fmtDateTime(data.referral.createdAt)], [t("f_referred_by"), data.referral.referredBy?.name],
                    ]} />
                  </div>
                )}
                {data.amaDecline && (
                  <div className="rpt-keep mt-2 rounded border border-[#fcd34d] px-3 py-2">
                    <p className="text-[9.5pt] uppercase tracking-wide font-semibold text-[#92400e]">{t("ama")}</p>
                    <Facts rows={[[t("f_ama_reason"), data.amaDecline.reason], [t("f_patient_reason"), data.amaDecline.patientReason], [t("f_recorded"), fmtDateTime(data.amaDecline.createdAt)]]} />
                  </div>
                )}
              </Section>

              {/* ---------------- Other symptoms ---------------- */}
              <Section emoji="🔎" title={t("s_other")} n={6}>
                {!data.otherSymptoms ? <Empty>{t("not_assessed")}</Empty>
                  : data.otherSymptoms.symptoms.length ? <p className="text-[10.5pt]">{data.otherSymptoms.symptoms.join(" · ")}</p>
                    : <p className="text-[10.5pt]">{t("none_marked", { date: fmtDateTime(data.otherSymptoms.updatedAt) })}</p>}
              </Section>

              {/* ================= PART B — senior doctor ================= */}
              <PartDivider letter="B" emoji="👨‍⚕️" title={t("part_b")} sub={t("part_b_sub")} tone="senior" />

              <Section emoji="🧍" tone="senior" title={t("s_body")} n={7}
                meta={stage3UpdatedAt ? t("updated_at", { date: fmtDateTime(stage3UpdatedAt) }) : undefined}>
                <p className="rpt-keep mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#c4b5fd] bg-white px-3 py-1 text-[9.5pt] text-[#5b21b6]">
                  🩺 <b>{t("by_senior")}</b>
                  {seniorDoctor && <span>· {seniorDoctor}</span>}
                </p>
                {!data.later.regions?.length && !chron && !mz ? <Empty>{t("stage3_none")}</Empty> : (
                  <>
                    {data.later.regions?.length > 0 && (
                      <div className="rpt-keep grid grid-cols-[auto_1fr] gap-5 items-start">
                        <div className="flex gap-2 rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <BodyFigure view="front" items={regionItems} width={118} />
                          <BodyFigure view="back" items={regionItems} width={118} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9pt] uppercase tracking-wide text-[#6b7280] font-semibold mb-1.5">{t("regions_involved")}</p>
                          <ol className="space-y-1.5">
                            {regionItems.map((r: R, i: number) => (
                              <li key={r.label} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 ${r.primary ? "border-[#059669] bg-[#ecfdf5]" : "border-[#e5e7eb] bg-white"}`}>
                                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5pt] font-bold ${r.primary ? "bg-[#059669] text-white" : "border border-[#059669] text-[#059669]"}`}>{i + 1}</span>
                                <span className="min-w-0">
                                  <span className="block text-[10.5pt] font-semibold text-[#111827]">{r.label}{r.primary && <span className="ms-1.5 rounded bg-[#059669] px-1.5 py-px text-[7.5pt] font-bold tracking-wide text-white align-middle">{t("primary")}</span>}</span>
                                  {r.localTerms && <span className="block text-[9pt] text-[#6b7280]">{r.localTerms}</span>}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    )}

                    <div className="rpt-keep mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("onset_rhythm")}</p>
                        {chron?.onsetPatterns?.length
                          ? <div className="flex flex-wrap gap-1">{chron.onsetPatterns.map((o: string) => <span key={o} className="rounded-full border border-[#c4b5fd] bg-[#f5f3ff] px-2 py-0.5 text-[10pt] text-[#4c1d95]">{o}</span>)}</div>
                          : <Empty>{t("not_recorded_dot")}</Empty>}
                      </div>
                      <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("how_long")}</p>
                        {chron?.durationValue != null ? (
                          <>
                            <p className="text-[12pt] font-bold text-[#111827]">{dur(chron.durationValue, chron.durationUnit)}
                              {course && <span className="ms-2 rounded px-1.5 py-0.5 text-[9pt] font-semibold" style={{ background: `${course.style.dot}22`, color: course.style.dot }}>{t3(`course_${course.key}`)} · {course.unani}</span>}
                            </p>
                            <p className="text-[9.5pt] text-[#4b5563]">
                              {chron.onsetDate && t.rich("started_around", { date: fmtDate(chron.onsetDate), b: (c) => <b>{c}</b> })}
                              {chron.durationSource === "auto" && chron.sourceComplaint && t("from_longest", { label: chron.sourceComplaint })}
                            </p>
                            {course && <p className="text-[9pt] text-[#6b7280]">{t3(`course_${course.key}_range`)} — {t3(`course_${course.key}_hint`)}</p>}
                          </>
                        ) : <Empty>{t("not_recorded_dot")}</Empty>}
                      </div>
                    </div>

                    {(chron?.note || mz) && (
                      <Facts className="rpt-keep mt-3" rows={[
                        [t("f_chrono_note"), chron?.note],
                        [t("f_mizaj"), mz ? `${mz.result.split(" — ")[0]} · Damawi ${mz.dam}% · Safrawi ${mz.saffra}% · Balghami ${mz.balgham}% · Saudawi ${mz.sauda}% (${fmtDate(mz.createdAt)})` : null],
                        [t("f_nabz"), mz?.pulse],
                        [t("f_mizaj_notes"), mz?.notes],
                      ]} />
                    )}
                    <p className="mt-2 text-[9pt] text-[#6b7280]">{t("course_note")}</p>
                  </>
                )}
              </Section>

              {/* ---------------- Stage 4: Asbab-e-Sittah ---------------- */}
              <Section emoji="🌬️" tone="senior" title={t("s_asbab")} n={8}
                meta={asbab ? (asbab.status === "completed" ? t("completed_at", { date: fmtDateTime(asbab.completedAt) }) : t("draft_updated", { date: fmtDateTime(asbab.updatedAt) })) : undefined}>
                <p className="rpt-keep mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#c4b5fd] bg-white px-3 py-1 text-[9.5pt] text-[#5b21b6]">
                  🩺 <b>{t("by_senior")}</b>
                  {(asbab?.recordedBy?.name || seniorDoctor) && <span>· {asbab?.recordedBy?.name || seniorDoctor}</span>}
                </p>
                {!asbab || !asbabAnswered ? <Empty>{t("asbab_none")}</Empty> : (
                  <>
                    {drift && (
                      <div className="rpt-keep mb-3 rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1.5">{t("drift")}{driftLead && <span className="ms-1 normal-case tracking-normal text-[#111827]">{t.rich("leaning", { name: driftLead, b: (c) => <b>{c}</b> })}</span>}</p>
                        <div className="grid grid-cols-4 gap-3">
                          {HUMOURS.map((h) => (
                            <div key={h.key}>
                              <div className="flex items-baseline justify-between text-[9.5pt]"><span className="font-semibold" style={{ color: h.color }}>{h.label}</span><span className="tabular-nums">{drift[h.key] ?? 0}%</span></div>
                              <div className="mt-0.5 h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${drift[h.key] ?? 0}%`, background: h.color }} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {asbab.pillars.map((pl: R, i: number) => (
                        <div key={pl.key} className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <p className="text-[10.5pt] font-semibold text-[#4c1d95]">{PILLAR_EMOJI[pl.key] || "•"} {i + 1}. {pl.label} <span className="text-[9pt] font-normal text-[#6b7280]">· {pl.english}</span></p>
                          {pl.answers.length ? (
                            <dl className="mt-1 space-y-1">
                              {pl.answers.map((a: R, j: number) => (
                                <div key={j} className="text-[9.5pt] leading-snug">
                                  <dt className="text-[#6b7280]">{a.question}</dt>
                                  <dd className="font-medium text-[#111827]">{a.answer}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : <p className="mt-1 text-[9.5pt] italic text-[#6b7280]">{t("not_answered")}</p>}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[9pt] text-[#6b7280]">{t("drift_note")}</p>
                  </>
                )}
              </Section>

              {/* ---------------- Stage 5: Tashkhees & Ilaj ---------------- */}
              <Section emoji="⚕️" tone="senior" title={t("s_tashkhees")} n={9}
                meta={dos ? (dos.status === "finalized" ? t("finalised_at", { date: fmtDateTime(dos.finalizedAt) }) : t("draft_updated", { date: fmtDateTime(dos.updatedAt) })) : undefined}>
                <p className="rpt-keep mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#c4b5fd] bg-white px-3 py-1 text-[9.5pt] text-[#5b21b6]">
                  🩺 <b>{dos?.status === "finalized" ? t("final_senior") : t("by_senior")}</b>
                  {(dos?.finalizedByName || dos?.recordedBy?.name || seniorDoctor) && <span>· {dos?.finalizedByName || dos?.recordedBy?.name || seniorDoctor}</span>}
                </p>
                {!dos && !dalail ? <Empty>{t("tashkhees_none")}</Empty> : (
                  <div className="space-y-3">
                    {/* Diagnosis */}
                    {dos && (
                      <div className="rpt-keep rounded-lg border-2 border-[#7c3aed] bg-white px-3.5 py-2.5">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("diagnosis")}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><p className="text-[9pt] text-[#6b7280]">{t("asli")}</p><p className="text-[12pt] font-bold">{dos.mizajAsli || <Dim>{t("not_recorded")}</Dim>}</p></div>
                          <div><p className="text-[9pt] text-[#6b7280]">{t("su")}</p><p className="text-[12pt] font-bold">{[dos.suMizajType, dos.suMizajQuality, dos.suMizajGrade ? t("darja", { n: dos.suMizajGrade }) : null].filter(Boolean).join(" · ") || <Dim>{t("not_recorded")}</Dim>}</p></div>
                        </div>
                        {dos.organs?.length > 0 && <p className="mt-1 text-[10pt]"><span className="text-[#6b7280]">{t("organs")} </span><b>{dos.organs.join(", ")}</b></p>}
                        {dos.diagnosisNote && <p className="mt-1 text-[10.5pt] italic text-[#374151]">“{dos.diagnosisNote}”</p>}
                      </div>
                    )}

                    {/* Dala'il */}
                    {dalail?.sections?.length > 0 && (
                      <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("dalail")}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {dalail.sections.map((sec: R) => (
                            <div key={sec.key}>
                              <p className="text-[10pt] font-semibold text-[#4c1d95]">{sec.label} <span className="font-normal text-[9pt] text-[#6b7280]">· {sec.english}</span></p>
                              {sec.answers.map((a: R, j: number) => (
                                <p key={j} className="text-[9.5pt] leading-snug"><span className="text-[#6b7280]">{a.question}: </span><b className="font-medium">{a.answer}</b></p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dos && (
                      <>
                        {/* Usool */}
                        {(dos.usool?.length > 0 || dos.usoolNote) && (
                          <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                            <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("usool")}</p>
                            <div className="flex flex-wrap gap-1">{dos.usool.map((u: string) => <span key={u} className="rounded-full border border-[#c4b5fd] bg-[#f5f3ff] px-2 py-0.5 text-[10pt] text-[#4c1d95]">{u}</span>)}</div>
                            {dos.usoolNote && <p className="mt-1 text-[10pt] text-[#374151]">{dos.usoolNote}</p>}
                          </div>
                        )}

                        {/* Ilaj-bil-Dawa */}
                        <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("dawa")}</p>
                          {dos.prescriptions?.length ? (
                            <table className="w-full text-[10pt] border-collapse">
                              <thead><tr className="text-start text-[8.5pt] uppercase tracking-wide text-[#6b7280] border-b border-[#d1d5db]">
                                <th className="py-1 pe-2 font-semibold">#</th><th className="py-1 pe-2 font-semibold">{t("th_medicine")}</th><th className="py-1 pe-2 font-semibold">{t("th_form")}</th><th className="py-1 pe-2 font-semibold">{t("th_dose")}</th><th className="py-1 pe-2 font-semibold">{t("th_timing")}</th><th className="py-1 pe-2 font-semibold">{t("th_duration")}</th><th className="py-1 font-semibold">{t("th_with")}</th>
                              </tr></thead>
                              <tbody>
                                {dos.prescriptions.map((rx: R, i: number) => (
                                  <tr key={i} className="align-top border-b border-[#f3f4f6]">
                                    <td className="py-1 pe-2 text-[#6b7280]">{i + 1}</td>
                                    <td className="py-1 pe-2 font-semibold">{rx.name}{rx.instructions && <div className="text-[9pt] font-normal text-[#6b7280]">{rx.instructions}</div>}</td>
                                    <td className="py-1 pe-2">{rx.form || "—"}</td><td className="py-1 pe-2">{rx.dose || "—"}</td><td className="py-1 pe-2">{rx.timing || "—"}</td><td className="py-1 pe-2">{rx.duration || "—"}</td><td className="py-1">{rx.adjuvant || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : <Empty>{t("no_meds")}</Empty>}
                        </div>

                        {/* Ghiza + Tadbeer */}
                        <div className="rpt-keep grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                            <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("ghiza")}</p>
                            <p className="text-[9.5pt]"><span className="font-semibold text-[#047857]">{t("recommended")} </span>{dos.ghizaRecommended?.join(", ") || <Dim>—</Dim>}</p>
                            <p className="text-[9.5pt] mt-0.5"><span className="font-semibold text-[#b91c1c]">{t("avoid")} </span>{dos.ghizaAvoid?.join(", ") || <Dim>—</Dim>}</p>
                            {dos.ghizaNote && <p className="mt-1 text-[9.5pt] text-[#374151]">{dos.ghizaNote}</p>}
                          </div>
                          <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                            <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("tadbeer")}</p>
                            {dos.tadbeer?.length ? dos.tadbeer.map((td: R) => (
                              <p key={td.label} className="text-[9.5pt]"><b>{td.label}</b>{[td.frequency, td.duration, td.notes].filter(Boolean).length ? ` — ${[td.frequency, td.duration, td.notes].filter(Boolean).join(" · ")}` : ""}</p>
                            )) : <p className="text-[9.5pt] text-[#6b7280]">{t("none")}</p>}
                          </div>
                        </div>

                        {/* Prognosis & handover */}
                        <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">{t("prognosis_section")}</p>
                          <Facts rows={[
                            [t("f_prognosis"), dos.prognosis],
                            [t("f_priority"), dos.priority ? (["routine", "priority", "urgent"].includes(dos.priority) ? t(`pr_${dos.priority}`) : dos.priority) : null],
                            [t("f_followup"), dos.followUpDate || dos.followUpNote ? [dos.followUpDate ? fmtDate(dos.followUpDate) : null, dos.followUpNote].filter(Boolean).join(" — ") : null],
                          ]} />
                          {dos.urgentDirectives && <p className="mt-1.5 rounded border border-[#fca5a5] bg-[#fef2f2] px-2 py-1 text-[10pt] text-[#991b1b]"><b>{t("urgent_return")}</b> {dos.urgentDirectives}</p>}
                          {dos.handoverNote && <p className="mt-1.5 text-[10pt] text-[#374151] whitespace-pre-wrap"><span className="font-semibold text-[#111827]">{t("handover_note")} </span>{dos.handoverNote}</p>}
                        </div>
                      </>
                    )}
                    <p className="text-[9pt] text-[#6b7280]">{t("doses_note")}</p>
                  </div>
                )}
              </Section>

              {/* ================= PART C ================= */}
              <PartDivider letter="C" emoji="📚" title={t("part_c")} sub={t("part_c_sub")} />

              {/* ---------------- Allergies & medicines ---------------- */}
              <div className="grid grid-cols-2 gap-4">
                <Section emoji="⚠️" title={t("s_allergies")} n={10}>
                  {allergies.length ? (
                    <ul className="text-[10.5pt] space-y-0.5">{allergies.map((a) => <li key={a}>• <b>{a}</b> <span className="text-[9pt] text-[#6b7280]">{t("allergy_reported")}</span></li>)}</ul>
                  ) : data.intake ? <Empty>{t("allergy_none")}</Empty>
                    : <Empty>{t("allergy_unknown")}</Empty>}
                </Section>
                <Section emoji="💊" title={t("s_meds")} n={11}>
                  {data.intake?.medications?.length || p.currentMedications ? (
                    <>
                      {data.intake?.medications?.length > 0 && (
                        <ul className="text-[10.5pt] space-y-0.5">{data.intake.medications.map((m: R) => <li key={`${m.kind}${m.label}`}>• <b>{m.label}</b> <span className="text-[9pt] text-[#6b7280]">{m.kind === "medication" ? t("med_allo") : t("med_herb")}</span></li>)}</ul>
                      )}
                      {p.currentMedications && <p className="text-[10pt] mt-1"><Dim>{t("profile_note")}</Dim> {p.currentMedications}</p>}
                      <p className="mt-1 text-[9pt] text-[#6b7280]">{t("med_details")}</p>
                    </>
                  ) : data.intake ? <Empty>{t("med_none_reg")}</Empty> : <Empty>{t("med_unknown")}</Empty>}
                </Section>
              </div>

              {/* ---------------- Background ---------------- */}
              <Section emoji="📋" title={t("s_background")} n={12}>
                {[p.chronicConditions, p.medicalHistory, p.surgicalHistory, p.familyHistory, p.lifestyle, p.occupation].some(Boolean) ? (
                  <Facts rows={[
                    [t("f_chronic"), p.chronicConditions], [t("f_medical"), p.medicalHistory], [t("f_surgical"), p.surgicalHistory],
                    [t("f_family"), p.familyHistory], [t("f_lifestyle"), p.lifestyle], [t("f_occupation"), p.occupation],
                  ]} />
                ) : <Empty>{t("background_none")}</Empty>}
              </Section>

              {/* ---------------- Doctor notes ---------------- */}
              <Section emoji="🗒️" title={t("s_notes")} n={13} meta={data.residentNotes?.updatedAt ? t("updated_at", { date: fmtDateTime(data.residentNotes.updatedAt) }) : undefined}>
                {data.residentNotes?.points?.length ? (
                  <ul className="text-[10.5pt] space-y-0.5 list-disc ps-5">{data.residentNotes.points.map((pt: string, i: number) => <li key={i}>{pt}</li>)}</ul>
                ) : <Empty>{t("notes_none")}</Empty>}
                <p className="mt-1 text-[9pt] text-[#6b7280]">{t("notes_unchanged")}</p>
              </Section>

              {/* ---------------- Unani context ---------------- */}
              <Section emoji="🌿" title={t("s_unani")} n={14}>
                <Facts rows={[
                  [t("f_recorded_mizaj"), p.mizaj],
                  [t("f_balance"), data.humoral ? `Damawi ${Math.round(data.humoral.damPercent)}% · Safrawi ${Math.round(data.humoral.safraPercent)}% · Balghami ${Math.round(data.humoral.balghamPercent)}% · Saudawi ${Math.round(data.humoral.saudaPercent)}%` : null],
                  [t("f_dominant"), data.humoral ? `${data.humoral.dominantOverride ?? data.humoral.dominant}${data.humoral.dominantOverride ? t("doctor_pick", { name: data.humoral.dominant }) : t("computed_from")}` : null],
                  [t("f_asbab"), data.later.asbab ? (data.later.asbab.status === "completed" ? t("completed_at", { date: fmtDate(data.later.asbab.completedAt) }) : t("in_progress")) : null],
                  [t("f_tashkhees"), data.later.dossier?.mizajAsli || data.later.dossier?.suMizajQuality ? [data.later.dossier.mizajAsli && `Mizaj-e-Asli: ${data.later.dossier.mizajAsli}`, data.later.dossier.suMizajQuality && `Su-e-Mizaj: ${[data.later.dossier.suMizajType, data.later.dossier.suMizajQuality, data.later.dossier.suMizajGrade ? t("darja", { n: data.later.dossier.suMizajGrade }) : null].filter(Boolean).join(" ")}`].filter(Boolean).join(" · ") + (data.later.dossier.status === "finalized" ? t("finalised_by", { name: data.later.dossier.finalizedByName || t("doctor_word") }) : t("draft_suffix")) : null],
                  [t("f_dx_note"), data.later.dossier?.diagnosisNote],
                ]} empty={t("unani_none")} />
              </Section>

              {/* ---------------- Hakeem Insight ---------------- */}
              <Section emoji="✨" title={t("s_insight")} n={15}>
                <p className="mb-2 rounded bg-[#f3f4f6] px-2 py-1 text-[9pt] text-[#4b5563]">{t("insight_note")}</p>
                {!l1 && !data.routing && !data.humoral?.aiClue && !data.vitalsInsight ? <Empty>{t("insight_none")}</Empty> : (
                  <div className="space-y-2">
                    {data.routing && (
                      <Insight title={t("i_triage")} when={data.routing.updatedAt || data.routing.generatedAt}>
                        <p><b>{data.routing.priorityLevel}</b> · {t("next_step")} {data.routing.triageStream}</p>
                        <p className="text-[#4b5563]">{data.routing.justification}</p>
                      </Insight>
                    )}
                    {data.humoral?.aiClue && (
                      <Insight title={t("i_humoral", { name: data.humoral.dominantOverride ?? data.humoral.dominant })} when={data.humoral.aiClueGeneratedAt}>
                        <p>{data.humoral.aiClue}</p>
                      </Insight>
                    )}
                    {l1 && (
                      <Insight title={t("i_l1")} when={data.l1Screening?.updatedAt}>
                        <p className="font-medium">{l1.headline}</p>
                        {l1.findings?.length > 0 && <ul className="list-disc ps-5">{l1.findings.map((f, i) => <li key={i}>{f.severity === "red" ? "▲ " : ""}{f.text}</li>)}</ul>}
                        {l1.priority && <p><Dim>{t("check_first")}</Dim> {l1.priority}</p>}
                        {l1.unani && <p><Dim>{t("unani_note")}</Dim> {l1.unani}</p>}
                      </Insight>
                    )}
                    {data.vitalsInsight && (
                      <Insight title={t("i_vitals")} when={data.vitalsInsight.updatedAt || data.vitalsInsight.generatedAt}>
                        <p>{data.vitalsInsight.insight}</p>
                      </Insight>
                    )}
                  </div>
                )}
              </Section>

              {/* ---------------- Reports ---------------- */}
              <Section emoji="📁" title={t("s_reports")} n={16}>
                {data.reports?.length ? (
                  <table className="w-full text-[10pt] border-collapse">
                    <thead><tr className="text-start text-[9pt] uppercase tracking-wide text-[#6b7280] border-b border-[#d1d5db]">
                      <th className="py-1 pe-2 font-semibold">{t("th_report")}</th><th className="py-1 pe-2 font-semibold">{t("th_date")}</th><th className="py-1 pe-2 font-semibold">{t("th_result")}</th><th className="py-1 font-semibold">{t("th_review")}</th>
                    </tr></thead>
                    <tbody>{data.reports.map((r: R, i: number) => (
                      <tr key={i} className="align-top border-b border-[#f3f4f6]">
                        <td className="py-1 pe-2"><b>{r.title}</b>{r.source && <span className="text-[#6b7280]"> · {r.source}</span>}{r.findings && <div className="text-[9pt] text-[#4b5563]">{r.findings}</div>}</td>
                        <td className="py-1 pe-2">{fmtDate(r.reportDate || r.createdAt)}</td>
                        <td className={`py-1 pe-2 ${r.resultFlag === "critical" || r.resultFlag === "abnormal" ? "font-semibold text-[#b91c1c]" : ""}`}>{r.resultFlag === "unknown" ? t("not_stated") : r.resultFlag}</td>
                        <td className="py-1">{r.status === "reviewed" ? (r.reviewedByName ? t("reviewed_by", { name: r.reviewedByName }) : t("reviewed")) : t("awaiting")}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <Empty>{t("reports_none")}</Empty>}
                <p className="mt-1 text-[9pt] text-[#6b7280]">{t("reports_note")}</p>
              </Section>

              {/* ---------------- Authorization ---------------- */}
              <section className="rpt-keep mt-5 grid grid-cols-2 gap-6 border-t-2 border-[#0f766e] pt-4">
                <div>
                  <p className="text-[9pt] uppercase tracking-wide text-[#6b7280] font-semibold">{t("treating")}</p>
                  <div className="mt-8 border-b border-[#9ca3af]" />
                  <p className="mt-1 text-[10.5pt] font-semibold">{doctor?.name || t("not_assigned")}</p>
                  <p className="text-[9.5pt] text-[#4b5563]">{[doctor?.designation, doctor?.qualification].filter(Boolean).join(" · ") || " "}</p>
                  {doctor?.registrationNumber && <p className="text-[9.5pt] text-[#4b5563]">{t("reg_no", { value: doctor.registrationNumber })}</p>}
                  <p className="mt-1 text-[9.5pt] font-semibold text-[#92400e]">{t("sig_pending")}</p>
                </div>
                <div className="text-[9.5pt] text-[#4b5563]">
                  <p className="text-[9pt] uppercase tracking-wide text-[#6b7280] font-semibold">{t("details")}</p>
                  <p className="mt-1">{t("id_line")} <span className="font-mono text-[#111827]">{data.report.id}</span></p>
                  <p>{data.report.generatedBy ? t("gen_line_by", { date: fmtDateTime(data.report.generatedAt), name: data.report.generatedBy }) : t("gen_line", { date: fmtDateTime(data.report.generatedAt) })}</p>
                  <p>{t("live_note")}</p>
                  <p className="mt-2">{t("prepared_on", { portal: b.portal_name })}</p>
                </div>
              </section>

              {/* ---------------- Footer ---------------- */}
              <footer className="rpt-keep mt-5 border-t border-[#d1d5db] pt-2 text-[9pt] text-[#6b7280] space-y-1">
                <p><b className="text-[#374151]">{t("confidential")}</b> {b.confidentiality}</p>
                <p>{b.insight_disclaimer}</p>
                <p className="flex justify-between gap-3 flex-wrap">
                  <span>{t("rights", { year, owner: b.copyright_owner })}</span>
                  <span>{b.website_url.replace(/^https?:\/\//, "")}{b.support_email ? ` · ${b.support_email}` : ""}{b.support_phone ? ` · ${b.support_phone}` : ""}</span>
                </p>
              </footer>
            </td></tr></tbody>
          </table>
        </article>
  );

  return (
    <div className="w-full">
      <style>{pageCss}</style>

      {/* Toolbar — screen only */}
      <div className="rpt-noprint sticky top-0 z-20 -mx-4 lg:-mx-6 mb-5 px-4 lg:px-6 py-3 border-b border-border/60 bg-background/90 backdrop-blur flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => router.push(`/facility/patients/${patientId}/record`)}>
          <ArrowLeft className="h-4 w-4" /> {t("return")}
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{t("toolbar_title", { name: p.name })}</p>
          <p className="text-xs text-muted-foreground">{t("toolbar_hint", { id: data.report.id, date: fmtDateTime(data.report.generatedAt) })}</p>
        </div>
        <span className={`ms-auto rounded-full border px-2.5 py-1 text-xs font-semibold ${complete || data.referral ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" : "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"}`}>
          {complete || data.referral ? statusLabel : t("draft_short")}
        </span>
        <Button variant="outline" size="sm" onClick={() => window.print()} title={t("pdf_title")}>
          <Download className="h-4 w-4" /> {t("save_pdf")}
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {t("print")}
        </Button>
      </div>

      {/* The document */}
      <div className="flex justify-center pb-10">
        {doc}
      </div>
      {createPortal(<div id="report-print">{doc}</div>, document.body)}
    </div>
  );
}


// ---------------------------------------------------------------- pieces

function Section({ title, n, meta, emoji, tone, children }: { title: string; n: number; meta?: string; emoji?: string; tone?: "senior"; children: ReactNode }) {
  const senior = tone === "senior";
  return (
    <section className={`mt-6 ${senior ? "rounded-xl border-2 border-[#c4b5fd] bg-[#faf5ff] px-4 pb-4 pt-3" : ""}`}>
      <h2 className={`flex items-center justify-between gap-3 border-b-2 pb-1.5 mb-2.5 ${senior ? "border-[#c4b5fd]" : "border-[#e5e7eb]"}`}>
        <span className="flex items-center gap-2">
          {emoji && <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12pt] ${senior ? "bg-[#ede9fe]" : "bg-[#f0fdfa]"}`} aria-hidden>{emoji}</span>}
          <span className={`font-serif text-[13pt] font-bold ${senior ? "text-[#5b21b6]" : "text-[#0f766e]"}`}>
            <span className="text-[#9ca3af] font-sans text-[9.5pt] me-1.5">{String(n).padStart(2, "0")}</span>{title}
          </span>
        </span>
        {meta && <span className="text-[9pt] text-[#6b7280] font-normal">{meta}</span>}
      </h2>
      {children}
    </section>
  );
}

/** A banner that splits the report into parts (who recorded what). */
function PartDivider({ letter, emoji, title, sub, tone }: { letter: string; emoji: string; title: string; sub: string; tone?: "senior" }) {
  const t = useTranslations("clinic.report");
  const senior = tone === "senior";
  return (
    <div className={`rpt-keep mt-8 flex items-center gap-3 rounded-lg px-3.5 py-2.5 ${senior ? "bg-[#5b21b6] text-white" : "bg-[#0f766e] text-white"}`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-[15pt]" aria-hidden>{emoji}</span>
      <div className="min-w-0">
        <p className="text-[8.5pt] font-semibold uppercase tracking-[0.18em] opacity-80">{t("part", { letter })}</p>
        <p className="font-serif text-[13.5pt] font-bold leading-tight">{title}</p>
        <p className="text-[9.5pt] opacity-85">{sub}</p>
      </div>
    </div>
  );
}

function Facts({ rows, className, empty }: { rows: [string, string | null | undefined][]; className?: string; empty?: string }) {
  const shown = rows.filter(([, val]) => val != null && String(val).trim() !== "");
  if (!shown.length) return empty ? <Empty>{empty}</Empty> : null;
  return (
    <dl className={`grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-0.5 text-[10.5pt] ${className || ""}`}>
      {shown.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-[#6b7280]">{k}</dt>
          <dd className="font-medium text-[#111827]">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

function IdField({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className="text-[8.5pt] uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className={`${mono ? "font-mono" : ""} ${strong ? "font-bold" : "font-medium"} text-[#111827]`}>{value}</p>
    </div>
  );
}

function Empty({ children, tone }: { children: ReactNode; tone?: "warn" }) {
  return <p className={`text-[10.5pt] italic ${tone === "warn" ? "text-[#92400e]" : "text-[#6b7280]"}`}>{children}</p>;
}

function Dim({ children }: { children: ReactNode }) {
  return <span className="text-[#6b7280]">{children}</span>;
}

function SignList({ items }: { items: { label: string; custom: boolean }[] }) {
  const t = useTranslations("clinic.report");
  return (
    <ul className="mt-1 text-[10.5pt] space-y-0.5">
      {items.map((s) => <li key={s.label} className="font-semibold text-[#991b1b]">▲ {s.label}{s.custom && <span className="font-normal text-[9pt] text-[#6b7280]">{t("added_by_staff")}</span>}</li>)}
    </ul>
  );
}

function Insight({ title, when, children }: { title: string; when?: string | null; children: ReactNode }) {
  const t = useTranslations("clinic.report");
  return (
    <div className="rpt-keep rounded border border-[#c7d2fe] px-3 py-1.5 text-[10.5pt]">
      <p className="flex justify-between gap-2 text-[9pt] uppercase tracking-wide font-semibold text-[#4338ca]">
        <span>✦ {title}</span>
        <span className="font-normal normal-case tracking-normal text-[#6b7280]">{t("insight_label")} · {when ? fmtDateTime(when) : t("time_none")}</span>
      </p>
      <div className="mt-0.5 space-y-0.5">{children}</div>
    </div>
  );
}
