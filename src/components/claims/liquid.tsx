"use client";

import { useEffect, useState } from "react";
import { slaFor, type Claim, type Health } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { useBeatSync } from "./beat";
import { useClock } from "./sla";

/** Fill and crest colours per status. Written out in full so Tailwind sees every class. */
const FILL: Record<Exclude<Health, "done">, { body: string; crest: string }> = {
  ok: { body: "bg-gradient-to-t from-blue-500/15 to-blue-400/5", crest: "text-blue-500/20" },
  warn: { body: "bg-gradient-to-t from-amber-500/20 to-amber-400/5", crest: "text-amber-500/25" },
  breach: { body: "bg-gradient-to-t from-red-600/25 to-red-500/10", crest: "text-red-600/30" },
};

/**
 * A liquid level behind a claim card's content that rises as its SLA time runs out: blue while on track, amber once
 * the warning buffer starts, red and full when overdue. The colour follows the card's status badge, so a changed
 * warning buffer in the SLA settings moves both together. Delivered claims have no timer and no fill.
 * It ticks on its own so the card around it doesn't re-render every second.
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

  const elapsed = now - sla.startedAt;
  const percentage = Math.min(100, Math.max(0, (elapsed / sla.totalMs) * 100));
  const level = hot ? 100 : percentage;
  const look = FILL[sla.health];

  return (
    <div data-liquid aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] [contain:layout_paint]">
      <div className={cn("absolute inset-x-0 bottom-0", look.body)} style={{ height: `${risen ? level : 0}%`, transition: "height 1s ease-in-out", willChange: "height, transform" }}>
        <div className={cn("liquid-crest absolute left-0 h-2.5 bg-current", hot ? "liquid-crest-hot top-0" : "-top-2", look.crest)} />
      </div>
    </div>
  );
}
