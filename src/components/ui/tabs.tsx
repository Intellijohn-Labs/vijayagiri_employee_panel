"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { springFirm } from "@/lib/motion";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/** Segmented tabs with a spring-animated active pill. `id` namespaces the shared layoutId. */
export function Tabs<T extends string>({ id, value, onChange, items, className }: { id: string; value: T; onChange: (v: T) => void; items: TabItem<T>[]; className?: string }) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-0.5 rounded-lg border border-line bg-fg/[0.03] p-0.5", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={active} onClick={() => onChange(it.value)} className={cn("relative inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors", active ? "text-fg" : "text-muted hover:text-fg")}>
            {active && <motion.span layoutId={`${id}-pill`} transition={springFirm} className="absolute inset-0 rounded-md border border-line bg-surface shadow-card" />}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {it.icon}
              {it.label}
              {it.count !== undefined && <span className={cn("tabular text-[11px]", active ? "text-accent-text" : "text-faint")}>{it.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
