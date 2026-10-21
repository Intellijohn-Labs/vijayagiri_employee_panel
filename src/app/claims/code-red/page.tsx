"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, MessageSquarePlus, Phone, Siren, TriangleAlert } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { useClaims, useVisibleClaims } from "@/store/claims-store";
import { useClaimFilters } from "@/store/claims-filter-store";
import { toast } from "@/store/toast-store";
import { branchLabel } from "@/lib/branches";
import { fmtDateTime, formatSpan, slaFor, stageDef, type Claim, type SlaState } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { FilterBar, useRemarkDrawer } from "@/components/claims/cards";
import { useClock } from "@/components/claims/sla";
import { matchesFilters, useClaimStats } from "@/components/claims/stats";
import { Fact, secondaryLinkClass } from "@/components/claims/ui";
import { ClaimsActions } from "@/components/claims/workspace";

type Row = { claim: Claim; sla: SlaState };

const digits = (p: string) => p.replace(/\D/g, "");

function AlertCard({ row, onRemark }: { row: Row; onRemark: (c: Claim) => void }) {
  const { byId } = useBranchTools();
  const escalate = useClaims((s) => s.escalate);
  const { claim: c, sla } = row;
  const branch = byId(c.branchId);
  const st = stageDef(c.stage);
  const escalated = c.escalations.includes(`${sla.key}:manual`);

  return (
    <motion.li layout variants={fadeUp} transition={spring}>
      <article className={cn("overflow-hidden rounded-xl border shadow-card", sla.topManagement ? "border-danger bg-danger-tint ring-2 ring-danger/40" : "border-danger/40 bg-surface")}>
        <div className="flex flex-wrap items-center gap-2 border-b border-danger/20 bg-danger px-4 py-2 text-white">
          <Siren className="h-4 w-4 animate-pulse" />
          <span className="text-[12px] font-bold tracking-wide">{sla.topManagement ? "TOP MANAGEMENT RED ALERT" : "OVERDUE"}</span>
          <span className="text-[12px] text-white/85">
            Stage {c.stage} · {st.name}
          </span>
          <span className="ml-auto font-mono text-[12px]">{c.claimNo || c.ref}</span>
        </div>

        <div className="grid gap-x-6 gap-y-4 p-4 lg:grid-cols-[minmax(0,260px)_1fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{sla.label} overdue by</p>
            <p className="mt-1 font-mono text-[32px] font-semibold leading-none tabular-nums text-danger" role="timer" aria-live="off">
              {formatSpan(sla.remainingMs)}
            </p>
            <p className="mt-2 text-[12px] text-muted">Was due {fmtDateTime(sla.dueAt)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Fact label="Branch">
              {branch ? branchLabel(branch) : c.branchId}
              {branch?.manager && <span className="block text-[12px] text-muted">{branch.manager}</span>}
            </Fact>
            <Fact label="Customer">
              {c.customerName}
              <span className="block text-[12px] text-muted">{c.phone}</span>
            </Fact>
            <Fact label="Vehicle">
              {c.model}
              <span className="block font-mono text-[12px] text-muted">{c.regNo}</span>
            </Fact>
            <Fact label="Insurer">{c.insurer}</Fact>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <Link href={`/claims/${c.id}`} className="inline-flex h-8 items-center gap-2 rounded-md bg-danger px-3 text-[13px] font-medium text-white outline-none hover:opacity-90 focus-visible:shadow-ring">
            Open claim <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <a href={`tel:+${digits(c.phone).length === 10 ? "91" : ""}${digits(c.phone)}`} className={secondaryLinkClass}>
            <Phone className="h-3.5 w-3.5" /> Call customer
          </a>
          {branch?.dial ? (
            <a href={`tel:${branch.dial}`} className={secondaryLinkClass}>
              <Phone className="h-3.5 w-3.5" /> Call branch
            </a>
          ) : (
            <Button disabled title="No branch number on file yet" leading={<Phone className="h-3.5 w-3.5" />}>
              Call branch
            </Button>
          )}
          {sla.topManagement ? (
            <span className="inline-flex h-8 items-center gap-1.5 px-1 text-[12px] font-medium text-danger">
              <CheckCircle2 className="h-3.5 w-3.5" /> Top Management notified
            </span>
          ) : (
            <Button
              disabled={escalated}
              leading={escalated ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
              onClick={() => escalate(c.id) && toast.success("Escalated to Top Management", "Notification sent (simulated) and logged on the claim.")}
            >
              {escalated ? "Escalated" : "Escalate to Top Management"}
            </Button>
          )}
          <Button variant="ghost" leading={<MessageSquarePlus className="h-3.5 w-3.5" />} onClick={() => onRemark(c)}>
            Add Remarks
          </Button>
        </div>
      </article>
    </motion.li>
  );
}

export default function CodeRedPage() {
  const stats = useClaimStats();
  const claims = useVisibleClaims();
  const { q, showroom } = useClaimFilters();
  const now = useClock();
  const remarks = useRemarkDrawer();

  // Every overdue claim, worst first: Top Management alerts, then by how long they have been late.
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const claim of claims) {
      const sla = slaFor(claim, now);
      if (sla?.health === "breach" && matchesFilters(claim, q, showroom)) out.push({ claim, sla });
    }
    return out.sort((a, z) => Number(z.sla.topManagement) - Number(a.sla.topManagement) || a.sla.remainingMs - z.sla.remainingMs);
  }, [claims, q, showroom, now]);

  const worst = stats.breached.map((c) => slaFor(c, now)).reduce((m, s) => Math.max(m, s ? -s.remainingMs : 0), 0);
  const branches = new Set(stats.breached.map((c) => c.branchId));

  const tile = (label: string, value: string, hot?: boolean) => (
    <Card className={cn("p-3.5", hot && "border-danger/50 bg-danger-tint")}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums leading-none", hot ? "text-danger" : "text-fg")}>{value}</p>
    </Card>
  );

  return (
    <>
      <PageHeader title="Code Red" description="Every claim that has run past an SLA timer, worst first. A lapsed 12-hour central dispatch goes to Top Management automatically." actions={<ClaimsActions />} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile("Overdue claims", String(stats.breachCount), stats.breachCount > 0)}
        {tile("Top Management alerts", String(stats.topManagement), stats.topManagement > 0)}
        {tile("Longest overdue", stats.breachCount ? formatSpan(worst) : "—")}
        {tile("Branches affected", String(branches.size))}
      </div>

      <div className="mb-5">
        <FilterBar />
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl border", stats.breachCount ? "border-line bg-hover text-muted" : "border-ok/30 bg-ok-tint text-ok")}>
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-fg">{stats.breachCount ? "No overdue claims match" : "All clear — no SLA breaches"}</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">{stats.breachCount ? `${stats.breachCount} overdue claim${stats.breachCount === 1 ? " is" : "s are"} hidden by the search or showroom filter.` : "Every running timer is within its deadline."}</p>
        </Card>
      ) : (
        <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="space-y-4">
          {rows.map((r) => (
            <AlertCard key={`${r.claim.id}:${r.sla.key}`} row={r} onRemark={remarks.open} />
          ))}
        </motion.ul>
      )}
      {remarks.drawer}
    </>
  );
}
