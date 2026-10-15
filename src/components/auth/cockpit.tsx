"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useTransform, type MotionValue, type Variants } from "framer-motion";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { watermarkMask } from "./auth-kit";
import { useSettings } from "@/store/settings-store";

export const MAX_RPM = 12;

/** Spring used for every reveal on the sign-in screen. */
export const REVEAL = { type: "spring", stiffness: 260, damping: 20 } as const;
export const revealContainer = (delay: number): Variants => ({ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: delay } } });
export const revealItem: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: REVEAL } };

/* ───────── Backdrop ───────── */

/**
 * Racing-navy night (or crisp silver day) with a track surface running to the horizon. The Yamaha mark sits
 * in the layout with a backlight that brightens as the engine revs.
 */
export function CockpitBackground({ rpm, fast }: { rpm: MotionValue<number>; fast: boolean }) {
  const backlight = useTransform(rpm, (v) => 0.16 + (v / MAX_RPM) * 0.7);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden" style={{ ["--grid-dur" as string]: fast ? "0.45s" : "7s" }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(0,51,153,0.1),transparent_70%)] dark:bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(0,51,153,0.5),transparent_70%)]" />
      <motion.div className="absolute -top-28 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl dark:bg-blue-500/20" animate={{ x: ["-15vw", "70vw", "-15vw"] }} transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }} />

      {/* horizon + track */}
      <div className="absolute inset-x-0 top-[60%] h-px bg-gradient-to-r from-transparent via-sky-500/70 to-transparent shadow-[0_0_34px_8px_rgba(56,189,248,0.3)]" />
      <div className="absolute inset-x-0 bottom-0 top-[60%] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent_96%)]">
        <div className="horizon-grid absolute -inset-x-[70%] bottom-[-30%] top-0 [transform-origin:50%_0] [transform:perspective(420px)_rotateX(68deg)]" />
      </div>

      {/* watermark, backlit */}
      <div className="absolute left-1/2 top-[44%] aspect-[735/306] w-[min(940px,135vw)] -translate-x-1/2 -translate-y-1/2">
        <motion.div style={{ opacity: backlight }} className="absolute -inset-[20%] rounded-full bg-[radial-gradient(ellipse,rgba(37,99,235,0.55),transparent_66%)] opacity-60 blur-2xl dark:opacity-100" />
        <div className="absolute inset-0 bg-[#003399] opacity-[0.06] dark:bg-white dark:opacity-[0.07]" style={watermarkMask} />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(148,163,184,0.35)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(2,4,12,0.75)_100%)]" />
    </div>
  );
}

/* ───────── Shift lights ───────── */

const LEDS = 12;
const ledTone = (i: number) => (i < 7 ? "bg-sky-400 shadow-[0_0_10px_2px_rgba(56,189,248,0.85)]" : i < 10 ? "bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.9)]" : "bg-[#E60012] shadow-[0_0_12px_3px_rgba(230,0,18,0.95)]");

function Led({ i, rpm }: { i: number; rpm: MotionValue<number> }) {
  const opacity = useTransform(rpm, (v) => 0.16 + 0.84 * Math.min(1, Math.max(0, (v - (i + 0.5)) / 0.5)));
  return <motion.span style={{ opacity }} className={cn("h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5", ledTone(i))} />;
}

