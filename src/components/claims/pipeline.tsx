"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Siren, Volume2, VolumeX } from "lucide-react";
import { STAGES, type StageNo } from "@/lib/claims";
import { sfx } from "@/lib/sound";
import { springFirm } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useAlertSound } from "@/store/alert-sound-store";
import { useClaimStats } from "./stats";

/** Summary pills under the page title: what is running, what is on schedule and what has lapsed its SLA. */
export function StatsBar() {
  const { open, onTrack, breachCount } = useClaimStats();
  const pill = (label: string, value: number, tone: string) => (
    <li className={cn("inline-flex h-7 items-center gap-2 rounded-full border px-3 text-[12px]", tone)}>
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums text-fg">{value}</span>
    </li>
  );
  return (
    <ul className="mb-4 flex flex-wrap gap-2" aria-label="Claims summary">
      {pill("Total Active Claims", open, "border-line bg-surface")}
      {pill("On Track", onTrack, "border-ok/30 bg-ok-tint")}
      {pill("SLA Breaches", breachCount, breachCount ? "border-danger/40 bg-danger-tint [&>span:last-child]:text-danger" : "border-line bg-surface")}
    </ul>
  );
}

/** The emergency filter, kept apart from the numbered SOP line: a radar-style card with the overdue count, one click to the Code Red view. */
function CodeRedHub() {
  const { breachCount, topManagement } = useClaimStats();
  const { enabled, hydrate, set } = useAlertSound();
  const hot = breachCount > 0;
  const seen = useRef(breachCount);

  useEffect(hydrate, [hydrate]);
  // Chirp when a new breach appears. Browsers only allow audio after a tap or key press, so stay quiet until then.
  useEffect(() => {
    if (enabled && breachCount > seen.current && navigator.userActivation?.hasBeenActive) sfx.alert();
    seen.current = breachCount;
  }, [breachCount, enabled]);

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }} transition={springFirm} className={cn("relative shrink-0 rounded-xl lg:w-60", hot && "beacon-glow")}>
      <Link
        href="/claims/code-red"
        onClick={() => enabled && hot && sfx.alert()}
        className={cn(
          "flex h-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border p-3 pr-9 outline-none transition-colors focus-visible:shadow-ring",
          hot ? "border-danger bg-danger text-white" : "border-line bg-surface shadow-card hover:border-strong",
        )}
      >
        <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full", hot ? "bg-white/20" : "bg-hover text-muted")}>
          {hot && (
            <>
              <span aria-hidden className="radar-ring absolute inset-0 rounded-full border-2 border-white/70" />
              <span aria-hidden className="radar-ring-late absolute inset-0 rounded-full border-2 border-white/70" />
            </>
          )}
          <Siren className={cn("relative h-5 w-5", hot && "animate-pulse")} />
        </span>
        <span className="min-w-0">
          <span className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums leading-none">{breachCount}</span>
            <span className="text-[13px] font-semibold">Code Red</span>
          </span>
          <span className={cn("mt-1 block text-[11px] leading-4", hot ? "font-semibold uppercase tracking-wide text-white" : "text-muted")}>{hot ? "Requires Immediate Action" : "All clear, no SLA breaches"}</span>
          {topManagement > 0 && <span className="block text-[11px] leading-4 text-white/85">{topManagement} sent to Top Management</span>}
        </span>
      </Link>
      <button
        type="button"
        aria-pressed={enabled}
        aria-label={enabled ? "Mute Code Red alert sound" : "Unmute Code Red alert sound"}
        title={enabled ? "Alert sound on" : "Alert sound off"}
        onClick={() => {
          set(!enabled);
          if (!enabled) sfx.alert();
        }}
        className={cn("absolute right-1.5 top-1.5 grid h-6 w-6 cursor-pointer place-items-center rounded-md outline-none transition-colors focus-visible:shadow-ring", hot ? "text-white/80 hover:bg-white/20 hover:text-white" : "text-muted hover:bg-hover hover:text-fg")}
      >
        {enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>
    </motion.div>
  );
}

/** Lifecycle names for the bar, a little fuller than `STAGE.short`. */
const CYCLE_LABEL: Record<StageNo, string> = { 1: "Intake", 2: "Job Card", 3: "Estimation", 4: "Inspection", 5: "Spare Parts", 6: "Transit", 7: "Repair & Paint", 8: "Final QA & Bill", 9: "Settlement", 10: "Delivery" };

/**
 * The 10-stage SOP lifecycle as a scrollable bar. Stages before the open one are ticked and joined by a solid line,
 * the open one is highlighted, and each node carries its vehicle count with a pulsing dot when any are overdue.
 */
function StageRail({ active }: { active?: StageNo }) {
  const stats = useClaimStats();
  const list = useRef<HTMLOListElement>(null);
  // The bar scrolls on narrow screens; keep the selected stage in view.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (list.current && el) list.current.scrollTo({ left: Math.max(0, el.offsetLeft - list.current.clientWidth / 2 + el.clientWidth / 2), behavior: "smooth" });
  }, [active]);
  return (
    <ol ref={list} className="flex min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-surface px-1 py-1.5 shadow-card [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Claim lifecycle stages">
      {STAGES.map((st) => {
        const selected = st.no === active;
        const done = active !== undefined && st.no < active;
        const breaches = stats.breachPerStage[st.no];
        return (
          <li key={st.no} data-step={st.no} className="relative min-w-[92px] flex-1">
            {/* Connectors to the neighbours: solid once the flow has passed them */}
            {st.no > 1 && <span aria-hidden className={cn("absolute left-0 right-1/2 top-[21px] h-0.5", active !== undefined && st.no <= active ? "bg-accent" : "bg-line")} />}
            {st.no < STAGES.length && <span aria-hidden className={cn("absolute left-1/2 right-0 top-[21px] h-0.5", done ? "bg-accent" : "bg-line")} />}
            <Link
              href={`/claims/stage/${st.no}`}
              title={st.name}
              aria-current={selected ? "step" : undefined}
              className="group relative flex flex-col items-center gap-1 px-1 pb-1 pt-1.5 outline-none"
            >
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold transition-shadow group-focus-visible:shadow-ring",
                  selected ? "bg-accent text-accent-fg shadow-ring ring-4 ring-accent/25" : done ? "border border-accent bg-tint text-accent-text" : "bg-surface text-muted ring-1 ring-inset ring-strong group-hover:text-fg group-hover:ring-accent",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : st.no}
              </span>
              <span className={cn("whitespace-nowrap text-[12px] leading-4", selected ? "font-bold text-accent-text" : "font-medium text-fg")}>{CYCLE_LABEL[st.no]}</span>
              <span
                className={cn("inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-1.5 text-[11px] font-semibold tabular-nums", selected ? "bg-accent text-accent-fg" : "bg-fg/[0.07] text-fg")}
                title={breaches > 0 ? `${breaches} overdue` : undefined}
              >
                {breaches > 0 && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-danger" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-danger" />
                  </span>
                )}
                {stats.perStage[st.no]}
                {breaches > 0 && <span className="sr-only">, {breaches} overdue</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** The whole pipeline at a glance: the Code Red hub beside the sequential lifecycle bar. */
export function PipelineOverview({ active }: { active?: StageNo }) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <CodeRedHub />
      <StageRail active={active} />
    </div>
  );
}
