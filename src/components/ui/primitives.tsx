"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { springFirm } from "@/lib/motion";

/* ───────── Badge ───────── */
type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-fg/[0.06] text-muted ring-fg/[0.08]",
  accent: "bg-tint text-accent-text ring-accent/20",
  ok: "bg-ok-tint text-ok ring-ok/25",
  warn: "bg-warn-tint text-warn ring-warn/25",
  danger: "bg-danger-tint text-danger ring-danger/25",
  info: "bg-info-tint text-info ring-info/25",
};
export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ───────── Avatar ───────── */
const avatarTones = [
  "bg-blue-600/15 text-blue-800 dark:text-blue-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-slate-500/15 text-slate-700 dark:text-slate-300",
];
export function Avatar({ name, initials, size = 24, className, src }: { name?: string; initials?: string; size?: number; className?: string; src?: string }) {
  const text = initials ?? (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const hash = [...(name ?? text)].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cn("inline-block shrink-0 select-none rounded-full object-cover ring-1 ring-inset ring-fg/10", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-fg/10", avatarTones[hash % avatarTones.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
      aria-hidden
    >
      {text}
    </span>
  );
}

/* ───────── Form controls ───────── */
export function Field({ label, hint, error, children, className, required }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn("block", className)} data-invalid={error ? "" : undefined}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-fg">
        <span>
          {label}
          {required && <span className="ml-0.5 text-accent-text">*</span>}
        </span>
        {hint && <span className="font-normal text-faint">{hint}</span>}
      </span>
      {children}
      {error && (
        <motion.span initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="mt-1 block text-[11.5px] text-danger">
          {error}
        </motion.span>
      )}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode }>(function Input({ className, invalid, leading, ...props }, ref) {
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">{leading}</span>}
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg shadow-card outline-none transition-[border-color,box-shadow,background-color] placeholder:text-faint hover:border-strong disabled:opacity-50",
          leading && "pl-8",
          invalid && "!border-red-500 !bg-red-50/50 focus:!border-red-600 focus:ring-2 focus:ring-red-500/30 dark:!bg-red-950/25",
          className,
        )}
        {...props}
      />
    </div>
  );
});

export function Checkbox({ checked, indeterminate, onChange, label, className, boxClassName }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label?: string; className?: string; /** Extra classes for the box itself */ boxClassName?: string }) {
  const id = useId();
  return (
    <span className={cn("inline-flex items-center", className)}>
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={label ?? "Select"}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={cn(
          "grid h-4 w-4 place-items-center rounded-[4px] border transition-colors",
          checked || indeterminate ? "border-accent bg-accent text-accent-fg" : "border-strong bg-surface hover:border-accent/60",
          boxClassName,
        )}
      >
        <motion.span initial={false} animate={{ scale: checked || indeterminate ? 1 : 0, opacity: checked || indeterminate ? 1 : 0 }} transition={springFirm}>
          {indeterminate ? <Minus className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
        </motion.span>
      </button>
    </span>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("min-h-[76px] w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2 text-[13px] leading-5 text-fg shadow-card outline-none transition-[border-color,box-shadow,background-color] placeholder:text-faint hover:border-strong disabled:opacity-50", invalid && "!border-red-500 !bg-red-50/50 focus:!border-red-600 focus:ring-2 focus:ring-red-500/30 dark:!bg-red-950/25", className)}
      {...props}
    />
  );
});

/* ───────── Surfaces ───────── */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
