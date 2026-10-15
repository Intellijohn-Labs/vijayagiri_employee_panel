"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import { ADDONS, addonPrice, type AddonId } from "@/lib/insurance";
import { inr } from "@/lib/catalogue";
import { cn } from "@/lib/utils";

/** The customer's insurance choices: the included base cover plus add-on switches. Prices move the on-road price and EMI live. */
export function InsurancePackages({ cc, selected, onToggle, baseInsurance, addonsTotal, finalPrice, emi }: { cc: number | null; selected: AddonId[]; onToggle: (id: AddonId) => void; baseInsurance: number; addonsTotal: number; finalPrice: number; emi: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#003399] dark:text-sky-300" />
        <h3 className="text-base font-bold text-fg">Insurance packages</h3>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-fg">Base insurance</p>
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">Mandatory · included</span>
        </div>
        <p className="mt-1 text-[13px] text-muted">1 year Comprehensive (own damage) + 5 years Third Party cover. Already part of the on-road price.</p>
        <p className="mt-1 text-xs text-muted">Estimated at {inr(baseInsurance)}.</p>
      </div>

      <ul className="mt-3 space-y-2" aria-label="Insurance add-ons">
        {ADDONS.map((a) => {
          const on = selected.includes(a.id);
          const price = addonPrice(a, cc);
          return (
            <li key={a.id}>
              <button type="button" role="switch" aria-checked={on} onClick={() => onToggle(a.id)} className={cn("flex min-h-[4.25rem] w-full items-center gap-3 rounded-xl border p-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", on ? "border-[#003399]/50 bg-tint" : "border-line bg-canvas hover:bg-hover")}>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-semibold text-fg">{a.name}</span>
                    {a.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        <Sparkles className="h-3 w-3" />
                        Recommended
                      </span>
                    )}
                    {a.mandatory && <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[11px] font-semibold text-muted">Mandatory</span>}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-4 text-muted">{a.blurb}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-bold tabular-nums text-fg">+{inr(price)}</span>
                </span>
                <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-[#003399]" : "bg-slate-300 dark:bg-slate-600")} aria-hidden>
                  <motion.span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow" initial={false} animate={{ left: on ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 grid gap-3 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11.5px] font-medium text-muted">Total insurance cost</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-fg">{inr(baseInsurance + addonsTotal)}</dd>
          <p className="text-[10.5px] leading-3 text-muted">base {inr(baseInsurance)} + add-ons {inr(addonsTotal)}</p>
        </div>
        <div>
          <dt className="text-[11.5px] font-medium text-muted">Final on-road price</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-[#003399] dark:text-sky-300">{inr(finalPrice)}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] font-medium text-muted">Updated monthly EMI</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-[#003399] dark:text-sky-300">{inr(emi)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11.5px] leading-4 text-muted">Add-on prices are indicative and depend on the bike&apos;s engine size. The insurer&apos;s final quote applies at issuance.</p>
    </div>
  );
}