/** A row of LEDs that fill with engine speed; at the peak the whole bar blinks amber. */
export function ShiftLights({ rpm, flash }: { rpm: MotionValue<number>; flash: boolean }) {
  return (
    <div className="relative flex items-center justify-between gap-1" aria-hidden>
      {Array.from({ length: LEDS }, (_, i) => (
        <Led key={i} i={i} rpm={rpm} />
      ))}
      <AnimatePresence>
        {flash && (
          <motion.div key="flash" className="absolute inset-0 flex items-center justify-between gap-1" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.1, 1, 0.1, 1] }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            {Array.from({ length: LEDS }, (_, i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_4px_rgba(251,191,36,0.95)] sm:h-2.5 sm:w-2.5" />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────── TFT tachometer ───────── */

const CX = 160;
const CY = 152;
const R = 118;
/** From here up the arc and the shift lights glow Yamaha red. */
const REDLINE = 9;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pt = (t: number, r: number) => {
  const a = Math.PI - (t / MAX_RPM) * Math.PI;
  // Rounded so the server-rendered and client-rendered SVG match exactly (no hydration mismatch).
  return { x: Math.round((CX + r * Math.cos(a)) * 100) / 100, y: Math.round((CY - r * Math.sin(a)) * 100) / 100 };
};
const REDLINE_START = pt(REDLINE, R);
const ARC_END = pt(MAX_RPM, R);

/**
 * Arc tachometer, fully drawn: a swept progress arc, 0–12 scale, needle, a red zone from 9,000 RPM that
 * lights up as the needle enters it, a live digital RPM / speed readout and the gear.
 */
/** The current time, ticking every second. Null until mounted, so the server and first client render agree. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

export function TftTach({ rpm, gear }: { rpm: MotionValue<number>; gear: string }) {
  // The rev-down spring overshoots; a running engine never reads below a stumble of ~800 RPM or past the 12k stop.
  const safe = useTransform(rpm, (v) => Math.min(MAX_RPM, Math.max(0.8, v)));
  const progress = useTransform(safe, (v) => v / MAX_RPM);
  const needle = useTransform(safe, (v) => -90 + (v / MAX_RPM) * 180);
  const now = useNow();
  // The digital cluster doubles as the dashboard clock and calendar: HH:MM with a blinking colon, AM/PM, and the date.
  const parts = now ? new Date(now).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).match(/(\d+):(\d+)\s*(AM|PM)/i) : null;
  const dateText = now ? `${String(now.getDate()).padStart(2, "0")} ${now.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}` : "-- ---";
  const redLit = useTransform(safe, (v) => clamp01((v - REDLINE) / (MAX_RPM - REDLINE)));
  const redOpacity = useTransform(redLit, (l) => 0.4 + 0.6 * l);
  const redGlow = useTransform(redLit, (l) => l * 0.9);
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const redArc = `M ${REDLINE_START.x} ${REDLINE_START.y} A ${R} ${R} 0 0 1 ${ARC_END.x} ${ARC_END.y}`;

  return (
    <div aria-hidden>
      <svg viewBox="0 0 320 176" className="mx-auto w-full max-w-[340px] md:max-w-[400px]">
        <defs>
          <linearGradient id="tft-grad" gradientUnits="userSpaceOnUse" x1={CX - R} y1="0" x2={CX + R} y2="0">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.5" stopColor="#2563eb" />
            <stop offset="0.74" stopColor="#3b4fd6" />
            <stop offset="1" stopColor="#3b4fd6" />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-slate-300 dark:stroke-slate-700" />
        <motion.path d={arc} fill="none" stroke="url(#tft-grad)" strokeWidth="14" strokeLinecap="round" style={{ pathLength: progress }} className="opacity-25 blur-[6px]" />
        <motion.path d={arc} fill="none" stroke="url(#tft-grad)" strokeWidth="8" strokeLinecap="round" style={{ pathLength: progress }} />
        {/* red zone: dim until the needle gets there, then it burns */}
        <motion.path d={redArc} fill="none" stroke="#E60012" strokeWidth="8" strokeLinecap="round" style={{ opacity: redOpacity }} />
        <motion.path d={redArc} fill="none" stroke="#ff2a3a" strokeWidth="16" strokeLinecap="round" style={{ opacity: redGlow }} className="blur-[7px]" />
        {Array.from({ length: MAX_RPM + 1 }, (_, i) => {
          const major = i % 2 === 0;
          const a = pt(i, R + 11);
          const b = pt(i, R + (major ? 23 : 18));
          const l = pt(i, R - 20);
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={major ? 2.2 : 1.4} strokeLinecap="round" className={i >= REDLINE ? "stroke-[#E60012]" : "stroke-slate-600 dark:stroke-slate-300"} />
              {major && (
                <text x={l.x} y={l.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="600" fontFamily="ui-monospace,monospace" className={i >= REDLINE ? "fill-[#E60012]" : "fill-slate-800 dark:fill-slate-100"}>
                  {i}
                </text>
              )}
            </g>
          );
        })}
        <motion.g style={{ rotate: needle, originX: 0.5, originY: 0.934 }}>
          <path d={`M ${CX} ${CY + 7} L ${CX} 52`} strokeWidth="3.4" strokeLinecap="round" className="stroke-slate-900 dark:stroke-white" />
          <path d={`M ${CX} 66 L ${CX} 52`} strokeWidth="3.8" strokeLinecap="round" stroke="#E60012" />
          <circle cx={CX} cy={CY} r="8" className="fill-slate-900 dark:fill-white" />
          <circle cx={CX} cy={CY} r="3.2" fill="#2563eb" />
        </motion.g>
      </svg>

      <div className="-mt-1 flex items-end justify-center gap-5">
        <div className="text-center leading-none">
          <span className="flex items-baseline justify-center gap-1.5 font-mono font-semibold text-slate-900 tabular-nums dark:text-white">
            <span className="text-[34px] tracking-[0.06em] md:text-[38px]">
              {parts ? parts[1] : "--"}
              <span className="mx-[1px] inline-block animate-pulse text-sky-600 dark:text-sky-300">:</span>
              {parts ? parts[2] : "--"}
            </span>
            <span className="text-[12px] font-bold tracking-widest text-sky-700 dark:text-sky-300">{parts ? parts[3].toUpperCase() : "--"}</span>
          </span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.28em] text-slate-600 dark:text-slate-300">TIME</span>
        </div>
        <div className="text-center leading-none">
          <span className="font-mono text-[22px] font-semibold tracking-wider text-sky-700 tabular-nums dark:text-sky-300">{dateText}</span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.28em] text-slate-600 dark:text-slate-300">DATE</span>
        </div>
        <div className="grid h-11 w-10 place-items-center rounded-md border border-sky-500/50 bg-sky-500/10 text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={gear} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 28 }} className="font-mono text-[22px] font-bold leading-none text-sky-700 dark:text-sky-300">
              {gear}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ───────── Greeting + live clock ───────── */

/** Good Morning 4:00–11:59, Afternoon 12:00–16:59, Evening 17:00–23:59, and Good Night in the small hours. */
export function greetingFor(d: Date) {
  const h = d.getHours();
  return h >= 4 && h < 12 ? "Good Morning" : h >= 12 && h < 17 ? "Good Afternoon" : h >= 17 ? "Good Evening" : "Good Night";
}

/** Time-of-day greeting. Renders nothing until mounted, so it never mismatches the server. (The clock lives in the tachometer.) */
export function GreetingClock() {
  const now = useNow();
  return (
    <div className="mt-4 h-11 text-center">
      {now && (
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={REVEAL} className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 bg-clip-text pb-1 text-3xl font-extrabold leading-10 tracking-tight text-transparent dark:from-white dark:via-blue-200 dark:to-slate-300 md:text-4xl">
          {greetingFor(now)}
        </motion.h1>
      )}
    </div>
  );
}

/* ───────── Logo ───────── */

const LOGO_MASK = "url(/images/vijayagiri-logo.png)";

/**
 * The official Vijayagiri Auto Agencies logo with its bike emblem, on a transparent background and at its
 * natural proportions. The artwork is dark brand-blue, which disappears on a navy canvas, so in dark mode the
 * same transparent artwork is shown reversed to a light tint (a standard reversed-logo treatment).
 */
export function CockpitLogo() {
  const { legalName, logoLight, logoDark } = useSettings((st) => st.settings.profile);
  const custom = logoLight || logoDark;
  return (
    <div className="relative mx-auto aspect-[1199/460] w-[200px] md:w-[230px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoLight ?? "/images/vijayagiri-logo.png"} alt={legalName} width={1199} height={460} draggable={false} className="absolute inset-0 h-full w-full select-none object-contain dark:hidden" />
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoDark ?? logoLight ?? ""} alt={legalName} draggable={false} className={cn("absolute inset-0 hidden h-full w-full select-none object-contain dark:block", !logoDark && "brightness-0 invert")} />
      ) : (
        <div role="img" aria-label={legalName} className="absolute inset-0 hidden bg-[#E6EEFF] drop-shadow-[0_0_14px_rgba(125,170,255,0.35)] dark:block" style={{ WebkitMaskImage: LOGO_MASK, maskImage: LOGO_MASK, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
      )}
    </div>
  );
}

