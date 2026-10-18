import { Footprints, Infinity as InfinityIcon, Moon, Repeat, Snowflake, Sunrise, TrendingUp, Utensils, Waves, Zap, type LucideIcon } from "lucide-react";

// An icon per onset pattern, matched on the admin-configured label.
export function patternIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (/sudden|paroxys|abrupt|acute/.test(l)) return Zap;
  if (/insidious|gradual|slow|creep/.test(l)) return TrendingUp;
  if (/season|winter|summer|cold|weather/.test(l)) return Snowflake;
  if (/prandial|meal|food|\beat/.test(l)) return Utensils;
  if (/nocturn|night|layl/.test(l)) return Moon;
  if (/morning|dawn|waking/.test(l)) return Sunrise;
  if (/exert|activity|walk|effort/.test(l)) return Footprints;
  if (/episod|intermit|recur|periodic|cycl/.test(l)) return Repeat;
  if (/constant|continu|persist/.test(l)) return InfinityIcon;
  return Waves;
}
