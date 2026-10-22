"use client";

import { useSyncExternalStore } from "react";
import { AlertOctagon, CheckCircle2, Clock, Siren } from "lucide-react";
import { HEALTH_LABEL, formatSpan, healthOf, isEscalated, slaFor, type Claim, type Health, type SlaState } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { useSlaConfig } from "@/store/sla-config-store";

/* One shared 1-second clock for every countdown on screen. */
let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};
// Saving new SLA thresholds re-evaluates every status on screen at once instead of on the next tick.
useSlaConfig.subscribe(() => {
  current = Date.now();
  for (const l of listeners) l();
});
/** Milliseconds since epoch, refreshed every second while anything is subscribed. */
export const useClock = () => useSyncExternalStore(subscribe, () => current, () => current);

export const TEXT: Record<Health, string> = { ok: "text-ok", warn: "text-warn", breach: "text-danger", done: "text-accent-text" };
export const BAR: Record<Health, string> = { ok: "bg-ok", warn: "bg-warn", breach: "bg-danger", done: "bg-accent" };

const PILL: Record<Health, string> = {
  ok: "bg-ok-tint text-ok ring-ok/25",
  warn: "bg-warn-tint text-warn ring-warn/25",
  breach: "bg-danger-tint text-danger ring-danger/30",
  done: "bg-tint text-accent-text ring-accent/20",
};

/** A status dot that pings: fast for Overdue, slower for Approaching, a slow heartbeat for On Track. Compositor-only, off for reduced motion. */
export function PulseDot({ health }: { health: Health }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      {health !== "done" && <span className={cn("absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden", health === "breach" ? "[animation-duration:1s]" : health === "warn" ? "[animation-duration:1.6s]" : "[animation-duration:2.4s]")} />}
      <span className="relative h-2 w-2 rounded-full bg-current" />
    </span>
  );
}

/** Green / Amber / Red status pill with a pulsing dot. Delivered claims read "Delivered" unless `full`. */
export function HealthBadge({ health, full, className }: { health: Health; full?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ring-1 ring-inset", PILL[health], className)}>
      <PulseDot health={health} />
      {health === "done" && !full ? "Delivered" : HEALTH_LABEL[health]}
    </span>
  );
}

/**
 * A claim's standing as a plain string, so a component only re-renders when it actually changes
 * (On Track to Approaching to Overdue) instead of on every tick of the clock.
 */
export function useClaimHealth(claim: Claim): Health {
  return useSyncExternalStore(
    subscribe,
    () => healthOf(claim, current),
    () => healthOf(claim, current),
  );
}

/** Whether the claim has been escalated to Top Management by its stage's rule. Like `useClaimHealth`, it only re-renders when that flips. */
export function useClaimEscalated(claim: Claim): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isEscalated(slaFor(claim, current)),
    () => isEscalated(slaFor(claim, current)),
  );
}

/** The live SLA state of a claim: re-evaluated every second. */
export function useSla(claim: Claim): SlaState | null {
  const now = useClock();
  return slaFor(claim, now);
}

/** Compact countdown for cards and rows: "● 04h 12m 05s left" / "● Overdue 02h 10m 00s". */
export function SlaChip({ claim }: { claim: Claim }) {
  const sla = useSla(claim);
  if (claim.closedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-text">
        <CheckCircle2 className="h-3 w-3" /> Delivered
      </span>
    );
  }
  if (!sla) return <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> No timer · On Track</span>;
  const breached = sla.health === "breach";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-medium tabular-nums", TEXT[sla.health])} title={sla.label}>
      <span className={cn("h-1.5 w-1.5 rounded-full", BAR[sla.health], breached && "animate-pulse")} />
      {breached ? `Overdue ${formatSpan(sla.remainingMs)}` : `${formatSpan(sla.remainingMs)} left`}
    </span>
  );
}

/** The big timer on the claim page. */
export function SlaHero({ claim }: { claim: Claim }) {
  const sla = useSla(claim);
  if (claim.closedAt) {
    return (
      <div className="rounded-xl border border-accent/20 bg-tint p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-accent-text"><CheckCircle2 className="h-4 w-4" /> Delivered to Customer</p>
        <p className="mt-1 text-[12.5px] text-muted">The claim is closed. No timers are running.</p>
      </div>
    );
  }
  if (!sla) {
    return (
      <div className="rounded-xl border border-ok/25 bg-ok-tint p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ok"><Clock className="h-4 w-4" /> On Track</p>
        <p className="mt-1 text-[12.5px] text-muted">No SLA timer is running for this claim.</p>
      </div>
    );
  }
  const used = Math.min(100, Math.max(0, ((sla.totalMs - sla.remainingMs) / sla.totalMs) * 100));
  const breached = sla.health === "breach";
  return (
    <div className={cn("rounded-xl border p-4", sla.health === "ok" && "border-ok/25 bg-ok-tint", sla.health === "warn" && "border-warn/30 bg-warn-tint", breached && "border-danger/40 bg-danger-tint")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{sla.label}</p>
          <p className={cn("mt-1 font-mono text-[28px] font-semibold leading-none tabular-nums", TEXT[sla.health])} role="timer" aria-live="off">
            {breached ? "−" : ""}
            {formatSpan(sla.remainingMs)}
          </p>
          <p className={cn("mt-1.5 text-[12.5px] font-medium", TEXT[sla.health])}>{breached ? "SLA breached — overdue" : sla.health === "warn" ? "Approaching deadline" : "On track"}</p>
        </div>
        {breached ? <AlertOctagon className="h-5 w-5 shrink-0 animate-pulse text-danger" /> : <Clock className={cn("h-5 w-5 shrink-0", TEXT[sla.health])} />}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div className={cn("h-full rounded-full transition-[width] duration-1000", BAR[sla.health])} style={{ width: `${breached ? 100 : used}%` }} />
      </div>
      <p className="mt-2 text-[11.5px] text-muted">Due {new Date(sla.dueAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
    </div>
  );
}

/** Red block shown when a stage's rule has escalated the claim to Top Management. */
export function TopManagementAlert({ className, label }: { className?: string; label?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-xl border border-danger/50 bg-danger px-4 py-3 text-white shadow-card", className)}>
      <Siren className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
      <div>
        <p className="text-sm font-bold tracking-wide">TOP MANAGEMENT RED ALERT</p>
        <p className="mt-0.5 text-[12.5px] text-white/90">The SLA for {label ? `“${label}”` : "this stage"} has lapsed. Top Management has been notified (simulated) and this claim needs immediate action.</p>
      </div>
    </div>
  );
}
