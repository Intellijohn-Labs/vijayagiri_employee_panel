"use client";

import { useMemo } from "react";
import { useVisibleClaims } from "@/store/claims-store";
import { useClaimFilters } from "@/store/claims-filter-store";
import { healthOf, isEscalated, slaFor, type Claim, type Health, type StageNo } from "@/lib/claims";
import { useClock } from "./sla";

/** Counts the sidebar and tiles show, all live. Claims the employee can't see are never counted. */
export function useClaimStats() {
  const claims = useVisibleClaims();
  const now = useClock();
  return useMemo(() => {
    const open = claims.filter((c) => !c.closedAt);
    const perStage = Array.from({ length: 11 }, () => 0);
    const breachPerStage = Array.from({ length: 11 }, () => 0);
    const breached: Claim[] = [];
    let onTrack = 0;
    for (const c of open) {
      perStage[c.stage]++;
      const h = healthOf(c, now);
      if (h === "breach") {
        breachPerStage[c.stage]++;
        breached.push(c);
      } else if (h === "ok") onTrack++;
    }
    const topManagement = breached.filter((c) => isEscalated(slaFor(c, now))).length;
    return { total: claims.length, open: open.length, onTrack, perStage, breachPerStage, breached, breachCount: breached.length, topManagement };
  }, [claims, now]);
}

/** Filter claims by the shared search text and showroom. */
export function matchesFilters(c: Claim, q: string, showroom: string): boolean {
  if (showroom !== "all" && c.branchId !== showroom) return false;
  const t = q.trim().toLowerCase();
  return !t || `${c.ref} ${c.claimNo} ${c.jobCardNo} ${c.customerName} ${c.phone} ${c.regNo} ${c.model} ${c.insurer}`.toLowerCase().includes(t);
}

export type StatusFilter = "all" | Health;

/**
 * The claims for a page after the shared search and showroom filters, split by status.
 * With a `stage` it shows only that stage's open claims (plus delivered ones when asked for);
 * without one it covers every claim.
 */
export function useClaimList(status: StatusFilter, stage?: StageNo) {
  const claims = useVisibleClaims();
  const { q, showroom } = useClaimFilters();
  const now = useClock();
  return useMemo(() => {
    const scoped = claims.filter((c) => (stage === undefined || c.stage === stage) && matchesFilters(c, q, showroom));
    const health = new Map(scoped.map((c) => [c.id, healthOf(c, now)]));
    const count = (h: Health) => scoped.filter((c) => health.get(c.id) === h).length;
    const open = scoped.filter((c) => health.get(c.id) !== "done");
    // On a stage page, "All" means what is still in that stage; delivered claims have their own tab.
    const base = status === "done" ? scoped.filter((c) => health.get(c.id) === "done") : status === "all" ? (stage === undefined ? scoped : open) : scoped.filter((c) => health.get(c.id) === status);
    const order: Record<Health, number> = { breach: 0, warn: 1, ok: 2, done: 3 };
    const shown = [...base].sort((a, z) => order[health.get(a.id) ?? "ok"] - order[health.get(z.id) ?? "ok"] || (slaFor(a, now)?.remainingMs ?? Infinity) - (slaFor(z, now)?.remainingMs ?? Infinity));
    return { shown, counts: { all: stage === undefined ? scoped.length : open.length, ok: count("ok"), warn: count("warn"), breach: count("breach"), done: count("done") } };
  }, [claims, q, showroom, status, stage, now]);
}
