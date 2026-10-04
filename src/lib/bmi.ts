export function calculateBmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

// WHO standard adult BMI bands.
export function bmiBand(bmi: number | null): { label: string; tint: string; bg: string } | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return { label: "Underweight", tint: "text-amber-600 dark:text-amber-400", bg: "bg-amber-400/15" };
  if (bmi < 25) return { label: "Normal", tint: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" };
  if (bmi < 30) return { label: "Overweight", tint: "text-amber-600 dark:text-amber-400", bg: "bg-amber-400/15" };
  return { label: "Obese", tint: "text-destructive", bg: "bg-destructive/15" };
}
