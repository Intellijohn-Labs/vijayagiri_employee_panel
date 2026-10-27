"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/store/settings-store";
import { cn } from "@/lib/utils";

/** "idle" while the form can be used; "launch" once someone is signed in and the portal is opening. */
export type AuthStage = "idle" | "launch";

export const REVEAL = { type: "spring", stiffness: 260, damping: 24 } as const;
export const stepMotion = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: REVEAL }, exit: { opacity: 0, y: -8, transition: { duration: 0.12 } } };

/** Shared text-link style (Forgot password, Back to sign in, …). */
export const linkCls = "rounded py-2 text-[12.5px] font-medium text-sky-700 underline-offset-4 outline-none transition-colors hover:text-sky-500 hover:underline focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:text-sky-300 dark:hover:text-sky-200";

/* ───────── Ambient background ───────── */

const blob = "pointer-events-none absolute rounded-full blur-[110px]";

/** Deep slate by night, soft cloud by day, with slow-drifting Racing Blue glows and a faint grid fading out from the centre. */
export function AuthBackground() {
  const reduced = useReducedMotion();
  const drift = (x: number, y: number, s: number, d: number) => (reduced ? {} : { animate: { x: [0, x, 0], y: [0, y, 0], scale: [1, s, 1] }, transition: { duration: d, repeat: Infinity, ease: "easeInOut" as const } });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-slate-50 dark:bg-[#05070d]">
      <motion.div className={cn(blob, "-left-24 -top-32 h-[520px] w-[520px] bg-[#0047AB]/25 dark:bg-[#0047AB]/40")} {...drift(60, 40, 1.12, 18)} />
      <motion.div className={cn(blob, "-bottom-40 -right-20 h-[560px] w-[560px] bg-sky-400/20 dark:bg-[#003399]/45")} {...drift(-50, -30, 1.1, 22)} />
      <motion.div className={cn(blob, "left-1/2 top-1/3 h-[320px] w-[320px] -translate-x-1/2 bg-blue-500/10 dark:bg-blue-500/15")} {...drift(30, -40, 1.18, 16)} />
      <div
        className="absolute inset-0 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(100,116,139,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.14) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 45%, #000 20%, transparent 75%)",
          maskImage: "radial-gradient(ellipse 60% 55% at 50% 45%, #000 20%, transparent 75%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
    </div>
  );
}

/* ───────── Brand ───────── */

const LOGO_MASK = "url(/images/vijayagiri-logo.png)";

/**
 * The Vijayagiri Auto Agencies logo. The artwork is dark brand-blue, so by night the same transparent artwork is
 * shown reversed to a light tint; a logo uploaded in Settings is used as-is.
 */
export function BrandLogo({ className }: { className?: string }) {
  const { legalName, logoLight, logoDark } = useSettings((st) => st.settings.profile);
  const custom = logoLight || logoDark;
  return (
    <div className={cn("relative mx-auto aspect-[1199/460] w-[190px] sm:w-[220px]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoLight ?? "/images/vijayagiri-logo.png"} alt={legalName} width={1199} height={460} draggable={false} className="absolute inset-0 h-full w-full select-none object-contain dark:hidden" />
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoDark ?? logoLight ?? ""} alt={legalName} draggable={false} className={cn("absolute inset-0 hidden h-full w-full select-none object-contain dark:block", !logoDark && "brightness-0 invert")} />
      ) : (
        <div role="img" aria-label={legalName} className="absolute inset-0 hidden bg-[#E6EEFF] drop-shadow-[0_0_18px_rgba(96,165,250,0.4)] dark:block" style={{ WebkitMaskImage: LOGO_MASK, maskImage: LOGO_MASK, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
      )}
    </div>
  );
}

/* ───────── Inputs ───────── */

const inputCls =
  "peer h-14 w-full rounded-xl border border-slate-300 bg-white/90 pb-1.5 pl-11 pr-3 pt-5 text-[16px] font-medium text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 sm:text-[15px] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-white/20 dark:focus:border-sky-400/70 dark:focus:bg-white/[0.07] dark:focus:ring-sky-400/15";

const labelCls =
  "pointer-events-none absolute left-11 top-1/2 origin-left -translate-y-1/2 text-[14px] text-slate-500 transition-all duration-200 peer-focus:top-[13px] peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-[13px] peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium dark:text-slate-400 dark:peer-focus:text-sky-300";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  trailing?: ReactNode;
}

/** Text field with a floating label, a leading icon and an inline error that slides in under it. */
export function AuthField({ label, icon, value, onChange, error, trailing, className, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div>
      <div className="group relative">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-blue-600 dark:text-slate-500 dark:group-focus-within:text-sky-300">{icon}</span>
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className={cn(inputCls, trailing ? "pr-12" : undefined, error && "!border-red-500/80 focus:!ring-red-500/20", className)} {...rest} />
        <label htmlFor={id} className={cn(labelCls, error && "!text-red-500")}>
          {label}
        </label>
        {trailing}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p id={`${id}-err`} role="alert" initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pl-1 pt-1.5 text-[12px] font-medium text-red-600 dark:text-red-400">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Password field with a show/hide toggle whose icon swaps with a small spring. */
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
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-400 outline-none transition-colors hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:hover:text-sky-300">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={show ? "hide" : "show"} initial={{ scale: 0.5, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 40 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}>
              {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      }
    />
  );
}

/* ───────── Button ───────── */

/** Primary action: Racing Blue gradient that glows on hover, shows a spinner while working and a tick once signed in. */
export function SubmitButton({ label, busyLabel = "Verifying…", loading, stage }: { label: string; busyLabel?: string; loading?: boolean; stage: AuthStage }) {
  const launching = stage === "launch";
  const text = launching ? "Welcome — opening portal…" : loading ? busyLabel : label;
  return (
    <motion.button
      type="submit"
      disabled={loading || launching}
      whileHover={loading || launching ? undefined : { scale: 1.015 }}
      whileTap={loading || launching ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="group relative flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#003399] via-[#0a47b8] to-[#1d63e0] text-[14px] font-semibold tracking-wide text-white shadow-[0_12px_32px_-12px_rgba(0,71,171,0.95)] outline-none transition-shadow duration-300 hover:shadow-[0_16px_42px_-10px_rgba(37,99,235,0.95)] focus-visible:ring-4 focus-visible:ring-sky-400/40 disabled:cursor-wait"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="relative flex items-center gap-2.5">
          {(loading || launching) && <Loader2 className="h-[18px] w-[18px] animate-spin" />}
          {text}
          {!loading && !launching && <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-1" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