/* ───────── Form fields ───────── */

/** Label above every field: bold and high-contrast. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">{children}</span>;
}

/** Solid input surface: white with a sharp slate border by day, rich dark by night; Racing Blue ring on focus. */
export const telemetryInputCls =
  "h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-[16px] font-medium text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus-visible:!border-blue-500 sm:text-[15px] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600";

export function TelemetryField({ label, icon, error, trailing, children }: { label: string; icon: ReactNode; error?: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="group block">
        <FieldLabel>{label}</FieldLabel>
        <span className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-600 dark:text-slate-400 dark:group-focus-within:text-blue-400">{icon}</span>
          {children}
          {trailing}
        </span>
      </label>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-1 text-[12px] font-medium text-red-600 dark:text-red-400">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TelemetryPassword({ value, onChange, error, label = "Password", autoComplete = "current-password", placeholder = "••••••••" }: { value: string; onChange: (v: string) => void; error?: string; label?: string; autoComplete?: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <TelemetryField
      label={label}
      icon={<Lock className="h-4 w-4" />}
      error={error}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-500 outline-none transition-colors hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-slate-400 dark:hover:text-blue-400">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={show ? "off" : "on"} initial={{ scale: 0.5, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 30 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
        </button>
      }
    >
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={!!error} className={cn(telemetryInputCls, "pr-12", error && "!border-red-500")} />
    </TelemetryField>
  );
}

