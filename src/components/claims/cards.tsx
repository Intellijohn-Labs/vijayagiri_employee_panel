"use client";

import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquarePlus, Phone, Search, Siren, Volume2, VolumeX } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { useAlertSound } from "@/store/alert-sound-store";
import { useClaims } from "@/store/claims-store";
import { useClaimFilters } from "@/store/claims-filter-store";
import { toast } from "@/store/toast-store";
import { branchLabel } from "@/lib/branches";
import { fmtDateTime, slaFor, stageDef, type Claim, type Health } from "@/lib/claims";
import { playMildAlertBeep, sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { cardIn, springFirm } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Select } from "@/components/ui/popover";
import { Input, Textarea } from "@/components/ui/primitives";
import { HealthBadge, SlaChip, useClaimHealth } from "./sla";
import { TapLink, secondaryLinkClass } from "./ui";
import { BikeThumb, PlateBadge } from "./vehicle";

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
  // Stable, so memoised cards that receive it are not re-rendered when the drawer state changes.
  const open = useCallback((c: Claim) => setId(c.id), []);
  return { open, drawer };
}

/* ───────── Vehicle card ───────── */

/** Border and glow per status; the glow takes the status colour on hover and keyboard focus. Written out in full so Tailwind sees every class. */
const SURFACE: Record<Health, string> = {
  ok: "border-line hover:border-accent/50 focus-within:border-accent/50 hover:shadow-[0_10px_28px_-10px_rgb(var(--accent)/0.4)] focus-within:shadow-[0_10px_28px_-10px_rgb(var(--accent)/0.4)]",
  done: "border-line hover:border-accent/50 focus-within:border-accent/50 hover:shadow-[0_10px_28px_-10px_rgb(var(--accent)/0.4)] focus-within:shadow-[0_10px_28px_-10px_rgb(var(--accent)/0.4)]",
  warn: "border-warn/40 hover:border-warn/70 focus-within:border-warn/70 hover:shadow-[0_10px_28px_-10px_rgb(var(--warn)/0.45)] focus-within:shadow-[0_10px_28px_-10px_rgb(var(--warn)/0.45)]",
  breach: "border-danger/50 bg-danger-tint hover:border-danger focus-within:border-danger hover:shadow-[0_10px_28px_-10px_rgb(var(--danger)/0.5)] focus-within:shadow-[0_10px_28px_-10px_rgb(var(--danger)/0.5)]",
};

/** The shell every claim card shares: glassy border, soft shadow that deepens on hover, a small lift. */
export const cardShell = "transform-gpu rounded-2xl border bg-surface/90 shadow-sm ring-1 ring-inset ring-white/60 transition-[box-shadow,border-color] duration-200 hover:shadow-md focus-within:shadow-md dark:ring-white/[0.04]";
export { SURFACE as cardGlow };

/** Pulsing border and a mild beep (when alert sound is on) for an overdue card. Spread onto the card. */
export function overdueAlert(overdue: boolean) {
  if (!overdue) return { className: "" };
  return {
    className: "red-pulse",
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && playMildAlertBeep(),
    onClick: playMildAlertBeep,
  };
}

/** Mute / unmute for the Code Red alert sounds, shared by the card, the Code Red hub and the list tools bar. Off by default. */
export function AlertSoundToggle({ className }: { className?: string }) {
  const { enabled, hydrate, set } = useAlertSound();
  useEffect(hydrate, [hydrate]);
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "Mute overdue alert sound" : "Unmute overdue alert sound"}
      title={enabled ? "Alert sound on" : "Alert sound off"}
      onClick={() => {
        set(!enabled);
        if (!enabled) sfx.alert();
      }}
      className={cn("grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-surface text-muted outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:shadow-ring", enabled && "text-fg", className)}
    >
      {enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * One vehicle: who, what, where, how late, and what you can do about it.
 * Memoised, and it reads its status through `useClaimHealth`, so it re-renders when something about the claim
 * changes or its status flips, not on every tick of the clock (only the small timer chip does that).
 */
export const VehicleCard = memo(function VehicleCard({ claim, index, onRemark, showStage }: { claim: Claim; index: number; onRemark: (c: Claim) => void; showStage?: boolean }) {
  const { byId } = useBranchTools();
  const complete = useClaims((s) => s.complete);
  const health = useClaimHealth(claim);
  // Which timer applies doesn't depend on the time, only whether it has run out.
  const phase = slaFor(claim, 0);
  const branch = byId(claim.branchId);
  const remark = latestRemark(claim);
  const st = stageDef(claim.stage);
  const top = !!phase?.topManagement && health === "breach";
  const alert = overdueAlert(health === "breach");

  const advance = () => {
    const r = complete(claim.id);
    if (r.ok) toast.success(`Moved to Stage ${claim.stage + 1}`, `${claim.claimNo || claim.ref} · ${claim.customerName}`);
    else toast.error("Can't move to the next stage yet", `${r.missing.join(" · ")}. Open the claim to complete it.`);
  };

  return (
    <motion.li custom={index} variants={cardIn} className="min-w-0">
      <motion.article whileHover={{ y: -3 }} transition={springFirm} className={cn("flex h-full flex-col p-4", cardShell, SURFACE[health], alert.className)} onPointerEnter={alert.onPointerEnter} onClick={alert.onClick}>
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] text-muted">{claim.claimNo || claim.ref}</p>
            {showStage && <p className="truncate text-[11px] text-faint">Stage {claim.stage} · {st.name}</p>}
          </div>
          <HealthBadge health={health} />
        </header>

        <div className="mt-3 flex items-center gap-3">
          <BikeThumb model={claim.model} />
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-5 text-fg">{claim.customerName}</h3>
            <a href={telHref(claim.phone)} className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-muted outline-none hover:text-fg focus-visible:underline">
              <Phone className="h-3 w-3" /> {claim.phone}
            </a>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] font-medium text-fg">{claim.model}</p>
          <PlateBadge regNo={claim.regNo} />
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted">{branch ? branchLabel(branch) : claim.branchId}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-hover/60 px-3 py-2">
          <span className="text-[11.5px] text-muted">{claim.closedAt ? "Closed" : (phase?.label ?? "No SLA timer on this stage")}</span>
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
              <TapLink href={`/claims/${claim.id}`} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg outline-none transition-colors hover:bg-accent-hover focus-visible:shadow-ring">
                Approve & hand over <ArrowRight className="h-3 w-3" />
              </TapLink>
            ) : (
              <Button size="sm" variant="primary" onClick={advance} trailing={<ArrowRight className="h-3 w-3" />}>
                Move to Next Stage
              </Button>
            ))}
          <TapLink href={`/claims/${claim.id}`} className={cn(secondaryLinkClass, "h-7 rounded-md px-2.5 text-xs")}>
            View Details
          </TapLink>
          <Button size="sm" variant="ghost" leading={<MessageSquarePlus className="h-3 w-3" />} onClick={() => onRemark(claim)}>
            Add Remarks
          </Button>
        </footer>
      </motion.article>
    </motion.li>
  );
});

/** Responsive grid of vehicle cards with the shared remark drawer. Cards stagger in whenever the stage (or the list) changes. */
export function CardGrid({ claims, showStage, empty }: { claims: Claim[]; showStage?: boolean; empty: ReactNode }) {
  const remarks = useRemarkDrawer();
  if (!claims.length) return <>{empty}</>;
  return (
    <>
      <motion.ul initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {claims.map((c, i) => (
          <VehicleCard key={c.id} claim={c} index={i} showStage={showStage} onRemark={remarks.open} />
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
      <AlertSoundToggle className="sm:ml-auto" />
    </div>
  );
}
