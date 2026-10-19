"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, SearchX, Wrench } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { useClaims, useVisibleClaims } from "@/store/claims-store";
import { branchLabel } from "@/lib/branches";
import { HEALTH_LABEL, healthOf, type Health } from "@/lib/claims";
import { toast } from "@/store/toast-store";
import { buttonLinkClass } from "@/components/claims/ui";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Select } from "@/components/ui/popover";
import { Card, Input, PageHeader } from "@/components/ui/primitives";
import { ClaimList, KanbanBoard, RedAlertBanner } from "@/components/claims/board";
import { useClock } from "@/components/claims/sla";

type Filter = "all" | Health;
type View = "board" | "list";

export default function ClaimsPage() {
  const claims = useVisibleClaims();
  const { branches } = useBranchTools();
  const resetSample = useClaims((s) => s.resetSample);
  const now = useClock();

  const [view, setView] = useState<View>("board");
  const [filter, setFilter] = useState<Filter>("all");
  const [showroom, setShowroom] = useState("all");
  const [q, setQ] = useState("");

  const inScope = useMemo(() => {
    const t = q.trim().toLowerCase();
    return claims.filter((c) => (showroom === "all" || c.branchId === showroom) && (!t || `${c.ref} ${c.claimNo} ${c.jobCardNo} ${c.customerName} ${c.phone} ${c.regNo} ${c.model} ${c.insurer}`.toLowerCase().includes(t)));
  }, [claims, showroom, q]);
  const count = (h: Health) => inScope.filter((c) => healthOf(c, now) === h).length;
  const shown = useMemo(() => inScope.filter((c) => filter === "all" || healthOf(c, now) === filter), [inScope, filter, now]);

  const tabs = [
    { value: "all" as Filter, label: "All Claims", count: inScope.length },
    { value: "ok" as Filter, label: HEALTH_LABEL.ok, count: count("ok") },
    { value: "warn" as Filter, label: HEALTH_LABEL.warn, count: count("warn") },
    { value: "breach" as Filter, label: HEALTH_LABEL.breach, count: count("breach") },
    { value: "done" as Filter, label: "Delivered", count: count("done") },
  ];

  return (
    <>
      <PageHeader
        title="Claims & Workshop"
        description="Every accident-repair claim through the 10-stage SOP, with live SLA timers and red alerts when a deadline is missed."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                resetSample();
                toast.success("Demo claims reset", "Fresh sample claims at every stage, with timers set from now.");
              }}
            >
              Reset demo data
            </Button>
            <Link href="/claims/new" className={buttonLinkClass}>
              <Plus className="h-3.5 w-3.5" /> New Claim
            </Link>
          </>
        }
      />

      <RedAlertBanner claims={inScope} active={filter === "breach"} onToggle={() => setFilter(filter === "breach" ? "all" : "breach")} />

      <div className="mb-4">
        <PillTabs id="claims-filter" label="Filter claims by status" value={filter} onChange={setFilter} tabs={tabs} />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search claim no., customer, reg. no…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search claims" />
        </div>
        <div className="w-full sm:w-64 [&>div]:flex [&>div]:w-full">
          <Select<string> value={showroom} onChange={setShowroom} options={[{ value: "all", label: "All Showrooms" }, ...branches.map((b) => ({ value: b.id, label: branchLabel(b) }))]} />
        </div>
        <div className="sm:ml-auto">
          <PillTabs
            id="claims-view"
            label="Choose view"
            size="sm"
            value={view}
            onChange={setView}
            tabs={[
              { value: "board" as View, label: "Pipeline board" },
              { value: "list" as View, label: "List" },
            ]}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">{claims.length ? <SearchX className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}</span>
          <p className="text-sm font-medium text-fg">{claims.length ? "No claims match" : "No claims yet"}</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">{claims.length ? "Try another status, showroom or search." : "Open a new claim, or reset the demo data to see a claim at every stage."}</p>
          {!claims.length && (
            <div className="mt-4 flex gap-2">
              <Link href="/claims/new" className={buttonLinkClass}>
                <Plus className="h-3.5 w-3.5" /> New Claim
              </Link>
              <Button onClick={resetSample}>Load demo claims</Button>
            </div>
          )}
        </Card>
      ) : view === "board" ? (
        <KanbanBoard claims={shown} />
      ) : (
        <ClaimList claims={shown} />
      )}
    </>
  );
}
