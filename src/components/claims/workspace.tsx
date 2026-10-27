"use client";

import { useState } from "react";
import { SearchX, Wrench } from "lucide-react";
import { useClaims } from "@/store/claims-store";
import { useClaimFilters } from "@/store/claims-filter-store";
import { isEscalated, slaFor, slaSummary, stageDef, type StageNo } from "@/lib/claims";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Card, PageHeader } from "@/components/ui/primitives";
import { AlertSoundToggle, CardGrid, FilterBar } from "./cards";
import { useClaimList, useClaimStats, type StatusFilter } from "./stats";
import { PipelineOverview, StatsBar } from "./pipeline";
import { useCodeRedBeeper } from "./beat";
import { useClock } from "./sla";
import { NewClaimButton } from "./new-claim";
import { SlaSettings } from "./sla-settings";

const PAGE = 24;

/** Header actions every Claims list page shares. */
export function ClaimsActions() {
  return (
    <>
      <AlertSoundToggle />
      <SlaSettings />
      <NewClaimButton />
    </>
  );
}

/**
 * One workspace for every list page. With a `stage` it is that stage's dedicated view; without one it is the
 * all-claims overview with the pipeline rail on top.
 */
export function Workspace({ stage }: { stage?: StageNo }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const { q, showroom } = useClaimFilters();
  const stats = useClaimStats();
  const { shown, counts } = useClaimList(status, stage);
  const hydrated = useClaims((s) => s.hydrated);
  const loadError = useClaims((s) => s.loadError);
  const reload = useClaims((s) => s.load);
  const now = useClock();
  const def = stage ? stageDef(stage) : null;
  // High severity on screen: a claim here has been escalated to Top Management.
  useCodeRedBeeper(shown.some((c) => isEscalated(slaFor(c, now))));
  const filtering = !!q.trim() || showroom !== "all" || status !== "all";
  const withDelivered = stage === undefined || stage === 10;

  const tabs = [
    { value: "all" as StatusFilter, label: stage ? "In this stage" : "All Claims", count: counts.all },
    { value: "ok" as StatusFilter, label: "On Track", count: counts.ok },
    { value: "warn" as StatusFilter, label: "Approaching", count: counts.warn },
    { value: "breach" as StatusFilter, label: "Overdue", count: counts.breach },
    ...(withDelivered ? [{ value: "done" as StatusFilter, label: "Delivered", count: counts.done }] : []),
  ];

  return (
    <>
      <PageHeader
        title={def ? `${def.no}. ${def.name}` : "Claims & Workshop"}
        description={def ? `${def.blurb} SLA: ${slaSummary(def.no)}.` : "Every accident-repair claim through the 10-stage SOP. Pick a stage in the side menu, or open Code Red for anything overdue."}
        actions={<ClaimsActions />}
      />
      {loadError && (
        <Card className="mb-4 flex items-center gap-3 border-red-500/40 px-4 py-3 text-[13px] text-fg">
          <span className="flex-1">Couldn&apos;t load claims from the database. What you see may be out of date.</span>
          <Button size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </Card>
      )}
      <StatsBar />
      <PipelineOverview active={stage} />

      <div className="mb-4">
        <PillTabs id={`claims-status-${stage ?? "all"}`} label="Filter by status" value={status} onChange={(v) => {
            setStatus(v);
            setLimit(PAGE);
          }} tabs={tabs} />
      </div>
      <div className="mb-5">
        <FilterBar />
      </div>

      <CardGrid
        claims={shown.slice(0, limit)}
        showStage={!stage}
        empty={
          <Card className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">{filtering ? <SearchX className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}</span>
            <p className="text-sm font-medium text-fg">{!hydrated ? "Loading claims…" : filtering ? "No claims match" : stage ? "No vehicles in this stage" : "No claims found"}</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted">{filtering ? "Try another status, showroom or search." : stage ? "Vehicles appear here as claims reach this stage." : "Claims appear here once they are opened with New Claim."}</p>
          </Card>
        }
      />
      {shown.length > limit && (
        <div className="mt-5 flex justify-center">
          <Button onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</Button>
        </div>
      )}
    </>
  );
}
