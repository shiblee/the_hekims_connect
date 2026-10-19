"use client";

import { useEffect, useState, type ReactNode } from "react";
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

const ONSET: Record<string, string> = { "<24h": "Under 24 hours", "1-7d": "1–7 days", ">1m": "Over 1 month" };
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let vid = visitId;
        if (!vid) {
          const v = await api.get<{ visits: { id: string; visitDate: string }[] }>(`/api/facility/visits?patientId=${patientId}`);
          vid = [...(v.visits || [])].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0]?.id;
        }
        if (!vid) throw new Error("This patient has no visit to report on yet");
        const res = await api.get<R>(`/api/facility/visits/${vid}/report`);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Network error");
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, visitId]);

  if (error) return <div className="max-w-3xl"><LoadFailed what="the assessment report" detail={error} /></div>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-12"><Loader2 className="h-4 w-4 animate-spin" /> Preparing the report…</div>;

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
    !data.vitals && "Vital signs",
    !(data.complaints?.length) && "Main complaints",
    !decided && "Emergency warning signs",
    !data.otherSymptoms && "Other symptoms",
  ].filter(Boolean) as string[];
  const complete = missing.length === 0;
  const stage3 = data.later?.regions?.length > 0 || !!chron;
  const stage4 = data.later?.asbab?.status === "completed";
  const statusLabel = data.referral ? "Referred" : data.later?.dossier?.status === "finalized" ? "Finalised — dossier handed over" : complete ? (stage4 ? "Stage 4 assessment recorded" : stage3 ? "Stage 3 assessment recorded" : "Stage 2 assessment complete") : "DRAFT — INCOMPLETE ASSESSMENT";

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
    { label: "Blood pressure", value: v.bpSystolic != null || v.bpDiastolic != null ? `${v.bpSystolic ?? "—"}/${v.bpDiastolic ?? "—"}` : "", unit: "mmHg", status: bpStatus(v.bpSystolic ?? null, v.bpDiastolic ?? null, nr) },
    { label: "Pulse (Nabz)", value: v.pulse != null ? String(v.pulse) : "", unit: "bpm", status: pulseStatus(v.pulse ?? null, nr) },
    { label: "SpO₂", value: v.spo2 != null ? String(v.spo2) : "", unit: "%", status: spo2Status(v.spo2 ?? null, nr), note: v.spo2Context || undefined },
    { label: "Temperature", value: v.temperatureF != null ? String(v.temperatureF) : "", unit: "°F", status: temperatureStatus(v.temperatureF ?? null, nr), note: v.temperatureC != null ? `${v.temperatureC} °C` : undefined },
    { label: "Height", value: heightCm != null ? String(heightCm) : "", unit: "cm", status: null, note: measureCarried && heightCm != null ? `From visit ${data.carriedMeasure.visitCode}` : undefined },
    { label: "Weight", value: weightKg != null ? String(weightKg) : "", unit: "kg", status: null, note: measureCarried && weightKg != null ? `From visit ${data.carriedMeasure.visitCode}` : undefined },
    { label: "BMI", value: bmi != null ? bmi.toFixed(1) : "", unit: "kg/m²", status: isChild ? null : bmiStatus(bmi), note: bmi != null && isChild ? "Adult BMI bands not applied (under 18)" : bmi != null ? "Calculated: weight ÷ height²" : undefined },
  ];
  if (v.heartRate != null) vitalRows.splice(2, 0, { label: "Heart rate (monitor)", value: String(v.heartRate), unit: "bpm", status: null });

  const l1 = parseInsight(data.l1Screening?.insight);
  const pageCss = `
    @page { size: A4; margin: 15mm 13mm 17mm 13mm;
      @bottom-left { content: "${data.report.id.replace(/"/g, "")} · Confidential"; font: 8.5pt system-ui, sans-serif; color: #6b7280; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8.5pt system-ui, sans-serif; color: #6b7280; }
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
                  <span>{b.report_title} · {p.name}{p.patientCode ? ` (${p.patientCode})` : ""} · Visit {data.visit.visitCode}</span>
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
                <IdField label="Report ID" value={data.report.id} mono />
                <IdField label="Patient ID" value={p.patientCode || "—"} mono />
                <IdField label="Visit" value={data.visit.visitCode} mono />
                <IdField label="Assessment date" value={fmtDate(data.visit.visitDate)} />
                <IdField label="Generated" value={fmtDateTime(data.report.generatedAt)} />
                <IdField label="Generated by" value={data.report.generatedBy || "—"} />
                <IdField label="Version" value="Live report (v1)" />
                <IdField label="Report status" value={statusLabel} strong />
              </div>

              {/* Status banner */}
              {!complete && !data.referral ? (
                <div className="rpt-keep mt-3 rounded border-2 border-dashed border-[#b45309] bg-[#fffbeb] px-3 py-2">
                  <p className="text-[11.5pt] font-bold tracking-wide text-[#92400e]">DRAFT — INCOMPLETE ASSESSMENT</p>
                  <p className="text-[10pt] text-[#78350f]">Not a finalized clinical assessment. Not yet recorded: {missing.join(", ")}.</p>
                </div>
              ) : null}

              {/* Emergency banner */}
              {(data.referral || ws?.present?.length > 0) && (
                <div className="rpt-keep mt-3 rounded border-2 border-[#b91c1c] bg-[#fef2f2] px-3 py-2">
                  <p className="text-[11.5pt] font-bold text-[#991b1b]">⚠ EMERGENCY WARNING{data.referral ? ` — PATIENT REFERRED (${String(data.referral.urgency).toUpperCase()})` : ""}</p>
                  {ws?.present?.length > 0 && <p className="text-[10.5pt] text-[#7f1d1d]">Signs present: {ws.present.map((s: R) => s.label).join("; ")}.</p>}
                  {data.referral && <p className="text-[10.5pt] text-[#7f1d1d]">Referred to <b>{data.referral.referredTo}</b> on {fmtDateTime(data.referral.createdAt)}.</p>}
                </div>
              )}

              {/* Allergy alert */}
              {allergies.length > 0 && (
                <div className="rpt-keep mt-3 rounded border-2 border-[#b91c1c] px-3 py-1.5 text-[11pt]">
                  <b className="text-[#991b1b]">⚠ ALLERGY ALERT:</b> {allergies.join(", ")} <span className="text-[9.5pt] text-[#6b7280]">(as reported; see Allergies)</span>
                </div>
              )}

              {/* ================= PART A ================= */}
              <PartDivider letter="A" emoji="🏥" title="Registration & triage" sub="Stages 1–2 · recorded at the front desk and the triage booth" />

              {/* ---------------- Patient & clinician ---------------- */}
              <div className="grid grid-cols-2 gap-5">
                <Section emoji="👤" title="Patient" n={1}>
                  <Facts rows={[
                    ["Name", `${p.titlePrefix ? `${p.titlePrefix} ` : ""}${p.name}`],
                    ["Patient ID", p.patientCode],
                    ["Age / sex", `${formatAge(p.dob)}${p.dobApprox ? " (approx.)" : ""} · ${p.gender || "Sex not recorded"}`],
                    ["Marital status", p.maritalStatus],
                    ["Blood group", p.bloodGroup],
                    ["Mobile", p.phone],
                    ["Location", [p.city, p.state].filter(Boolean).join(", ") || null],
                    ["Emergency contact", p.emergencyContactName || p.emergencyContact ? `${p.emergencyContactName || "Contact"}${p.emergencyRelationship ? ` (${p.emergencyRelationship})` : ""}${p.emergencyContact ? ` · ${p.emergencyContact}` : ""}` : null],
                    ["Registered", fmtDate(p.createdAt)],
                    ["Earlier visits here", String(p.previousVisitCount)],
                  ]} />
                </Section>
                <Section emoji="🩺" title="Clinician & facility" n={2}>
                  <Facts rows={[
                    ["Treating doctor", doctor ? doctor.name : "No doctor assigned to this visit"],
                    ["Designation", doctor ? [doctor.designation, doctor.specialization].filter(Boolean).join(" · ") || null : null],
                    ["Qualification", doctor?.qualification],
                    ["Registration no.", doctor?.registrationNumber],
                    ["Staff ID", doctor?.staffCode],
                    ["Facility", data.facility?.registeredFacilityName || data.facility?.facilityName],
                    ["Facility type", data.facility?.facilityType],
                    ["HFR number", data.facility?.hfrNumber],
                    ["Address", [data.facility?.addressLine1, data.facility?.locality, data.facility?.city, data.facility?.state, data.facility?.pincode].filter(Boolean).join(", ") || null],
                    ["Contact", [data.facility?.phone, data.facility?.email].filter(Boolean).join(" · ") || null],
                    ["Registered by", data.visit.registeredBy?.name],
                  ]} />
                </Section>
              </div>

              {/* ---------------- Vitals ---------------- */}
              <Section emoji="❤️" title="Vital signs & measurements" n={3} meta={data.vitals ? `Recorded ${fmtDateTime(v.updatedAt)}` : undefined}>
                {!data.vitals && !data.carriedMeasure ? <Empty>Vital signs not recorded for this visit.</Empty> : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {vitalRows.map((r) => (
                      <div key={r.label} className={`rpt-keep rounded border px-2 py-1.5 ${r.status && r.status.tone !== "ok" ? "border-[#b91c1c] bg-[#fef2f2]" : "border-[#d1d5db]"}`}>
                        <p className="text-[9pt] uppercase tracking-wide text-[#6b7280]">{r.label}</p>
                        <p className="text-[13.5pt] font-bold leading-tight">{r.value ? <>{r.value} <span className="text-[9.5pt] font-normal text-[#6b7280]">{r.unit}</span></> : <span className="text-[10.5pt] font-normal text-[#9ca3af]">Not recorded</span>}</p>
                        {r.status && <p className={`text-[9pt] font-semibold ${r.status.tone === "ok" ? "text-[#047857]" : "text-[#b91c1c]"}`}>{r.status.tone === "ok" ? "✓" : "▲"} {r.status.label}</p>}
                        {r.note && <p className="text-[8.5pt] text-[#6b7280]">{r.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[9pt] text-[#6b7280]">Status words compare each value with the normal ranges configured for this platform; they are not a diagnosis. Respiratory rate is not captured by this platform.</p>
                {(v.painNotes || v.primaryFocusArea || v.triageRemarks || v.consciousnessLevel || v.mood) && (
                  <Facts className="mt-2" rows={[
                    ["Consciousness", v.consciousnessLevel], ["Mood", v.mood],
                    ["Pain notes", v.painNotes], ["Primary focus area", v.primaryFocusArea], ["Triage remarks", v.triageRemarks],
                  ]} />
                )}
              </Section>

              {/* ---------------- Reason for visit ---------------- */}
              <Section emoji="📝" title="Reason for visit & main complaints" n={4}>
                {data.complaints?.length ? (
                  <>
                    <div className="rpt-keep rounded bg-[#f0fdfa] border border-[#99f6e4] px-3 py-2 mb-2">
                      <p className="text-[9pt] uppercase tracking-wide text-[#0f766e] font-semibold">Primary complaint</p>
                      <p className="text-[13.5pt] font-bold">{data.complaints[0].chiefComplaintLabel}</p>
                      <p className="text-[10pt] text-[#374151]">
                        {data.complaints[0].onsetValue != null ? `For ${data.complaints[0].onsetValue} ${data.complaints[0].onsetUnit || ""}` : "Duration not recorded"}
                        {" · "}{data.complaints[0].severityScore != null ? `Severity ${data.complaints[0].severityScore}/10${sev(data.complaints[0].severityScore) ? ` (${sev(data.complaints[0].severityScore)})` : ""}` : "Severity not recorded"}
                      </p>
                    </div>
                    <table className="w-full text-[10pt] border-collapse">
                      <thead><tr className="text-start text-[9pt] uppercase tracking-wide text-[#6b7280] border-b border-[#d1d5db]">
                        <th className="py-1 pe-2 font-semibold">Complaint</th><th className="py-1 pe-2 font-semibold">Duration</th><th className="py-1 pe-2 font-semibold">Severity</th><th className="py-1 pe-2 font-semibold">Worse with (Muharrikat)</th><th className="py-1 font-semibold">Better with (Musakkinat)</th>
                      </tr></thead>
                      <tbody>
                        {data.complaints.map((c: R, i: number) => (
                          <tr key={i} className="align-top border-b border-[#f3f4f6]">
                            <td className="py-1 pe-2 font-medium">{c.chiefComplaintLabel}{i === 0 && <span className="ms-1 text-[8.5pt] text-[#0f766e]">PRIMARY</span>}{c.clinicalNotes && <div className="text-[9pt] text-[#6b7280] font-normal">{c.clinicalNotes}</div>}</td>
                            <td className="py-1 pe-2">{c.onsetValue != null ? `${c.onsetValue} ${c.onsetUnit || ""}` : <Dim>Not recorded</Dim>}</td>
                            <td className="py-1 pe-2">{c.severityScore != null ? `${c.severityScore}/10${sev(c.severityScore) ? ` · ${sev(c.severityScore)}` : ""}` : <Dim>Not recorded</Dim>}</td>
                            <td className="py-1 pe-2">{c.aggravatingFactors.length ? c.aggravatingFactors.join(", ") : <Dim>None recorded</Dim>}</td>
                            <td className="py-1">{c.relievingFactors.length ? c.relievingFactors.join(", ") : <Dim>None recorded</Dim>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <Empty>Main complaints not yet assessed by the doctor.</Empty>}
                {data.intake && (
                  <Facts className="mt-2" rows={[
                    ["Complaints at registration", data.intake.chiefComplaints.join(", ") || null],
                    ["Started", data.intake.onsetTimeline ? ONSET[data.intake.onsetTimeline] || data.intake.onsetTimeline : null],
                    ["Arrived", data.intake.mobility === "wheelchair" ? "Needs a wheelchair" : data.intake.mobility === "independent" ? "Walking on their own" : null],
                  ]} />
                )}
                {data.intake?.narrative && (
                  <blockquote className="rpt-keep mt-2 border-s-4 border-[#d1d5db] ps-3 text-[10.5pt] italic text-[#374151]">
                    <span className="not-italic text-[9pt] uppercase tracking-wide text-[#6b7280] block">In the patient&apos;s own words</span>
                    “{data.intake.narrative}”
                  </blockquote>
                )}
              </Section>

              {/* ---------------- Warning signs ---------------- */}
              <Section emoji="🚨" title="Emergency warning signs" n={5} meta={ws?.updatedAt ? `Updated ${fmtDateTime(ws.updatedAt)}` : undefined}>
                {!ws ? <Empty tone="warn">Warning-sign assessment not done — absence of warning signs cannot be assumed.</Empty>
                  : !decided ? (
                    <>
                      <Empty tone="warn">Warning-sign assessment incomplete — no decision recorded yet.</Empty>
                      {ws.present.length > 0 && <SignList items={ws.present} />}
                    </>
                  ) : ws.present.length > 0 ? (
                    <>
                      <p className="text-[10.5pt] font-semibold text-[#991b1b]">Warning signs recorded — clinical review required.</p>
                      <SignList items={ws.present} />
                    </>
                  ) : (
                    <p className="text-[10.5pt]">No warning signs marked. {ws.reviewed} of {ws.criteriaCount} listed signs were reviewed on {fmtDateTime(ws.updatedAt)}.</p>
                  )}
                {data.referral && (
                  <div className="rpt-keep mt-2 rounded border border-[#fca5a5] px-3 py-2">
                    <p className="text-[9.5pt] uppercase tracking-wide font-semibold text-[#991b1b]">Referral</p>
                    <Facts rows={[
                      ["Referred to", data.referral.referredTo], ["Urgency", data.referral.urgency], ["Reason", data.referral.reason],
                      ["Notes for receiving doctor", data.referral.notes], ["Referred on", fmtDateTime(data.referral.createdAt)], ["Referred by", data.referral.referredBy?.name],
                    ]} />
                  </div>
                )}
                {data.amaDecline && (
                  <div className="rpt-keep mt-2 rounded border border-[#fcd34d] px-3 py-2">
                    <p className="text-[9.5pt] uppercase tracking-wide font-semibold text-[#92400e]">Referral declined — continuing against medical advice</p>
                    <Facts rows={[["Referral recommended for", data.amaDecline.reason], ["Patient's reason", data.amaDecline.patientReason], ["Recorded", fmtDateTime(data.amaDecline.createdAt)]]} />
                  </div>
                )}
              </Section>

              {/* ---------------- Other symptoms ---------------- */}
              <Section emoji="🔎" title="Other symptoms (Alamat-e-Izafiya)" n={6}>
                {!data.otherSymptoms ? <Empty>Not assessed.</Empty>
                  : data.otherSymptoms.symptoms.length ? <p className="text-[10.5pt]">{data.otherSymptoms.symptoms.join(" · ")}</p>
                    : <p className="text-[10.5pt]">None marked at assessment ({fmtDateTime(data.otherSymptoms.updatedAt)}).</p>}
              </Section>

              {/* ================= PART B — senior doctor ================= */}
              <PartDivider letter="B" emoji="👨‍⚕️" title="Senior doctor's assessment" sub="Stages 3–5 · Mizaj & Morphometry, Asbab-e-Sittah and Tashkhees & Ilaj — recorded by the senior (main) doctor" tone="senior" />

              <Section emoji="🧍" tone="senior" title="Body regions, onset & course" n={7}
                meta={stage3UpdatedAt ? `Updated ${fmtDateTime(stage3UpdatedAt)}` : undefined}>
                <p className="rpt-keep mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#c4b5fd] bg-white px-3 py-1 text-[9.5pt] text-[#5b21b6]">
                  🩺 <b>Recorded by the senior doctor</b>
                  {seniorDoctor && <span>· {seniorDoctor}</span>}
                </p>
                {!data.later.regions?.length && !chron && !mz ? <Empty>Stage 3 not yet recorded for this visit.</Empty> : (
                  <>
                    {data.later.regions?.length > 0 && (
                      <div className="rpt-keep grid grid-cols-[auto_1fr] gap-5 items-start">
                        <div className="flex gap-2 rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <BodyFigure view="front" items={regionItems} width={118} />
                          <BodyFigure view="back" items={regionItems} width={118} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9pt] uppercase tracking-wide text-[#6b7280] font-semibold mb-1.5">Body regions & organ systems involved</p>
                          <ol className="space-y-1.5">
                            {regionItems.map((r: R, i: number) => (
                              <li key={r.label} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 ${r.primary ? "border-[#059669] bg-[#ecfdf5]" : "border-[#e5e7eb] bg-white"}`}>
                                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5pt] font-bold ${r.primary ? "bg-[#059669] text-white" : "border border-[#059669] text-[#059669]"}`}>{i + 1}</span>
                                <span className="min-w-0">
                                  <span className="block text-[10.5pt] font-semibold text-[#111827]">{r.label}{r.primary && <span className="ms-1.5 rounded bg-[#059669] px-1.5 py-px text-[7.5pt] font-bold tracking-wide text-white align-middle">PRIMARY</span>}</span>
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
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">⚡ Onset & rhythm</p>
                        {chron?.onsetPatterns?.length
                          ? <div className="flex flex-wrap gap-1">{chron.onsetPatterns.map((o: string) => <span key={o} className="rounded-full border border-[#c4b5fd] bg-[#f5f3ff] px-2 py-0.5 text-[10pt] text-[#4c1d95]">{o}</span>)}</div>
                          : <Empty>Not recorded.</Empty>}
                      </div>
                      <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">⏳ How long</p>
                        {chron?.durationValue != null ? (
                          <>
                            <p className="text-[12pt] font-bold text-[#111827]">{chron.durationValue} {chron.durationUnit || ""}
                              {course && <span className="ms-2 rounded px-1.5 py-0.5 text-[9pt] font-semibold" style={{ background: `${course.style.dot}22`, color: course.style.dot }}>{course.label} · {course.unani}</span>}
                            </p>
                            <p className="text-[9.5pt] text-[#4b5563]">
                              {chron.onsetDate && <>Started around <b>{fmtDate(chron.onsetDate)}</b></>}
                              {chron.durationSource === "auto" && chron.sourceComplaint && <> · from the longest complaint, {chron.sourceComplaint}</>}
                            </p>
                            {course && <p className="text-[9pt] text-[#6b7280]">{course.range} — {course.hint}</p>}
                          </>
                        ) : <Empty>Not recorded.</Empty>}
                      </div>
                    </div>

                    {(chron?.note || mz) && (
                      <Facts className="rpt-keep mt-3" rows={[
                        ["📝 Chronology note", chron?.note],
                        ["🌡️ Latest Mizaj assessment", mz ? `${mz.result.split(" — ")[0]} · Damawi ${mz.dam}% · Safrawi ${mz.saffra}% · Balghami ${mz.balgham}% · Saudawi ${mz.sauda}% (${fmtDate(mz.createdAt)})` : null],
                        ["💓 Nabz (pulse)", mz?.pulse],
                        ["Mizaj notes", mz?.notes],
                      ]} />
                    )}
                    <p className="mt-2 text-[9pt] text-[#6b7280]">Acute / subacute / chronic is a guide from the recorded duration. The main complaints in section 04 include the senior doctor&apos;s Stage 3 edits.</p>
                  </>
                )}
              </Section>

              {/* ---------------- Stage 4: Asbab-e-Sittah ---------------- */}
              <Section emoji="🌬️" tone="senior" title="Asbab-e-Sittah Zarooriya — lifestyle factors" n={8}
                meta={asbab ? (asbab.status === "completed" ? `Completed ${fmtDateTime(asbab.completedAt)}` : `Draft · updated ${fmtDateTime(asbab.updatedAt)}`) : undefined}>
                <p className="rpt-keep mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#c4b5fd] bg-white px-3 py-1 text-[9.5pt] text-[#5b21b6]">
                  🩺 <b>Recorded by the senior doctor</b>
                  {(asbab?.recordedBy?.name || seniorDoctor) && <span>· {asbab?.recordedBy?.name || seniorDoctor}</span>}
                </p>
                {!asbab || !asbabAnswered ? <Empty>Asbab-e-Sittah review not yet recorded for this visit.</Empty> : (
                  <>
                    {drift && (
                      <div className="rpt-keep mb-3 rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1.5">⚖️ Humoral drift from lifestyle{driftLead && <span className="ms-1 normal-case tracking-normal text-[#111827]">— leaning towards <b>{driftLead}</b></span>}</p>
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
                          ) : <p className="mt-1 text-[9.5pt] italic text-[#6b7280]">Not answered.</p>}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[9pt] text-[#6b7280]">Humoral drift is weighted from each answer&apos;s humoral points set in Admin — a guide for the Hakim, not a diagnosis.</p>
                  </>
                )}
              </Section>

              {/* ---------------- Stage 5: Tashkhees & Ilaj ---------------- */}
              <Section emoji="⚕️" tone="senior" title="Tashkhees & Ilaj — diagnosis, treatment & handover" n={9}
                meta={dos ? (dos.status === "finalized" ? `Finalised ${fmtDateTime(dos.finalizedAt)}` : `Draft · updated ${fmtDateTime(dos.updatedAt)}`) : undefined}>
                <p className="rpt-keep mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#c4b5fd] bg-white px-3 py-1 text-[9.5pt] text-[#5b21b6]">
                  🩺 <b>{dos?.status === "finalized" ? "Finalised by the senior doctor" : "Recorded by the senior doctor"}</b>
                  {(dos?.finalizedByName || dos?.recordedBy?.name || seniorDoctor) && <span>· {dos?.finalizedByName || dos?.recordedBy?.name || seniorDoctor}</span>}
                </p>
                {!dos && !dalail ? <Empty>Tashkhees &amp; Ilaj not yet recorded for this visit.</Empty> : (
                  <div className="space-y-3">
                    {/* Diagnosis */}
                    {dos && (
                      <div className="rpt-keep rounded-lg border-2 border-[#7c3aed] bg-white px-3.5 py-2.5">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">🧾 Tashkhees (diagnosis)</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><p className="text-[9pt] text-[#6b7280]">Mizaj-e-Asli (baseline temperament)</p><p className="text-[12pt] font-bold">{dos.mizajAsli || <Dim>Not recorded</Dim>}</p></div>
                          <div><p className="text-[9pt] text-[#6b7280]">Su-e-Mizaj (present dyscrasia)</p><p className="text-[12pt] font-bold">{[dos.suMizajType, dos.suMizajQuality, dos.suMizajGrade ? `Darja ${dos.suMizajGrade}` : null].filter(Boolean).join(" · ") || <Dim>Not recorded</Dim>}</p></div>
                        </div>
                        {dos.organs?.length > 0 && <p className="mt-1 text-[10pt]"><span className="text-[#6b7280]">Affected organs (Udw-e-Mutathir): </span><b>{dos.organs.join(", ")}</b></p>}
                        {dos.diagnosisNote && <p className="mt-1 text-[10.5pt] italic text-[#374151]">“{dos.diagnosisNote}”</p>}
                      </div>
                    )}

                    {/* Dala'il */}
                    {dalail?.sections?.length > 0 && (
                      <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                        <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">🔍 Dala&apos;il — clinical signs on examination</p>
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
                            <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">📐 Usool-e-Ilaj — principles of treatment</p>
                            <div className="flex flex-wrap gap-1">{dos.usool.map((u: string) => <span key={u} className="rounded-full border border-[#c4b5fd] bg-[#f5f3ff] px-2 py-0.5 text-[10pt] text-[#4c1d95]">{u}</span>)}</div>
                            {dos.usoolNote && <p className="mt-1 text-[10pt] text-[#374151]">{dos.usoolNote}</p>}
                          </div>
                        )}

                        {/* Ilaj-bil-Dawa */}
                        <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">💊 Ilaj-bil-Dawa — medicines prescribed</p>
                          {dos.prescriptions?.length ? (
                            <table className="w-full text-[10pt] border-collapse">
                              <thead><tr className="text-start text-[8.5pt] uppercase tracking-wide text-[#6b7280] border-b border-[#d1d5db]">
                                <th className="py-1 pe-2 font-semibold">#</th><th className="py-1 pe-2 font-semibold">Medicine</th><th className="py-1 pe-2 font-semibold">Form</th><th className="py-1 pe-2 font-semibold">Dose</th><th className="py-1 pe-2 font-semibold">Timing</th><th className="py-1 pe-2 font-semibold">Duration</th><th className="py-1 font-semibold">With</th>
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
                          ) : <Empty>No medicines prescribed.</Empty>}
                        </div>

                        {/* Ghiza + Tadbeer */}
                        <div className="rpt-keep grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                            <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">🍽️ Ilaj-bil-Ghiza — diet</p>
                            <p className="text-[9.5pt]"><span className="font-semibold text-[#047857]">✓ Recommended: </span>{dos.ghizaRecommended?.join(", ") || <Dim>—</Dim>}</p>
                            <p className="text-[9.5pt] mt-0.5"><span className="font-semibold text-[#b91c1c]">✕ Parhez (avoid): </span>{dos.ghizaAvoid?.join(", ") || <Dim>—</Dim>}</p>
                            {dos.ghizaNote && <p className="mt-1 text-[9.5pt] text-[#374151]">{dos.ghizaNote}</p>}
                          </div>
                          <div className="rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                            <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">🫧 Ilaj-bil-Tadbeer — regimens</p>
                            {dos.tadbeer?.length ? dos.tadbeer.map((t: R) => (
                              <p key={t.label} className="text-[9.5pt]"><b>{t.label}</b>{[t.frequency, t.duration, t.notes].filter(Boolean).length ? ` — ${[t.frequency, t.duration, t.notes].filter(Boolean).join(" · ")}` : ""}</p>
                            )) : <p className="text-[9.5pt] text-[#6b7280]">None.</p>}
                          </div>
                        </div>

                        {/* Prognosis & handover */}
                        <div className="rpt-keep rounded-lg border border-[#ddd6fe] bg-white px-3 py-2">
                          <p className="text-[9pt] uppercase tracking-wide text-[#6d28d9] font-semibold mb-1">📅 Prognosis, follow-up &amp; handover</p>
                          <Facts rows={[
                            ["Prognosis (Inzar)", dos.prognosis],
                            ["Priority", dos.priority ? dos.priority.charAt(0).toUpperCase() + dos.priority.slice(1) : null],
                            ["Follow-up", dos.followUpDate || dos.followUpNote ? [dos.followUpDate ? fmtDate(dos.followUpDate) : null, dos.followUpNote].filter(Boolean).join(" — ") : null],
                          ]} />
                          {dos.urgentDirectives && <p className="mt-1.5 rounded border border-[#fca5a5] bg-[#fef2f2] px-2 py-1 text-[10pt] text-[#991b1b]"><b>🚨 Urgent — return immediately if:</b> {dos.urgentDirectives}</p>}
                          {dos.handoverNote && <p className="mt-1.5 text-[10pt] text-[#374151] whitespace-pre-wrap"><span className="font-semibold text-[#111827]">Handover note: </span>{dos.handoverNote}</p>}
                        </div>
                      </>
                    )}
                    <p className="text-[9pt] text-[#6b7280]">Doses and regimens are the treating Hakim&apos;s own entries, reproduced unchanged.</p>
                  </div>
                )}
              </Section>

              {/* ================= PART C ================= */}
              <PartDivider letter="C" emoji="📚" title="History, notes & decision support" sub="Allergies, medicines, background, clinical notes and Hakeem Insight" />

              {/* ---------------- Allergies & medicines ---------------- */}
              <div className="grid grid-cols-2 gap-4">
                <Section emoji="⚠️" title="Allergies & sensitivities" n={10}>
                  {allergies.length ? (
                    <ul className="text-[10.5pt] space-y-0.5">{allergies.map((a) => <li key={a}>• <b>{a}</b> <span className="text-[9pt] text-[#6b7280]">— patient-reported; reaction & severity not recorded</span></li>)}</ul>
                  ) : data.intake ? <Empty>No allergies were reported at registration. This is not a confirmed absence of allergies.</Empty>
                    : <Empty>Allergy information not recorded.</Empty>}
                </Section>
                <Section emoji="💊" title="Current medicines & herbs" n={11}>
                  {data.intake?.medications?.length || p.currentMedications ? (
                    <>
                      {data.intake?.medications?.length > 0 && (
                        <ul className="text-[10.5pt] space-y-0.5">{data.intake.medications.map((m: R) => <li key={`${m.kind}${m.label}`}>• <b>{m.label}</b> <span className="text-[9pt] text-[#6b7280]">— {m.kind === "medication" ? "allopathic medication" : "supplement / herb"}, reported by patient</span></li>)}</ul>
                      )}
                      {p.currentMedications && <p className="text-[10pt] mt-1"><Dim>Profile note:</Dim> {p.currentMedications}</p>}
                      <p className="mt-1 text-[9pt] text-[#6b7280]">Dose, frequency and start date were not recorded.</p>
                    </>
                  ) : data.intake ? <Empty>None reported at registration.</Empty> : <Empty>Medication information not recorded.</Empty>}
                </Section>
              </div>

              {/* ---------------- Background ---------------- */}
              <Section emoji="📋" title="Medical background" n={12}>
                {[p.chronicConditions, p.medicalHistory, p.surgicalHistory, p.familyHistory, p.lifestyle, p.occupation].some(Boolean) ? (
                  <Facts rows={[
                    ["Chronic conditions", p.chronicConditions], ["Medical history", p.medicalHistory], ["Surgical history", p.surgicalHistory],
                    ["Family history", p.familyHistory], ["Lifestyle", p.lifestyle], ["Occupation", p.occupation],
                  ]} />
                ) : <Empty>No medical, surgical or family history recorded. This does not mean there is none.</Empty>}
              </Section>

              {/* ---------------- Doctor notes ---------------- */}
              <Section emoji="🗒️" title="Doctor's observations & clinical notes" n={13} meta={data.residentNotes?.updatedAt ? `Updated ${fmtDateTime(data.residentNotes.updatedAt)}` : undefined}>
                {data.residentNotes?.points?.length ? (
                  <ul className="text-[10.5pt] space-y-0.5 list-disc ps-5">{data.residentNotes.points.map((pt: string, i: number) => <li key={i}>{pt}</li>)}</ul>
                ) : <Empty>No clinical notes recorded.</Empty>}
                <p className="mt-1 text-[9pt] text-[#6b7280]">Recorded by the clinical team, reproduced unchanged.</p>
              </Section>

              {/* ---------------- Unani context ---------------- */}
              <Section emoji="🌿" title="Unani assessment context" n={14}>
                <Facts rows={[
                  ["Recorded Mizaj (profile)", p.mizaj],
                  ["Humoral balance (computed)", data.humoral ? `Damawi ${Math.round(data.humoral.damPercent)}% · Safrawi ${Math.round(data.humoral.safraPercent)}% · Balghami ${Math.round(data.humoral.balghamPercent)}% · Saudawi ${Math.round(data.humoral.saudaPercent)}%` : null],
                  ["Dominant humour", data.humoral ? `${data.humoral.dominantOverride ?? data.humoral.dominant}${data.humoral.dominantOverride ? ` (doctor's pick; computed: ${data.humoral.dominant})` : " (computed from recorded complaints)"}` : null],
                  ["Asbab-e-Sittah review", data.later.asbab ? (data.later.asbab.status === "completed" ? `Completed ${fmtDate(data.later.asbab.completedAt)}` : "In progress") : null],
                  ["Tashkhees (diagnosis)", data.later.dossier?.mizajAsli || data.later.dossier?.suMizajQuality ? [data.later.dossier.mizajAsli && `Mizaj-e-Asli: ${data.later.dossier.mizajAsli}`, data.later.dossier.suMizajQuality && `Su-e-Mizaj: ${[data.later.dossier.suMizajType, data.later.dossier.suMizajQuality, data.later.dossier.suMizajGrade ? `Darja ${data.later.dossier.suMizajGrade}` : null].filter(Boolean).join(" ")}`].filter(Boolean).join(" · ") + (data.later.dossier.status === "finalized" ? ` — finalised by ${data.later.dossier.finalizedByName || "doctor"}` : " — draft") : null],
                  ["Diagnosis note", data.later.dossier?.diagnosisNote],
                ]} empty="No Unani-specific findings recorded yet for this visit." />
              </Section>

              {/* ---------------- Hakeem Insight ---------------- */}
              <Section emoji="✨" title="Hakeem Insight — automated decision support" n={15}>
                <p className="mb-2 rounded bg-[#f3f4f6] px-2 py-1 text-[9pt] text-[#4b5563]">Generated automatically from this visit&apos;s recorded data. Not verified by a doctor; not a diagnosis or prescription.</p>
                {!l1 && !data.routing && !data.humoral?.aiClue && !data.vitalsInsight ? <Empty>No Hakeem Insight was generated for this visit.</Empty> : (
                  <div className="space-y-2">
                    {data.routing && (
                      <Insight title="Triage priority" when={data.routing.updatedAt || data.routing.generatedAt}>
                        <p><b>{data.routing.priorityLevel}</b> · Next step: {data.routing.triageStream}</p>
                        <p className="text-[#4b5563]">{data.routing.justification}</p>
                      </Insight>
                    )}
                    {data.humoral?.aiClue && (
                      <Insight title={`Humoral reading — why ${data.humoral.dominantOverride ?? data.humoral.dominant}`} when={data.humoral.aiClueGeneratedAt}>
                        <p>{data.humoral.aiClue}</p>
                      </Insight>
                    )}
                    {l1 && (
                      <Insight title="L1 screening note" when={data.l1Screening?.updatedAt}>
                        <p className="font-medium">{l1.headline}</p>
                        {l1.findings?.length > 0 && <ul className="list-disc ps-5">{l1.findings.map((f, i) => <li key={i}>{f.severity === "red" ? "▲ " : ""}{f.text}</li>)}</ul>}
                        {l1.priority && <p><Dim>Check first:</Dim> {l1.priority}</p>}
                        {l1.unani && <p><Dim>Unani note:</Dim> {l1.unani}</p>}
                      </Insight>
                    )}
                    {data.vitalsInsight && (
                      <Insight title="Vitals trend" when={data.vitalsInsight.updatedAt || data.vitalsInsight.generatedAt}>
                        <p>{data.vitalsInsight.insight}</p>
                      </Insight>
                    )}
                  </div>
                )}
              </Section>

              {/* ---------------- Reports ---------------- */}
              <Section emoji="📁" title="Patient reports on file" n={16}>
                {data.reports?.length ? (
                  <table className="w-full text-[10pt] border-collapse">
                    <thead><tr className="text-start text-[9pt] uppercase tracking-wide text-[#6b7280] border-b border-[#d1d5db]">
                      <th className="py-1 pe-2 font-semibold">Report</th><th className="py-1 pe-2 font-semibold">Date</th><th className="py-1 pe-2 font-semibold">Result</th><th className="py-1 font-semibold">Review</th>
                    </tr></thead>
                    <tbody>{data.reports.map((r: R, i: number) => (
                      <tr key={i} className="align-top border-b border-[#f3f4f6]">
                        <td className="py-1 pe-2"><b>{r.title}</b>{r.source && <span className="text-[#6b7280]"> · {r.source}</span>}{r.findings && <div className="text-[9pt] text-[#4b5563]">{r.findings}</div>}</td>
                        <td className="py-1 pe-2">{fmtDate(r.reportDate || r.createdAt)}</td>
                        <td className={`py-1 pe-2 ${r.resultFlag === "critical" || r.resultFlag === "abnormal" ? "font-semibold text-[#b91c1c]" : ""}`}>{r.resultFlag === "unknown" ? "Not stated" : r.resultFlag}</td>
                        <td className="py-1">{r.status === "reviewed" ? `Reviewed${r.reviewedByName ? ` by ${r.reviewedByName}` : ""}` : "Awaiting doctor review"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <Empty>No reports uploaded for this patient.</Empty>}
                <p className="mt-1 text-[9pt] text-[#6b7280]">Report files are kept in the patient&apos;s record and are not reproduced here.</p>
              </Section>

              {/* ---------------- Authorization ---------------- */}
              <section className="rpt-keep mt-5 grid grid-cols-2 gap-6 border-t-2 border-[#0f766e] pt-4">
                <div>
                  <p className="text-[9pt] uppercase tracking-wide text-[#6b7280] font-semibold">Treating doctor</p>
                  <div className="mt-8 border-b border-[#9ca3af]" />
                  <p className="mt-1 text-[10.5pt] font-semibold">{doctor?.name || "Doctor not assigned"}</p>
                  <p className="text-[9.5pt] text-[#4b5563]">{[doctor?.designation, doctor?.qualification].filter(Boolean).join(" · ") || " "}</p>
                  {doctor?.registrationNumber && <p className="text-[9.5pt] text-[#4b5563]">Reg. no. {doctor.registrationNumber}</p>}
                  <p className="mt-1 text-[9.5pt] font-semibold text-[#92400e]">Signature pending — no digital signature on record.</p>
                </div>
                <div className="text-[9.5pt] text-[#4b5563]">
                  <p className="text-[9pt] uppercase tracking-wide text-[#6b7280] font-semibold">Report details</p>
                  <p className="mt-1">Report ID: <span className="font-mono text-[#111827]">{data.report.id}</span></p>
                  <p>Generated {fmtDateTime(data.report.generatedAt)}{data.report.generatedBy ? ` by ${data.report.generatedBy}` : ""}.</p>
                  <p>Built from the live record at that moment; a later edit to the assessment produces a different report.</p>
                  <p className="mt-2">Prepared on the {b.portal_name} platform. Platform branding does not indicate clinical approval of the contents.</p>
                </div>
              </section>

              {/* ---------------- Footer ---------------- */}
              <footer className="rpt-keep mt-5 border-t border-[#d1d5db] pt-2 text-[9pt] text-[#6b7280] space-y-1">
                <p><b className="text-[#374151]">Confidential.</b> {b.confidentiality}</p>
                <p>{b.insight_disclaimer}</p>
                <p className="flex justify-between gap-3 flex-wrap">
                  <span>© {year} {b.copyright_owner}. All rights reserved.</span>
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
          <ArrowLeft className="h-4 w-4" /> Return to assessment
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Assessment report · {p.name}</p>
          <p className="text-xs text-muted-foreground">{data.report.id} · generated {fmtDateTime(data.report.generatedAt)} · shows saved data only — Save Draft on the assessment, then refresh, to include new edits</p>
        </div>
        <span className={`ms-auto rounded-full border px-2.5 py-1 text-xs font-semibold ${complete || data.referral ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" : "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"}`}>
          {complete || data.referral ? statusLabel : "Draft — incomplete"}
        </span>
        <Button variant="outline" size="sm" onClick={() => window.print()} title="Choose “Save as PDF” as the printer">
          <Download className="h-4 w-4" /> Save as PDF
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
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
  const senior = tone === "senior";
  return (
    <div className={`rpt-keep mt-8 flex items-center gap-3 rounded-lg px-3.5 py-2.5 ${senior ? "bg-[#5b21b6] text-white" : "bg-[#0f766e] text-white"}`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-[15pt]" aria-hidden>{emoji}</span>
      <div className="min-w-0">
        <p className="text-[8.5pt] font-semibold uppercase tracking-[0.18em] opacity-80">Part {letter}</p>
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
  return (
    <ul className="mt-1 text-[10.5pt] space-y-0.5">
      {items.map((s) => <li key={s.label} className="font-semibold text-[#991b1b]">▲ {s.label}{s.custom && <span className="font-normal text-[9pt] text-[#6b7280]"> — added by staff</span>}</li>)}
    </ul>
  );
}

function Insight({ title, when, children }: { title: string; when?: string | null; children: ReactNode }) {
  return (
    <div className="rpt-keep rounded border border-[#c7d2fe] px-3 py-1.5 text-[10.5pt]">
      <p className="flex justify-between gap-2 text-[9pt] uppercase tracking-wide font-semibold text-[#4338ca]">
        <span>✦ {title}</span>
        <span className="font-normal normal-case tracking-normal text-[#6b7280]">Hakeem Insight · {when ? fmtDateTime(when) : "time not recorded"}</span>
      </p>
      <div className="mt-0.5 space-y-0.5">{children}</div>
    </div>
  );
}
