// Where a visit stands in the clinical journey — shared by the patient list, the reception
// desk and the dashboard. STAGE_SELECT is the Prisma select it needs.

export type VisitStage = "waiting" | "vitals" | "mizaj" | "asbab" | "handover" | "done" | "referred";

export const STAGE_SELECT = {
  status: true,
  vitalSigns: { select: { id: true } },
  redFlagScreening: { select: { outcome: true } },
  referral: { select: { id: true } },
  asbabAssessments: { where: { framework: "asbab" }, select: { status: true } },
  tashkheesDossier: { select: { status: true } },
} as const;

/**
 * Where the patient's latest visit is in the clinical journey — drives the
 * stage tag and the "Continue" shortcut on the patient list.
 */
export function visitStage(v: {
  status: string;
  vitalSigns: { id: string } | null;
  redFlagScreening: { outcome: string | null } | null;
  referral: { id: string } | null;
  asbabAssessments: { status: string }[];
  tashkheesDossier: { status: string } | null;
}): VisitStage {
  if (v.referral) return "referred";
  if (v.tashkheesDossier?.status === "finalized") return "done";
  const asbab = v.asbabAssessments[0];
  if (v.tashkheesDossier || asbab?.status === "completed") return "handover";
  if (asbab) return "asbab";
  if (v.redFlagScreening?.outcome === "cleared" || v.redFlagScreening?.outcome === "continued_ama") return "mizaj";
  if (v.vitalSigns) return "vitals";
  return v.status === "waiting" ? "waiting" : "vitals";
}
