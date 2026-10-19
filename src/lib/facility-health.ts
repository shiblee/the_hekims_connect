// Engagement score for a clinic (0–100), shared by the admin Facilities list and
// the facility detail page so both always agree. Recent use weighs most, then
// visit volume, then setup quality.

export type HealthBand = "thriving" | "steady" | "at_risk" | "dormant";

export interface HealthInput {
  active: boolean;
  verified: boolean;
  profileCompleted: boolean;
  daysSinceActivity: number | null;
  visits30: number;
  revenue30: number;
  staffActive: number;
}

export interface HealthReason { key: string; text: string; good: boolean; points: number; max: number }

export function scoreFacility(i: HealthInput): { score: number; health: HealthBand; reasons: HealthReason[] } {
  const d = i.daysSinceActivity;
  const recency = d === null ? 0 : d <= 3 ? 30 : d <= 7 ? 24 : d <= 14 ? 15 : d <= 30 ? 8 : 0;
  const volume = Math.min(30, Math.round((i.visits30 / 20) * 30));
  const reasons: HealthReason[] = [
    { key: "recency", text: d === null ? "Never used yet" : d === 0 ? "Active today" : `Last active ${d} day${d === 1 ? "" : "s"} ago`, good: d !== null && d <= 7, points: recency, max: 30 },
    { key: "volume", text: `${i.visits30} visit${i.visits30 === 1 ? "" : "s"} in 30 days`, good: i.visits30 >= 5, points: volume, max: 30 },
    { key: "profile", text: i.profileCompleted ? "Profile complete" : "Profile not completed", good: i.profileCompleted, points: i.profileCompleted ? 15 : 0, max: 15 },
    { key: "verified", text: i.verified ? "Verified" : "Not verified", good: i.verified, points: i.verified ? 10 : 0, max: 10 },
    { key: "payments", text: i.revenue30 > 0 ? "Recording payments" : "No payments recorded in 30 days", good: i.revenue30 > 0, points: i.revenue30 > 0 ? 10 : 0, max: 10 },
    { key: "staff", text: i.staffActive ? `${i.staffActive} active staff` : "No staff added", good: i.staffActive > 0, points: i.staffActive > 0 ? 5 : 0, max: 5 },
  ];
  let score = reasons.reduce((s, r) => s + r.points, 0);
  if (!i.active) score = Math.min(score, 10);
  const health: HealthBand = score >= 75 ? "thriving" : score >= 50 ? "steady" : score >= 25 ? "at_risk" : "dormant";
  return { score, health, reasons };
}
