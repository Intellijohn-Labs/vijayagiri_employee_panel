"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/store/settings-store";
import { cn } from "@/lib/utils";

/** "idle" while the form can be used; "launch" once someone is signed in and the portal is opening. */
export type AuthStage = "idle" | "launch";

export const REVEAL = { type: "spring", stiffness: 260, damping: 24 } as const;
export const stepMotion = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: REVEAL }, exit: { opacity: 0, y: -8, transition: { duration: 0.12 } } };

/** Shared text-link style (Forgot password, Back to sign in, …). */
export const linkCls = "rounded py-2 text-[13px] font-medium text-slate-500 underline-offset-4 outline-none transition-colors hover:text-[#0020B2] hover:underline focus-visible:ring-2 focus-visible:ring-[#0020B2]/40 dark:text-slate-400 dark:hover:text-sky-300";

/* ───────── Ambient background ───────── */

/* ───────── Brand ───────── */

const LOGO_MASK = "url(/images/vijayagiri-logo.png)";

/**
 * The Vijayagiri Auto Agencies logo. The artwork is dark brand-blue, so by night the same transparent artwork is
 * shown reversed to a light tint; a logo uploaded in Settings is used as-is.
 */
export function BrandLogo({ className, onDark }: { className?: string; /** Always show the light, reversed artwork (for a dark panel whatever the theme) */ onDark?: boolean }) {
  const { legalName, logoLight, logoDark } = useSettings((st) => st.settings.profile);
  const custom = logoLight || logoDark;
  return (
    <div className={cn("relative mx-auto aspect-[1199/460] w-[190px] sm:w-[220px]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoLight ?? "/images/vijayagiri-logo.png"} alt={legalName} width={1199} height={460} draggable={false} className={cn("absolute inset-0 h-full w-full select-none object-contain", onDark ? "hidden" : "dark:hidden")} />
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoDark ?? logoLight ?? ""} alt={legalName} draggable={false} className={cn("absolute inset-0 hidden h-full w-full select-none object-contain", onDark ? "!block" : "dark:block", !logoDark && "brightness-0 invert")} />
      ) : (
        <div role="img" aria-label={legalName} className={cn("absolute inset-0 hidden bg-[#E6EEFF]", onDark ? "!block" : "dark:block")} style={{ WebkitMaskImage: LOGO_MASK, maskImage: LOGO_MASK, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
      )}
    </div>
  );
}

/* ───────── Inputs ───────── */

const inputCls =
  "peer h-12 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-3 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0020B2] focus:ring-4 focus:ring-[#0020B2]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500 dark:hover:border-white/20 dark:focus:border-sky-400 dark:focus:ring-sky-400/15";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  trailing?: ReactNode;
}

/** Labelled text field with a clean leading icon and an inline error under it. */
export function AuthField({ label, icon, value, onChange, error, trailing, className, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#0020B2] dark:group-focus-within:text-sky-300">{icon}</span>
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className={cn(inputCls, trailing ? "pr-12" : undefined, error && "!border-red-500 focus:!ring-red-500/15", className)} {...rest} />
        {trailing}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p id={`${id}-err`} role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-1.5 text-[12.5px] font-medium text-red-600 dark:text-red-400">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Password field with a show/hide eye toggle. */
export function PasswordField({ label = "Password", autoComplete = "current-password", ...rest }: Omit<FieldProps, "icon" | "trailing" | "type" | "label"> & { label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <AuthField
      {...rest}
      label={label}
      autoComplete={autoComplete}
      type={show ? "text" : "password"}
      icon={<Lock className="h-[18px] w-[18px]" />}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-400 outline-none transition-colors hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#0020B2]/40 dark:hover:text-white">
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      }
    />
  );
}

/* ───────── Button ───────── */

/**
 * Solid Racing Blue action. While the credentials are checked it shows a spinner. Once they are accepted (`stage` is "launch")
 * it shrinks into a glowing round button with a pulse ring and a checkmark that draws itself.
 */
export function SubmitButton({ label, busyLabel = "Signing in…", loading, stage }: { label: string; busyLabel?: string; loading?: boolean; stage: AuthStage }) {
  const done = stage === "launch";
  return (
    <div className="flex justify-center">
      <button
        type="submit"
        disabled={loading || done}
        aria-label={done ? "Access verified" : undefined}
        style={{ width: done ? 56 : "100%", borderRadius: done ? 28 : 8 }}
        className={cn(
          "group relative flex h-12 items-center justify-center gap-2 bg-[#0020B2] text-[15px] font-semibold text-white outline-none transition-[width,border-radius,box-shadow,background-color] duration-[400ms] ease-out hover:bg-[#0a2fcf] focus-visible:ring-4 focus-visible:ring-[#0020B2]/30 active:bg-[#001a94] disabled:cursor-default",
          done ? "h-14 !bg-[#0020B2] shadow-[0_0_0_4px_rgba(0,80,255,0.2),0_0_36px_rgba(0,80,255,0.65)]" : loading && "cursor-wait opacity-90",
        )}
      >
        {done ? (
          <>
            <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-[#0050FF]" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.8, repeat: 1, ease: "easeOut" }} />
            <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" }} />
            </svg>
          </>
        ) : loading ? (
          <>
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
            {busyLabel}
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="h-[18px] w-[18px] transition-transform duration-150 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  );
}
