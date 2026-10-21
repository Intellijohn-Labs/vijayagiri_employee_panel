"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { springFirm } from "@/lib/motion";

/** A Link that looks like the primary Button (the Button component renders a <button>, which can't navigate). */
export const buttonLinkClass = "inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] outline-none transition-[background-color,box-shadow] hover:bg-accent-hover focus-visible:shadow-ring";

export const secondaryLinkClass = "inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-fg shadow-card outline-none transition-colors hover:border-strong hover:bg-hover focus-visible:shadow-ring";

/** A labelled value in a read-only summary. */
export function Fact({ label, children, mono, className }: { label: string; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-[13px] text-fg", mono && "font-mono")}>{children || <span className="text-faint">—</span>}</dd>
    </div>
  );
}

/** A titled group inside a stage panel. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
        {hint && <p className="text-[11.5px] text-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const TapLinkBase = motion.create(Link);
/** A Next Link with the same press feedback as Button. */
export function TapLink(props: ComponentProps<typeof TapLinkBase>) {
  return <TapLinkBase whileTap={{ scale: 0.98 }} transition={springFirm} {...props} />;
}

/** A plain anchor (tel:, mailto:) with the same press feedback as Button. */
export function TapAnchor(props: ComponentProps<typeof motion.a>) {
  return <motion.a whileTap={{ scale: 0.98 }} transition={springFirm} {...props} />;
}
