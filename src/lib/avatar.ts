// Avatar color mapping → Tailwind gradient classes for consistent avatars.
export const AVATAR_GRADIENTS: Record<string, string> = {
  teal: "from-teal-400 to-emerald-600",
  amber: "from-amber-400 to-orange-600",
  emerald: "from-emerald-400 to-green-700",
  rose: "from-rose-400 to-pink-600",
  violet: "from-violet-400 to-purple-700",
  cyan: "from-cyan-400 to-sky-600",
};

export function avatarGradient(color?: string | null) {
  return AVATAR_GRADIENTS[color || "teal"] || AVATAR_GRADIENTS.teal;
}

export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Mizaj → color for badges
export const MIZAJ_COLORS: Record<string, string> = {
  Damwi: "text-red-300 bg-red-500/15 border-red-500/30",
  Safrawi: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  Balghami: "text-sky-300 bg-sky-500/15 border-sky-500/30",
  Saudawi: "text-violet-300 bg-violet-500/15 border-violet-500/30",
  Balanced: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  Unknown: "text-zinc-300 bg-zinc-500/15 border-zinc-500/30",
};

export function mizajBadge(mizaj?: string | null) {
  if (!mizaj) return MIZAJ_COLORS.Unknown;
  const key = Object.keys(MIZAJ_COLORS).find((k) =>
    mizaj.toLowerCase().startsWith(k.toLowerCase())
  );
  return MIZAJ_COLORS[key || "Unknown"];
}
