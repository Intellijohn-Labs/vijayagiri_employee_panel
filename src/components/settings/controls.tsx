"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";

export function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Label above a control (for controls that are not a plain input, so a wrapping <label> would misbehave). */
export const fieldLabel = "mb-1.5 block text-xs font-medium text-fg";
export const selectCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg outline-none transition-colors hover:border-strong focus-visible:ring-2 focus-visible:ring-blue-500/40";

/** A switch with a title and a line of explanation. */
export function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-4 rounded-xl border border-line bg-canvas p-3.5 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-fg">{title}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-4 text-muted">{hint}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-[#003399]" : "bg-slate-300 dark:bg-slate-600")} aria-hidden>
        <motion.span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" initial={false} animate={{ left: on ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
      </span>
    </button>
  );
}

/** Pill choices for a small set of options. */
export function Choice<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cn("h-9 rounded-lg border px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40", value === o.value ? "border-transparent bg-[#003399] text-white" : "border-line bg-surface text-muted hover:bg-hover hover:text-fg")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Number box with an optional ₹ / % marker. Empty input counts as 0. */
export function NumBox({ value, onChange, min = 0, max, step = 1, prefix, suffix, label, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; prefix?: string; suffix?: string; label: string; className?: string }) {
  return (
    <span className={cn("relative block", className)}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{prefix}</span>}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={cn("h-9 w-full rounded-lg border border-line bg-surface text-[13px] text-fg outline-none transition-colors hover:border-strong focus-visible:ring-2 focus-visible:ring-blue-500/40", prefix ? "pl-7" : "pl-3", suffix ? "pr-9" : "pr-3")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{suffix}</span>}
    </span>
  );
}
