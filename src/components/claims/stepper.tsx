"use client";

import { useEffect, useRef } from "react";
import { Check, Lock } from "lucide-react";
import { STAGES, fmtDateTime, healthOf, type Claim, type StageNo } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { BAR, useClock } from "./sla";

/** The 10 SOP stages in order: done, current (coloured by SLA health) and still to come. Done and current ones can be opened. */
export function Stepper({ claim, viewing, onView }: { claim: Claim; viewing: StageNo; onView: (s: StageNo) => void }) {
  const now = useClock();
  const health = healthOf(claim, now);
  const list = useRef<HTMLOListElement>(null);
  // On narrow screens the strip scrolls; keep the stage in progress in view.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[aria-current=step]") ?? (list.current?.lastElementChild as HTMLElement | null | undefined);
    if (list.current && el) list.current.scrollTo({ left: Math.max(0, el.offsetLeft - list.current.clientWidth / 2 + el.clientWidth / 2) });
  }, [claim.stage, claim.closedAt]);
  return (
    <ol ref={list} className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-0 sm:px-0" aria-label="Claim stages">
      {STAGES.map((st) => {
        const done = st.no < claim.stage || (st.no === 10 && !!claim.closedAt);
        const current = st.no === claim.stage && !claim.closedAt;
        const upcoming = !done && !current;
        const log = claim.stageLog[st.no];
        return (
          <li key={st.no} className="min-w-[104px] flex-1">
            <button
              type="button"
              disabled={upcoming}
              onClick={() => onView(st.no)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex h-full w-full flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50",
                viewing === st.no ? "border-accent bg-tint" : "border-line bg-surface",
                !upcoming && "hover:border-strong",
                upcoming && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold text-white", done ? "bg-ok" : current ? BAR[health] : "bg-fg/20")}>
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : st.no}
                </span>
                {upcoming && <Lock className="h-3 w-3 text-faint" />}
                {current && health === "breach" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />}
              </span>
              <span className="text-[12px] font-medium leading-4 text-fg">{st.short}</span>
              <span className={cn("text-[11px] leading-3.5", log?.breached ? "text-warn" : "text-faint")}>{done ? (log ? `${fmtDateTime(log.completedAt)}${log.breached ? " · late" : ""}` : "Done") : current ? "In progress" : "Not started"}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
