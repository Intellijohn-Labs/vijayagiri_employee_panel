"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquarePlus, Phone, Search, Siren } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { useClaims } from "@/store/claims-store";
import { useClaimFilters } from "@/store/claims-filter-store";
import { toast } from "@/store/toast-store";
import { branchLabel } from "@/lib/branches";
import { fmtDateTime, healthOf, slaFor, stageDef, type Claim } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Select } from "@/components/ui/popover";
import { Input, Textarea } from "@/components/ui/primitives";
import { HealthBadge, SlaChip, useClock } from "./sla";
import { secondaryLinkClass } from "./ui";

const telHref = (phone: string) => `tel:+${phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`;
const latestRemark = (c: Claim) => c.events.filter((e) => e.kind === "remark").sort((a, z) => z.at - a.at)[0];

/* ───────── Remarks ───────── */

/** One drawer shared by every card on a page. `open(claim)` shows it; render `drawer` once. */
export function useRemarkDrawer() {
  const [id, setId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const claim = useClaims((s) => s.claims.find((c) => c.id === id));
  const addRemark = useClaims((s) => s.addRemark);
  const close = () => {
    setId(null);
    setText("");
  };
  const save = () => {
    if (!id || !addRemark(id, text)) return void toast.error("Write a remark first");
    toast.success("Remark added");
    setText("");
  };
  const remarks = claim?.events.filter((e) => e.kind === "remark") ?? [];
  const drawer = (
    <Drawer
      open={!!claim}
      onClose={close}
      title="Remarks"
      description={claim ? `${claim.claimNo || claim.ref} · ${claim.customerName}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button variant="primary" onClick={save} disabled={!text.trim()}>
            Add remark
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <Textarea data-autofocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Customer called, parts promised by Thursday…" aria-label="New remark" />
        {remarks.length > 0 && (
          <ol className="space-y-3 border-t border-line pt-4">
            {remarks.map((r) => (
              <li key={`${r.at}-${r.text}`}>
                <p className="text-[13px] leading-5 text-fg">{r.text}</p>
                <p className="text-[11px] text-faint">{fmtDateTime(r.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
  return { open: (c: Claim) => setId(c.id), drawer };
}

/* ───────── Vehicle card ───────── */

/** One vehicle: who, what, where, how late, and what you can do about it. */
export function VehicleCard({ claim, onRemark, showStage }: { claim: Claim; onRemark: (c: Claim) => void; showStage?: boolean }) {
  const { byId } = useBranchTools();
  const complete = useClaims((s) => s.complete);
  const now = useClock();
  const health = healthOf(claim, now);
  const sla = slaFor(claim, now);
  const branch = byId(claim.branchId);
  const remark = latestRemark(claim);
  const st = stageDef(claim.stage);
  const top = !!sla?.topManagement && health === "breach";

  const advance = () => {
    const r = complete(claim.id);
    if (r.ok) toast.success(`Moved to Stage ${claim.stage + 1}`, `${claim.claimNo || claim.ref} · ${claim.customerName}`);
    else toast.error("Can't move to the next stage yet", `${r.missing.join(" · ")}. Open the claim to complete it.`);
  };

  return (
    <motion.li layout variants={fadeUp} transition={spring} className="min-w-0">
      <article
        className={cn(
          "flex h-full flex-col rounded-xl border bg-surface p-4 shadow-card transition-colors",
          health === "breach" ? "border-danger/50 bg-danger-tint ring-1 ring-danger/30" : health === "warn" ? "border-warn/40" : "border-line",
        )}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] text-muted">{claim.claimNo || claim.ref}</p>
            {showStage && <p className="truncate text-[11px] text-faint">Stage {claim.stage} · {st.name}</p>}
          </div>
          <HealthBadge health={health} />
        </header>

        <h3 className="mt-2 truncate text-[15px] font-semibold text-fg">{claim.customerName}</h3>
        <a href={telHref(claim.phone)} className="mt-0.5 inline-flex w-fit items-center gap-1.5 text-[12.5px] text-muted outline-none hover:text-fg focus-visible:underline">
          <Phone className="h-3 w-3" /> {claim.phone}
        </a>

        <p className="mt-2.5 truncate text-[13px] text-fg">
          {claim.model} · <span className="font-mono">{claim.regNo}</span>
        </p>
        <p className="truncate text-[12px] text-muted">{branch ? branchLabel(branch) : claim.branchId}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-hover/60 px-3 py-2">
          <span className="text-[11.5px] text-muted">{claim.closedAt ? "Closed" : (sla?.label ?? "No SLA timer on this stage")}</span>
          <SlaChip claim={claim} />
        </div>
        {top && (
          <p className="mt-2 inline-flex w-fit items-center gap-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            <Siren className="h-3 w-3" /> TOP MANAGEMENT RED ALERT
          </p>
        )}
        {remark && <p className="mt-2.5 line-clamp-2 border-l-2 border-line pl-2.5 text-[12px] italic leading-4 text-muted">{remark.text}</p>}

        <footer className="mt-auto flex flex-wrap gap-2 pt-4">
          {!claim.closedAt &&
            (claim.stage === 10 ? (
              <Link href={`/claims/${claim.id}`} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg outline-none hover:bg-accent-hover focus-visible:shadow-ring">
                Approve & hand over <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <Button size="sm" variant="primary" onClick={advance} trailing={<ArrowRight className="h-3 w-3" />}>
                Move to Next Stage
              </Button>
            ))}
          <Link href={`/claims/${claim.id}`} className={cn(secondaryLinkClass, "h-7 rounded-md px-2.5 text-xs")}>
            View Details
          </Link>
          <Button size="sm" variant="ghost" leading={<MessageSquarePlus className="h-3 w-3" />} onClick={() => onRemark(claim)}>
            Add Remarks
          </Button>
        </footer>
      </article>
    </motion.li>
  );
}

/** Responsive grid of vehicle cards with the shared remark drawer. */
export function CardGrid({ claims, showStage, empty }: { claims: Claim[]; showStage?: boolean; empty: ReactNode }) {
  const remarks = useRemarkDrawer();
  if (!claims.length) return <>{empty}</>;
  return (
    <>
      <motion.ul variants={stagger(0.025)} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {claims.map((c) => (
          <VehicleCard key={c.id} claim={c} showStage={showStage} onRemark={remarks.open} />
        ))}
      </motion.ul>
      {remarks.drawer}
    </>
  );
}

/* ───────── Search and showroom ───────── */

/** Search box and showroom picker, backed by the shared filter store. */
export function FilterBar({ trailing }: { trailing?: ReactNode }) {
  const { branches } = useBranchTools();
  const { q, showroom, setQ, setShowroom } = useClaimFilters();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-full sm:w-72">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search claim no., customer, reg. no…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search claims" />
      </div>
      <div className="w-full sm:w-64 [&>div]:flex [&>div]:w-full">
        <Select<string> value={showroom} onChange={setShowroom} options={[{ value: "all", label: "All Showrooms" }, ...branches.map((b) => ({ value: b.id, label: branchLabel(b) }))]} />
      </div>
      {trailing}
    </div>
  );
}

/** Link to the Code Red hub, with the live breach count. */
export function CodeRedButton({ count }: { count: number }) {
  return (
    <Link
      href="/claims/code-red"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:shadow-ring",
        count ? "border-danger bg-danger text-white hover:opacity-90" : "border-line bg-surface text-fg hover:bg-hover",
      )}
    >
      <Siren className={cn("h-3.5 w-3.5", count > 0 && "animate-pulse")} /> Code Red
      <span className={cn("grid h-4 min-w-4 place-items-center rounded-full px-1 text-[11px] tabular-nums", count ? "bg-white text-danger" : "bg-fg/10 text-muted")}>{count}</span>
    </Link>
  );
}
