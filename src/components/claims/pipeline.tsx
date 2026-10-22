"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Siren } from "lucide-react";
import { STAGES, type StageNo } from "@/lib/claims";
import { cn } from "@/lib/utils";
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

/** The emergency filter, kept apart from the numbered SOP line: overdue count, one click to the Code Red view. */
function CodeRedHub() {
  const { breachCount, topManagement } = useClaimStats();
  const hot = breachCount > 0;
  return (
    <Link
      href="/claims/code-red"
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-xl border p-3 outline-none transition-colors focus-visible:shadow-ring lg:w-60",
        hot ? "border-danger bg-danger text-white hover:opacity-90" : "border-line bg-surface shadow-card hover:border-strong",
      )}
    >
      <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full", hot ? "bg-white/20" : "bg-hover text-muted")}>
        {hot && <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />}
        <Siren className={cn("relative h-5 w-5", hot && "animate-pulse")} />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums leading-none">{breachCount}</span>
          <span className="text-[12px] font-semibold">Code Red</span>
        </span>
        <span className={cn("mt-1 block text-[11px] leading-4", hot ? "text-white/90" : "text-muted")}>
          {hot ? "Requires Immediate Action" : "All clear, no SLA breaches"}
          {topManagement > 0 && <span className="block">{topManagement} sent to Top Management</span>}
        </span>
      </span>
    </Link>
  );
}

/** The 10 SOP stages as a scrollable rail. Each step shows how many vehicles are there and how many are overdue. */
function StageRail({ active }: { active?: StageNo }) {
  const stats = useClaimStats();
  const list = useRef<HTMLOListElement>(null);
  // The rail scrolls on narrow screens; keep the selected stage in view.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (list.current && el) list.current.scrollTo({ left: Math.max(0, el.offsetLeft - list.current.clientWidth / 2 + el.clientWidth / 2) });
  }, [active]);
  return (
    <ol ref={list} className="flex min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-surface p-1.5 shadow-card" aria-label="Claim stages">
      {STAGES.map((st) => {
        const selected = st.no === active;
        const breaches = stats.breachPerStage[st.no];
        return (
          <li key={st.no} data-step={st.no} className="relative min-w-[124px] flex-1">
            {/* Connector to the next step, drawn behind the badge row */}
            {st.no < STAGES.length && <span aria-hidden className="absolute left-[44px] right-0 top-[23px] h-px bg-line" />}
            <Link
              href={`/claims/stage/${st.no}`}
              title={st.name}
              aria-current={selected ? "step" : undefined}
              className={cn(
                "relative flex flex-col gap-1.5 rounded-lg border p-2.5 outline-none transition-[background-color,border-color,box-shadow] focus-visible:shadow-ring",
                selected ? "border-accent bg-tint shadow-ring" : "border-transparent hover:bg-hover",
              )}
            >
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold", selected ? "bg-accent text-accent-fg" : "bg-surface text-fg ring-1 ring-inset ring-strong")}>{st.no}</span>
              <span className={cn("text-[12px] font-medium leading-4", selected ? "text-accent-text" : "text-fg")}>{st.short}</span>
              <span className="flex flex-wrap items-center gap-1">
                <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums", selected ? "bg-accent text-accent-fg" : "bg-fg/[0.07] text-fg")}>{stats.perStage[st.no]}</span>
                {breaches > 0 && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-danger-tint px-1.5 text-[11px] font-semibold tabular-nums text-danger">
                    <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                    {breaches} overdue
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** The whole pipeline at a glance: the Code Red hub beside the sequential stage rail. */
export function PipelineOverview({ active }: { active?: StageNo }) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <CodeRedHub />
      <StageRail active={active} />
    </div>
  );
}
