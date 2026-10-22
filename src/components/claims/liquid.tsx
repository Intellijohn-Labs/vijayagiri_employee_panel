"use client";

import { useEffect, useState } from "react";
import { slaFor, type Claim, type Health } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { useBeatSync } from "./beat";
import { useClock } from "./sla";

/** Liquid body, wave and surface-highlight colours per status. Written out in full so Tailwind sees every class. */
const LOOK: Record<Exclude<Health, "done">, { body: string; wave: string; line: string }> = {
  ok: { body: "bg-[rgba(59,130,246,0.2)]", wave: "text-[rgba(59,130,246,0.2)]", line: "stroke-[rgba(34,211,238,0.9)]" },
  warn: { body: "bg-[rgba(245,158,11,0.25)]", wave: "text-[rgba(245,158,11,0.25)]", line: "stroke-[rgba(253,224,71,0.9)]" },
  breach: { body: "bg-[rgba(239,68,68,0.28)]", wave: "text-[rgba(239,68,68,0.28)]", line: "stroke-[rgba(254,202,202,0.95)]" },
};

// Two periods across a 200-wide box, so sliding the layer half its width (one period) loops without a seam.
const FRONT = "M0 6Q25 -2 50 6T100 6T150 6T200 6";
const BACK = "M0 6Q25 13 50 6T100 6T150 6T200 6";
const BUBBLES = [
  { left: "14%", size: 5, rise: 150, dur: 3.1, delay: 0 },
  { left: "42%", size: 4, rise: 120, dur: 2.6, delay: 0.9 },
  { left: "63%", size: 6, rise: 170, dur: 3.4, delay: 0.4 },
  { left: "86%", size: 4, rise: 130, dur: 2.8, delay: 1.6 },
];

/**
 * Liquid sloshing behind a claim card's content, its level rising as the SLA time runs out: blue on track, amber once
 * the warning buffer starts, agitated crimson and full when overdue. Colour follows the card's status badge, so a changed
 * warning buffer in the SLA settings moves both together. Delivered claims have no timer and no fill.
 *
 * Two SVG wave layers slide in opposite directions at different speeds over a translucent body, with a thin bright line
 * along the front surface. Only transforms and opacity animate (the level eases with one height transition), and the
 * layer ticks on its own so the card around it doesn't re-render every second.
 */
export function LiquidFill({ claim }: { claim: Claim }) {
  const now = useClock();
  const sla = slaFor(claim, now);
  const [risen, setRisen] = useState(false);
  const hot = sla?.health === "breach";
  useBeatSync(hot);
  // Start empty and let the level rise into place on first paint.
  useEffect(() => {
    const id = requestAnimationFrame(() => setRisen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!sla) return null;

  const percentage = Math.min(100, Math.max(0, ((now - sla.startedAt) / sla.totalMs) * 100));
  const level = hot ? 100 : percentage;
  const look = LOOK[sla.health];
  const shown = risen && level >= 1.5;

  return (
    <div data-liquid aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] [contain:layout_paint]">
      {/* The top 12px is left clear so the waves still show when the level is full. */}
      <div className="absolute inset-x-0 bottom-0 top-3">
        <div className={cn("absolute inset-x-0 bottom-0", look.body, hot && "liquid-hot")} style={{ height: `${risen ? level : 0}%`, transition: "height 1s ease-in-out", willChange: "height" }}>
          <div className={cn("liquid-waves absolute inset-x-0 bottom-full h-3 transition-opacity duration-700", look.wave, shown ? "opacity-100" : "opacity-0")}>
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative wave inside an aria-hidden layer */}
            <svg className="wave-back absolute bottom-0 left-0 h-3 w-[200%] max-w-none opacity-60" viewBox="0 0 200 12" preserveAspectRatio="none">
              <path d={`${BACK}V12H0Z`} fill="currentColor" />
            </svg>
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative wave inside an aria-hidden layer */}
            <svg className="wave-front absolute bottom-0 left-0 h-3 w-[200%] max-w-none" viewBox="0 0 200 12" preserveAspectRatio="none">
              <path d={`${FRONT}V12H0Z`} fill="currentColor" />
              <path d={FRONT} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className={look.line} />
            </svg>
          </div>
          {hot &&
            BUBBLES.map((b) => (
              <span key={b.left} className="liquid-bubble absolute bottom-0 rounded-full bg-white/40" style={{ left: b.left, width: b.size, height: b.size, ["--rise" as string]: `-${b.rise}px`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
            ))}
        </div>
      </div>
    </div>
  );
}
