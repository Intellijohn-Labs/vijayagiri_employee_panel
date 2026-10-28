"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
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

/** The message shown under a required field that is still empty once the user has tried to save. */
export const MANDATORY = "This field is mandatory";

/**
 * Save-time validation for a stage panel. `flag(hasErrors)` turns the red highlights on and, when something is missing,
 * scrolls to the first marked field or section (anything carrying `data-invalid`) and shakes it. Because each panel derives
 * its errors from the live form, a field loses its red the moment it holds a valid value.
 */
export function useStageValidation() {
  const [showErrors, setShowErrors] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const flag = (hasErrors: boolean) => {
    setShowErrors(true);
    if (!hasErrors) return;
    // Wait a frame so the invalid markers are in the DOM.
    requestAnimationFrame(() => {
      const first = root.current?.querySelector<HTMLElement>("[data-invalid]");
      if (!first) return;
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.classList.remove("field-shake");
      void first.offsetWidth;
      first.classList.add("field-shake");
      first.querySelector<HTMLElement>("input,select,textarea,button")?.focus({ preventScroll: true });
    });
  };
  return { showErrors, root, flag };
}

/** Wraps a section or table that has to be filled in: a red dashed outline and a warning while `error` is set. */
export function Flag({ error, children, className }: { error?: string | false; children: ReactNode; className?: string }) {
  return (
    <div data-invalid={error ? "" : undefined} className={cn(error && "rounded-lg border-2 border-dashed border-red-500 bg-red-50/30 p-3 dark:bg-red-950/20", className)}>
      {children}
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
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
