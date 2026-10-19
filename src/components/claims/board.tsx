"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Siren, TriangleAlert } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { STAGES, formatSpan, healthOf, slaFor, stageDef, type Claim } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { HealthBadge, SlaChip, useClock } from "./sla";

const title = (c: Claim) => c.claimNo || c.ref;

/** One claim on the board. Breached ones get a red ring and, for the Stage 6 lapse, a RED ALERT tag. */
export function ClaimCard({ claim }: { claim: Claim }) {
  const { byId } = useBranchTools();
  const now = useClock();
  const health = healthOf(claim, now);
  const top = slaFor(claim, now)?.topManagement && health === "breach";
  return (
    <motion.li layout variants={fadeUp} transition={spring}>
      <Link
        href={`/claims/${claim.id}`}
        className={cn(
          "block rounded-xl border bg-surface p-3 shadow-card outline-none transition-colors hover:border-strong focus-visible:ring-2 focus-visible:ring-blue-500/50",
          health === "breach" ? "border-danger/50 bg-danger-tint ring-1 ring-danger/30" : health === "warn" ? "border-warn/40" : "border-line",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-faint">{title(claim)}</span>
          <span className="shrink-0 text-[11px] text-muted">{byId(claim.branchId)?.short ?? claim.branchId}</span>
        </div>
        <p className="mt-1 truncate text-[13.5px] font-semibold text-fg">{claim.customerName}</p>
        <p className="truncate text-[12px] text-muted">
          {claim.model} · <span className="font-mono">{claim.regNo}</span>
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <SlaChip claim={claim} />
          {top && <span className="inline-flex items-center gap-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"><Siren className="h-3 w-3" /> RED ALERT</span>}
        </div>
      </Link>
    </motion.li>
  );
}

/** The ten SOP stages as columns. */
export function KanbanBoard({ claims }: { claims: Claim[] }) {
  const now = useClock();
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex min-w-max gap-3">
        {STAGES.map((st) => {
          const col = claims.filter((c) => c.stage === st.no && !c.closedAt);
          const delivered = st.no === 10 ? claims.filter((c) => c.closedAt) : [];
          const breached = col.filter((c) => healthOf(c, now) === "breach").length;
          return (
            <section key={st.no} aria-label={`Stage ${st.no}: ${st.name}`} className="w-[268px] shrink-0 rounded-xl border border-line bg-hover/60 p-2.5">
              <header className="mb-2.5 flex items-start gap-2 px-1">
                <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg">{st.no}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[12.5px] font-semibold leading-4 text-fg">{st.name}</h3>
                  {st.sla && <p className="mt-0.5 text-[11px] leading-4 text-faint">{st.sla}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {breached > 0 && <Badge tone="danger">{breached}</Badge>}
                  <span className="rounded-full bg-fg/[0.07] px-1.5 text-[11px] tabular-nums text-muted">{col.length + delivered.length}</span>
                </span>
              </header>
              <motion.ul variants={stagger(0.03)} initial="hidden" animate="show" className="flex min-h-[72px] flex-col gap-2">
                {[...col, ...delivered].map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
                {!col.length && !delivered.length && <li className="grid h-[72px] place-items-center rounded-lg border border-dashed border-line text-[11.5px] text-faint">No claims</li>}
              </motion.ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Same claims as a list, one row each. */
export function ClaimList({ claims }: { claims: Claim[] }) {
  const { byId } = useBranchTools();
  const now = useClock();
  return (
    <motion.ul variants={stagger(0.03)} initial="hidden" animate="show" className="flex flex-col gap-2">
      {claims.map((c) => {
        const health = healthOf(c, now);
        const st = stageDef(c.stage);
        return (
          <motion.li key={c.id} layout variants={fadeUp} transition={spring}>
            <Link
              href={`/claims/${c.id}`}
              className={cn(
                "grid items-center gap-x-4 gap-y-2 rounded-xl border bg-surface px-4 py-3 shadow-card outline-none transition-colors hover:border-strong focus-visible:ring-2 focus-visible:ring-blue-500/50 lg:grid-cols-[1.1fr_1.2fr_1.4fr_1.2fr_auto]",
                health === "breach" ? "border-danger/50 bg-danger-tint" : health === "warn" ? "border-warn/40" : "border-line",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-fg">{c.claimNo || c.ref}</p>
                <p className="truncate font-mono text-[11.5px] text-faint">{c.claimNo ? c.ref : "Claim no. pending"} · {c.jobCardNo}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-fg">{c.customerName}</p>
                <p className="truncate text-[12px] text-muted">{c.model} · <span className="font-mono">{c.regNo}</span></p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] text-fg">Stage {c.stage}/10 · {st.short}</p>
                <p className="truncate text-[12px] text-muted">{byId(c.branchId)?.short ?? c.branchId}</p>
              </div>
              <div className="flex flex-col items-start gap-1">
                <HealthBadge health={health} />
                <SlaChip claim={c} />
              </div>
              <ArrowRight className="hidden h-4 w-4 text-faint lg:block" />
            </Link>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

/** "Active Red Alerts / SLA Breaches": shown whenever any claim has run past a timer. */
export function RedAlertBanner({ claims, active, onToggle }: { claims: Claim[]; active: boolean; onToggle: () => void }) {
  const now = useClock();
  const rows = claims
    .map((c) => ({ c, sla: slaFor(c, now) }))
    .filter((r) => r.sla?.health === "breach")
    .sort((a, z) => Number(z.sla!.topManagement) - Number(a.sla!.topManagement) || a.sla!.remainingMs - z.sla!.remainingMs);
  if (!rows.length) return null;
  const tops = rows.filter((r) => r.sla!.topManagement).length;
  return (
    <div role="alert" className="mb-5 overflow-hidden rounded-xl border border-danger/50 bg-danger-tint shadow-card">
      <div className="flex flex-wrap items-center gap-3 bg-danger px-4 py-2.5 text-white">
        <Siren className="h-4 w-4 animate-pulse" />
        <p className="flex-1 text-[13px] font-bold tracking-wide">
          ACTIVE RED ALERTS / SLA BREACHES · {rows.length} claim{rows.length === 1 ? "" : "s"}
          {tops > 0 && ` · ${tops} for Top Management`}
        </p>
        <Button size="sm" variant="secondary" onClick={onToggle} className="border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white">
          {active ? "Show all claims" : "Show only breaches"}
        </Button>
      </div>
      <ul className="divide-y divide-danger/15">
        {rows.slice(0, 5).map(({ c, sla }) => (
          <li key={c.id}>
            <Link href={`/claims/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[12.5px] outline-none hover:bg-danger/10 focus-visible:bg-danger/10">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-danger" />
              <span className="font-mono text-fg">{c.claimNo || c.ref}</span>
              <span className="text-fg">{c.customerName}</span>
              <span className="text-muted">Stage {c.stage} · {sla!.label}</span>
              <span className="font-medium tabular-nums text-danger">Overdue {formatSpan(sla!.remainingMs)}</span>
              {sla!.topManagement && <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">TOP MANAGEMENT RED ALERT</span>}
            </Link>
          </li>
        ))}
        {rows.length > 5 && <li className="px-4 py-2 text-[12px] text-muted">+ {rows.length - 5} more — use “Show only breaches”.</li>}
      </ul>
    </div>
  );
}
