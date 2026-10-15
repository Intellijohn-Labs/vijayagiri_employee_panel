"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

/** A row of pill tabs; the selected pill's blue background glides between them. */
export function PillTabs<T extends string>({ id, label, value, onChange, tabs, size = "md" }: { id: string; label: string; value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[]; size?: "sm" | "md" }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn("relative shrink-0 whitespace-nowrap rounded-full border font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", size === "md" ? "h-9 px-3.5 text-[13px]" : "h-8 px-3 text-[12.5px]", on ? "border-transparent text-white" : "border-line bg-surface text-muted hover:bg-hover hover:text-fg")}
          >
            {on && <motion.span layoutId={id} transition={spring} className="absolute inset-0 rounded-full bg-[#003399] shadow-[0_6px_16px_-8px_rgba(0,51,153,0.9)]" />}
            <span className="relative flex items-center gap-1.5">
              {t.label}
              {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-white/20" : "bg-fg/[0.07]")}>{t.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
