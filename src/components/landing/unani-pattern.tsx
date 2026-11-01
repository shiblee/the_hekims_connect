import { cn } from "@/lib/utils";

/** Eight-point star (khatam) — the two-squares motif of classical Tibb manuscripts. */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 16; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * k - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const TILE = 72;
const C = TILE / 2;
const STAR = starPoints(C, C, 20, 15.3);

/**
 * Quiet, static hero backdrop: a faint lattice of eight-point stars that fades
 * out towards the edges, so the headline stays the focus.
 */
export function UnaniPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      style={{
        maskImage: "radial-gradient(ellipse 70% 75% at 50% 45%, black 0%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 75% at 50% 45%, black 0%, transparent 75%)",
      }}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="unani-khatam" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <g fill="none" stroke="var(--primary)" strokeWidth="0.8">
              <polygon points={STAR} />
              <circle cx={C} cy={C} r="5" />
              <path d={`M${C} 0V${C - 20}M${C} ${TILE}V${C + 20}M0 ${C}H${C - 20}M${TILE} ${C}H${C + 20}`} />
            </g>
            <g fill="var(--accent)">
              <circle cx="0" cy="0" r="1.4" />
              <circle cx={TILE} cy="0" r="1.4" />
              <circle cx="0" cy={TILE} r="1.4" />
              <circle cx={TILE} cy={TILE} r="1.4" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#unani-khatam)" />
      </svg>
    </div>
  );
}
