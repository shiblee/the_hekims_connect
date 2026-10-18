"use client";

import { useSyncExternalStore } from "react";

// Vitals are always stored in °F, cm and kg (the warning ranges are set in those units).
// These helpers let the clinic enter and read them in whichever unit they use;
// the choice is remembered per browser and shared by entry and display.

export const TEMP_UNITS = ["°F", "°C"] as const;
export const HEIGHT_UNITS = ["cm", "m", "ft + in", "in", "ft"] as const;
export const WEIGHT_UNITS = ["kg", "g", "lb", "oz", "st"] as const;
export type TempUnit = (typeof TEMP_UNITS)[number];
export type HeightUnit = (typeof HEIGHT_UNITS)[number];
export type WeightUnit = (typeof WEIGHT_UNITS)[number];
export interface VitalUnits { temp: TempUnit; height: HeightUnit; weight: WeightUnit }
const DEFAULT_UNITS: VitalUnits = { temp: "°F", height: "cm", weight: "kg" };

const trim = (n: number, dp: number) => String(Number(n.toFixed(dp)));

// ---- temperature (stored °F) ----
export const fToTemp = (f: number, u: TempUnit) => (u === "°C" ? ((f - 32) * 5) / 9 : f);
export const tempToF = (v: number, u: TempUnit) => (u === "°C" ? (v * 9) / 5 + 32 : v);
export const formatTemp = (f: number, u: TempUnit) => trim(fToTemp(f, u), 1);

// ---- height (stored cm) ----
const CM_PER: Record<Exclude<HeightUnit, "ft + in">, number> = { cm: 1, m: 100, in: 2.54, ft: 30.48 };
const HEIGHT_DP: Record<Exclude<HeightUnit, "ft + in">, number> = { cm: 1, m: 2, in: 1, ft: 2 };
export function formatHeight(cm: number, u: HeightUnit): string {
  if (u === "ft + in") {
    let ft = Math.floor(cm / 30.48);
    let inch = Math.round((cm - ft * 30.48) / 2.54);
    if (inch === 12) { ft += 1; inch = 0; }
    return `${ft} ft ${inch} in`;
  }
  return `${trim(cm / CM_PER[u], HEIGHT_DP[u])} ${u}`;
}
/** The number to show in an entry field for this unit ("5 7" for feet + inches). */
export function heightInput(cm: number, u: HeightUnit): string {
  if (u === "ft + in") return formatHeight(cm, u).replace(" ft ", " ").replace(" in", "");
  return trim(cm / CM_PER[u], HEIGHT_DP[u]);
}
/** Parses an entry in this unit to cm; for feet + inches accepts "5 7", "5'7", "5 ft 7 in" or just "5". */
export function parseHeight(raw: string, u: HeightUnit): number | "invalid" {
  if (u === "ft + in") {
    const parts = raw.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
    if (!parts.length || parts.length > 2) return "invalid";
    const [ft, inch = 0] = parts;
    if (parts.length === 1 && !Number.isInteger(ft)) return "invalid"; // "5.7" is ambiguous
    if (inch >= 12) return "invalid";
    return ft * 30.48 + inch * 2.54;
  }
  const n = Number(raw);
  return raw.trim() === "" || Number.isNaN(n) ? "invalid" : n * CM_PER[u];
}
/** A plain number for charts / averages in this unit (feet + inches charts in inches). */
export const cmToHeightNumber = (cm: number, u: HeightUnit) => (u === "ft + in" ? cm / 2.54 : cm / CM_PER[u]);

// ---- weight (stored kg) ----
const KG_PER: Record<WeightUnit, number> = { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318 };
const WEIGHT_DP: Record<WeightUnit, number> = { kg: 1, g: 0, lb: 1, oz: 0, st: 2 };
export const kgToWeight = (kg: number, u: WeightUnit) => kg / KG_PER[u];
export const weightToKg = (v: number, u: WeightUnit) => v * KG_PER[u];
export const formatWeight = (kg: number, u: WeightUnit) => `${trim(kgToWeight(kg, u), WEIGHT_DP[u])} ${u}`;
export const weightInput = (kg: number, u: WeightUnit) => trim(kgToWeight(kg, u), WEIGHT_DP[u]);

// ---- remembered choice ----
const KEY = "hekim-vital-units";
const listeners = new Set<() => void>();
let cache: VitalUnits | null = null;
function read(): VitalUnits {
  if (cache) return cache;
  let saved: Partial<VitalUnits> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { saved = {}; }
  cache = {
    temp: TEMP_UNITS.includes(saved.temp as TempUnit) ? (saved.temp as TempUnit) : DEFAULT_UNITS.temp,
    height: HEIGHT_UNITS.includes(saved.height as HeightUnit) ? (saved.height as HeightUnit) : DEFAULT_UNITS.height,
    weight: WEIGHT_UNITS.includes(saved.weight as WeightUnit) ? (saved.weight as WeightUnit) : DEFAULT_UNITS.weight,
  };
  return cache;
}
export function setVitalUnit<K extends keyof VitalUnits>(k: K, v: VitalUnits[K]) {
  cache = { ...read(), [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode — kept for this page only */ }
  listeners.forEach((l) => l());
}
export function useVitalUnits(): VitalUnits {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => DEFAULT_UNITS,
  );
}
