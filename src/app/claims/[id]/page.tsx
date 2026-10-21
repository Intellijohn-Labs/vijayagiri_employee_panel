"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, SearchX, TriangleAlert } from "lucide-react";
import { useBranch } from "@/store/branch-store";
import { useClaims } from "@/store/claims-store";
import { useSessionEmployee, canAccess } from "@/store/employee-store";
import { estimateTotal, fmtDateTime, healthOf, stageDef, type Claim, type StageNo } from "@/lib/claims";
import { cn, formatINR } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { HealthBadge, SlaHero, TopManagementAlert, useClock, useSla } from "@/components/claims/sla";
import { StagePanel } from "@/components/claims/stages";
import { Stepper } from "@/components/claims/stepper";
import { Fact, secondaryLinkClass } from "@/components/claims/ui";

const TONE_DOT = { info: "bg-info", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" } as const;

export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const claim = useClaims((s) => s.claims.find((c) => c.id === id));
  const me = useSessionEmployee();

  if (!claim || !canAccess(me, claim.branchId)) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
          <SearchX className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-fg">Claim not found</p>
        <p className="mt-1 text-[13px] text-muted">It may have been removed, or it belongs to a showroom you can't open.</p>
        <Link href="/claims" className={cn(secondaryLinkClass, "mt-4")}>
          Back to claims
        </Link>
      </Card>
    );
  }
  return <ClaimView claim={claim} />;
}

function ClaimView({ claim }: { claim: Claim }) {
  const branch = useBranch(claim.branchId);
  const now = useClock();
  const sla = useSla(claim);
  // A stage picked in the stepper only holds while the claim stays where it is; moving on brings the view back to the stage in progress.
  const progress = `${claim.stage}:${!!claim.closedAt}`;
  const [picked, setPicked] = useState<{ progress: string; stage: StageNo } | null>(null);

  const health = healthOf(claim, now);
  const viewing = picked?.progress === progress ? picked.stage : claim.stage;
  const def = stageDef(viewing);
  const breached = health === "breach";

  return (
    <>
      <Link href="/claims" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted outline-none hover:text-fg focus-visible:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> All claims
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-fg">{claim.claimNo || claim.ref}</h1>
            <HealthBadge health={health} full />
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {claim.customerName} · {claim.model} · <span className="font-mono">{claim.regNo}</span> · {branch?.short ?? claim.branchId}
          </p>
          <p className="font-mono text-[11.5px] text-faint">
            {claim.claimNo ? `${claim.ref} · ` : "Claim no. assigned at Stage 2 · "}Job card {claim.jobCardNo}
          </p>
        </div>
      </div>

      {breached && sla?.topManagement ? (
        <TopManagementAlert className="mb-5" />
      ) : breached && sla ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-tint px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-[13px] text-fg">
            <span className="font-semibold text-danger">SLA breached · </span>
            {sla.label} was due {fmtDateTime(sla.dueAt)}. Action this claim now.
          </p>
        </div>
      ) : null}

      <div className="mb-5">
        <Stepper claim={claim} viewing={viewing} onView={(stage) => setPicked({ progress, stage })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <div className="mb-4 border-b border-line pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Stage {def.no} of 10 {claim.closedAt && viewing === 10 ? "· Delivered" : viewing !== claim.stage ? "· Completed — read only" : ""}
            </p>
            <h2 className="mt-1 text-[16px] font-semibold tracking-tight text-fg">{def.name}</h2>
            <p className="mt-0.5 text-[13px] text-muted">{def.blurb}</p>
            {def.sla && <p className="mt-1.5 text-[12px] font-medium text-accent-text">SLA · {def.sla}</p>}
          </div>
          <StagePanel claim={claim} stage={viewing} />
        </Card>

        <div className="space-y-4">
          <SlaHero claim={claim} />

          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-fg">Claim summary</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
              <Fact label="Customer">{claim.customerName}</Fact>
              <Fact label="Phone">{claim.phone}</Fact>
              <Fact label="Vehicle">{claim.model}</Fact>
              <Fact label="Reg. no." mono>{claim.regNo}</Fact>
              <Fact label="Insurer">{claim.insurer}</Fact>
              <Fact label="Policy no." mono>{claim.policyNo}</Fact>
              <Fact label="Estimate">{estimateTotal(claim) ? formatINR(estimateTotal(claim)) : ""}</Fact>
              <Fact label="Showroom">{branch?.short ?? claim.branchId}</Fact>
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-fg">Activity</h3>
            <ol className="space-y-3">
              {claim.events.slice(0, 12).map((e) => (
                <li key={`${e.at}-${e.text}`} className="flex gap-2.5">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[e.tone])} />
                  <div className="min-w-0">
                    <p className={cn("text-[12.5px] leading-5", e.tone === "danger" ? "font-medium text-danger" : "text-fg")}>{e.text}</p>
                    <p className="text-[11px] text-faint">{fmtDateTime(e.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
