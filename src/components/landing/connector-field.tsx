"use client";

import type { CSSProperties } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

/** Deterministic per-node drift so nodes wander independently without a random-seed hydration mismatch. */
function driftStyle(i: number): CSSProperties {
  const dx = ((i * 37) % 11) - 5;
  const dy = ((i * 53) % 9) - 4;
  const dur = 3 + (i % 5) * 0.7;
  const delay = (i % 6) * 0.4;
  return {
    ["--dx" as string]: `${dx}px`,
    ["--dy" as string]: `${dy}px`,
    ["--dur" as string]: `${dur}s`,
    ["--delay" as string]: `${delay}s`,
  } as CSSProperties;
}

/**
 * Ambient animated network texture for the hero/welcome section —
 * echoes the brand's connector-globe logo with drifting, pulsing nodes
 * across two parallax depth layers, plus a cursor-follow spotlight.
 */

// Near layer — bigger, brighter, closer to the viewer.
const nearNodes: [number, number][] = [
  [20, 30], [90, 15], [170, 35], [250, 18], [330, 32], [380, 50],
  [55, 75], [135, 60], [215, 80], [295, 65], [365, 85],
  [25, 130], [105, 145], [185, 125], [265, 148], [345, 130],
  [60, 190], [140, 205], [220, 185], [300, 208],
  [110, 28], [245, 100], [175, 175], [40, 160],
];

const nearEdges: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [0, 6], [1, 6], [1, 7], [2, 7], [2, 8], [3, 8], [3, 9], [4, 9], [4, 10], [5, 10],
  [6, 7], [7, 8], [8, 9], [9, 10],
  [6, 11], [7, 11], [7, 12], [8, 12], [8, 13], [9, 13], [9, 14], [10, 14], [10, 15],
  [11, 12], [12, 13], [13, 14], [14, 15],
  [11, 16], [12, 16], [12, 17], [13, 17], [13, 18], [14, 18], [14, 19], [15, 19],
  [16, 17], [17, 18], [18, 19],
  [1, 20], [20, 2], [20, 7], [9, 21], [21, 14], [21, 13],
  [17, 22], [18, 22], [22, 14], [11, 23], [16, 23],
];

// Far layer — smaller, dimmer, drifts less; adds depth behind the near layer.
const farNodes: [number, number][] = [
  [10, 10], [70, 25], [130, 8], [190, 22], [250, 6], [310, 20], [370, 10],
  [40, 110], [100, 95], [160, 115], [220, 98], [280, 118], [340, 100],
  [25, 220], [140, 232], [260, 222], [370, 235],
];

const farEdges: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 7], [3, 9], [6, 12], [13, 7], [10, 15],
];

function NetworkLayer({
  nodes,
  edges,
  dotOpacity,
  lineOpacity,
  minR,
  maxR,
}: {
  nodes: [number, number][];
  edges: [number, number][];
  dotOpacity: number;
  lineOpacity: number;
  minR: number;
  maxR: number;
}) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 240"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="var(--primary)" strokeWidth="0.6" opacity={lineOpacity}>
        {edges.map(([a, b], i) => {
          const [x1, y1] = nodes[a];
          const [x2, y2] = nodes[b];
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="connector-line"
              style={{ animationDelay: `${(i % 7) * 0.35}s` }}
            />
          );
        })}
      </g>
      <g opacity={dotOpacity}>
        {nodes.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i % 3 === 0 ? maxR : minR}
            fill={i % 2 === 0 ? "var(--primary)" : "var(--accent)"}
            className="connector-dot"
            style={driftStyle(i)}
          />
        ))}
      </g>
    </svg>
  );
}

export function ConnectorField({
  className,
  mx,
  my,
}: {
  className?: string;
  /** Pointer position within the hero, 0–1 across width/height. */
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const farX = useTransform(mx, [0, 1], [-8, 8]);
  const farY = useTransform(my, [0, 1], [-5, 5]);
  const nearX = useTransform(mx, [0, 1], [-22, 22]);
  const nearY = useTransform(my, [0, 1], [-14, 14]);
  const spotlight = useTransform([mx, my], (latest) => {
    const [x, y] = latest as number[];
    return `radial-gradient(320px circle at ${x * 100}% ${y * 100}%, color-mix(in oklch, var(--primary) 30%, transparent) 0%, transparent 70%)`;
  });

  return (
    <div className={cn("pointer-events-none", className)}>
      <motion.div style={{ x: farX, y: farY }} className="absolute inset-0 h-full w-full">
        <NetworkLayer nodes={farNodes} edges={farEdges} dotOpacity={0.45} lineOpacity={0.4} minR={1.2} maxR={1.8} />
      </motion.div>
      <motion.div style={{ x: nearX, y: nearY }} className="absolute inset-0 h-full w-full">
        <NetworkLayer nodes={nearNodes} edges={nearEdges} dotOpacity={1} lineOpacity={0.65} minR={2} maxR={3} />
      </motion.div>
      <motion.div className="absolute inset-0 h-full w-full" style={{ background: spotlight }} />
    </div>
  );
}