/* ───────── Launch control ───────── */

export type LaunchStage = "idle" | "rev" | "launch";
const BAR = 26;

/** Sign-in button. At launch it turns into a throttle indicator: the RPM bar shoots into the redline, then "GO!". */
export function LaunchButton({ stage, label = "SIGN IN" }: { stage: LaunchStage; label?: string }) {
  const busy = stage !== "idle";
  return (
    <motion.button
      type="submit"
      disabled={busy}
      whileTap={busy ? undefined : { scale: 0.98 }}
      className={cn(
        "group relative flex h-14 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl text-white outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F1F5F9] disabled:cursor-wait dark:focus-visible:ring-offset-[#050811]",
        stage === "launch" ? "bg-white text-slate-900 shadow-[0_0_40px_8px_rgba(56,189,248,0.7)]" : "bg-gradient-to-r from-[#003399] to-[#0047AB] shadow-[0_10px_30px_-10px_rgba(0,51,153,0.9)] hover:shadow-[0_12px_34px_-8px_rgba(37,99,235,0.95)]",
      )}
    >
      <span className={cn("relative flex h-5 items-center justify-center font-bold", label.length > 14 ? "text-[12px] tracking-[0.1em] sm:text-[13px] sm:tracking-[0.14em]" : "text-[13px] tracking-[0.28em]")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
            {stage === "idle" ? label : stage === "rev" ? "LAUNCH CONTROL" : "GO!"}
          </motion.span>
        </AnimatePresence>
      </span>
      {busy && (
        <span className="flex h-2 w-[78%] items-end justify-between gap-[2px]" aria-hidden>
          {Array.from({ length: BAR }, (_, i) => {
            const red = i >= BAR - 5;
            return <motion.span key={i} className={cn("w-full flex-1 rounded-[1px]", red ? "bg-[#ff3b4a]" : stage === "launch" ? "bg-[#003399]" : "bg-sky-300")} style={{ height: 3 + (i / BAR) * 5 }} initial={{ opacity: 0.12 }} animate={{ opacity: 1 }} transition={{ delay: stage === "rev" ? (i / BAR) * 0.42 : 0, duration: 0.05 }} />;
          })}
        </span>
      )}
    </motion.button>
  );
}

/** Light lines rushing out from the horizon at launch. */
export function LaunchStreaks() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <motion.div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(186,230,253,0.55),rgba(37,99,235,0.2)_40%,transparent_70%)]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.8] }} transition={{ duration: 0.5 }} />
      {Array.from({ length: 18 }, (_, i) => {
        const angle = -85 + (i / 17) * 170;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-[58%] h-[2px] origin-left rounded-full bg-gradient-to-r from-white via-sky-300 to-transparent"
            style={{ rotate: angle, width: 0 }}
            animate={{ width: ["0vmax", "90vmax"], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, delay: (i % 6) * 0.03, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}
