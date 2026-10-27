"use client";

import { motion } from "framer-motion";
import { Mail, Pencil, Phone, Power } from "lucide-react";
import { useAllBranches } from "@/store/branch-store";
import { intlDigits, type Employee } from "@/store/employee-store";
import { cn } from "@/lib/utils";
import { fadeUp, spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { ROOT_ONLY_MESSAGE, isRootEmail } from "@/lib/employees";
import { Avatar, Badge } from "@/components/ui/primitives";

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2.5 21.5Z" />
      <path d="M9.2 8.4c-.4.4-.6 1-.3 1.8.6 1.6 2.1 3.1 3.8 3.8.8.3 1.4.1 1.8-.3l.4-.6c.1-.2.1-.4-.1-.5l-1.3-.7c-.2-.1-.4 0-.5.1l-.4.5c-.9-.4-1.7-1.2-2.1-2.1l.5-.4c.1-.1.2-.3.1-.5l-.7-1.3c-.1-.2-.3-.2-.5-.1Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const LOGO_MASK = "url(/images/vijayagiri-logo.png)";
const maskStyle = { WebkitMaskImage: LOGO_MASK, maskImage: LOGO_MASK, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "left center", maskPosition: "left center" } as const;

/** A vertical corporate smart-badge for one employee. */
export function EmployeeCard({ employee: e, isYou, canManage, onEdit, onToggle }: { employee: Employee; isYou: boolean; /** Only the root admin may deactivate or reactivate staff */ canManage: boolean; onEdit: () => void; onToggle: () => void }) {
  const branches = useAllBranches();
  const active = e.status === "Active";
  const root = isRootEmail(e.email);
  const waDigits = intlDigits(e.whatsapp || e.phone);
  const telDigits = intlDigits(e.phone);

  return (
    <motion.article layout variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }} whileHover={{ y: -4 }} transition={spring} className="mx-auto w-full max-w-[310px]">
      <div className={cn("relative flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-card transition-shadow duration-200 hover:border-blue-500/40 hover:shadow-xl", !active && "opacity-80")}>
        {/* lanyard slot */}
        <span aria-hidden className="absolute left-1/2 top-2.5 z-20 h-2 w-14 -translate-x-1/2 rounded-full bg-black/30 shadow-inner ring-1 ring-white/25" />

        {/* header band */}
        <div className="relative h-[112px] overflow-hidden bg-gradient-to-br from-[#003399] via-[#0047AB] to-[#1D4ED8] px-4 pt-7">
          <div aria-hidden className="absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(115deg,#fff_0_2px,transparent_2px_18px)]" />
          <div aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-300/25 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div role="img" aria-label="Vijayagiri Auto Agencies" className="h-7 w-[104px] bg-white" style={maskStyle} />
            <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[9px] font-semibold tracking-[0.2em] text-white/90">EMPLOYEE</span>
          </div>
        </div>

        {/* photo */}
        <div className="relative -mt-[52px] flex justify-center">
          <div className="relative">
            <span className={cn("block rounded-full ring-4 ring-surface shadow-lg", !active && "grayscale")}>
              <Avatar name={e.name} src={e.photo} size={104} className="text-[34px]" />
            </span>
            <span title={e.status} className={cn("absolute bottom-1.5 right-1.5 h-[18px] w-[18px] rounded-full border-[3px] border-surface", active ? "bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)]" : "bg-slate-400")} />
          </div>
        </div>

        <div className="px-5 pb-4 pt-3 text-center">
          <h3 className="text-[17px] font-bold leading-6 tracking-tight text-fg">{e.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <Badge tone="accent">{e.role}</Badge>
            {root && <Badge tone="ok">Root Admin</Badge>}
            {isYou && <Badge tone="info">You</Badge>}
            {!active && <Badge>Inactive</Badge>}
            {active && !e.activated && <Badge tone="warn">Awaiting activation</Badge>}
          </div>
          <p className="mt-2.5 inline-block rounded-md border border-line bg-canvas px-2.5 py-1 font-mono text-[11.5px] font-medium tracking-wider text-muted">ID: {e.code}</p>
        </div>

        {/* contacts */}
        <ul className="space-y-1.5 border-t border-dashed border-line px-4 py-3.5 text-[12.5px]">
          <li>
            <a href={`mailto:${e.email}`} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 text-fg outline-none transition-colors hover:bg-hover focus-visible:bg-hover">
              <Mail className="h-3.5 w-3.5 shrink-0 text-faint group-hover:text-accent-text" />
              <span className="truncate">{e.email}</span>
            </a>
          </li>
          <li>
            <a href={`tel:+${telDigits}`} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 text-fg outline-none transition-colors hover:bg-hover focus-visible:bg-hover">
              <Phone className="h-3.5 w-3.5 shrink-0 text-faint group-hover:text-accent-text" />
              <span className="tabular">{e.phone}</span>
            </a>
          </li>
          <li className="flex items-center gap-2.5 px-1.5">
            <WhatsAppIcon className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
            <span className="tabular flex-1 text-fg">{e.whatsapp || e.phone}</span>
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" aria-label={`Chat with ${e.name} on WhatsApp`} className="inline-flex h-6 items-center gap-1 rounded-full bg-[#25D366] px-2.5 text-[11px] font-semibold text-white outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[#25D366]/60">
              Chat
            </a>
          </li>
        </ul>

        {/* access */}
        <div className="px-4 pb-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Showroom access</p>
          <div className="flex flex-wrap gap-1">
            {e.access === "all" ? (
              <Badge tone="accent" className="bg-accent text-accent-fg ring-0">
                All Showrooms
              </Badge>
            ) : (
              e.access.map((id) => (
                <Badge key={id} tone="accent">
                  {branches.find((b) => b.id === id)?.short ?? id}
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* footer */}
        <div className="mt-auto flex items-center gap-1.5 border-t border-line bg-fg/[0.025] px-3 py-2.5">
          <Button size="sm" leading={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
            Edit Details
          </Button>
          <Button size="sm" variant="ghost" leading={<Power className="h-3.5 w-3.5" />} onClick={onToggle} disabled={isYou || root || !canManage} title={root ? "The root admin account is protected" : isYou ? "You can't deactivate your own account" : !canManage ? ROOT_ONLY_MESSAGE : undefined}>
            {active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
