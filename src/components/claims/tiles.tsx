"use client";

import Link from "next/link";
import { Siren } from "lucide-react";
import { STAGES } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { useClaimStats } from "./stats";

/** The whole pipeline at a glance: one tile per stage, Code Red first. Replaces the old horizontal board. */
export function StageTiles() {
  const stats = useClaimStats();
  return (
    <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <li>
        <Link
          href="/claims/code-red"
          className={cn("flex h-full flex-col justify-between gap-2 rounded-xl border p-3 outline-none transition-colors focus-visible:shadow-ring", stats.breachCount ? "border-danger bg-danger text-white hover:opacity-90" : "border-line bg-surface hover:border-strong")}
        >
          <span className="flex items-center gap-1.5 text-[12px] font-semibold">
            <Siren className={cn("h-3.5 w-3.5", stats.breachCount > 0 && "animate-pulse")} /> Code Red
          </span>
          <span className="text-2xl font-semibold tabular-nums leading-none">{stats.breachCount}</span>
          <span className={cn("text-[11px]", stats.breachCount ? "text-white/85" : "text-muted")}>{stats.topManagement ? `${stats.topManagement} for Top Management` : stats.breachCount ? "SLA breaches" : "No SLA breaches"}</span>
        </Link>
      </li>
      {STAGES.map((st) => {
        const breaches = stats.breachPerStage[st.no];
        return (
          <li key={st.no}>
            <Link href={`/claims/stage/${st.no}`} className="flex h-full flex-col justify-between gap-2 rounded-xl border border-line bg-surface p-3 shadow-card outline-none transition-colors hover:border-strong focus-visible:shadow-ring">
              <span className="flex items-start gap-2">
                <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg">{st.no}</span>
                <span className="text-[12px] font-medium leading-4 text-fg">{st.name}</span>
              </span>
              <span className="flex items-end justify-between">
                <span className="text-2xl font-semibold tabular-nums leading-none text-fg">{stats.perStage[st.no]}</span>
                {breaches > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold tabular-nums text-white">{breaches} overdue</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
