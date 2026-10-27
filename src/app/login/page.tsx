"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ArrowRight, CircleHelp, Mail, Moon, Sun } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useTheme } from "@/store/theme-store";
import { toast } from "@/store/toast-store";
import { HQ_ID } from "@/lib/branches";
import { useBranchTools } from "@/store/branch-store";
import { Popover } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/primitives";
import { ActivationFlow } from "@/components/auth/activation";
import { PasscodeStep } from "@/components/auth/passcode";
import { useSettings } from "@/store/settings-store";
import { sfx } from "@/lib/sound";
import { forgotPassword, loadRemembered, saveRemembered } from "@/components/auth/auth-kit";
import { ACCESS_DENIED, authenticate, useEmployees, type Employee } from "@/store/employee-store";
import { CockpitBackground, CockpitLogo, GreetingClock, LaunchButton, LaunchStreaks, ShiftLights, TelemetryField, TelemetryPassword, TftTach, revealContainer, revealItem, telemetryInputCls, type LaunchStage } from "@/components/auth/cockpit";

const BOOT_TEXT = "VIJAYAGIRI OPS SYSTEM READY";
const MAX = 12;
/** Engine at rest: a faint tremble around 1,300 RPM. */
const IDLE_RPM = [1.3, 1.37, 1.28, 1.4, 1.31, 1.38, 1.3];
/** Throttle level (thousands of RPM) for a given number of characters typed so far — climbs ~2k → 4k → 7k → 10k. */
const THROTTLE: [number, number][] = [[0, 1.4], [3, 2], [8, 4], [14, 7], [22, 10], [30, 11.6]];
const levelFor = (chars: number) => {
  for (let i = 1; i < THROTTLE.length; i++) {
    const [c1, r1] = THROTTLE[i];
    if (chars <= c1) {
      const [c0, r0] = THROTTLE[i - 1];
      return r0 + ((chars - c0) / (c1 - c0)) * (r1 - r0);
    }
  }
  return THROTTLE[THROTTLE.length - 1][1];
};
const gearFor = (level: number) => (level < 1.8 ? "N" : level < 4 ? "1" : level < 6.5 ? "2" : level < 9 ? "3" : "4");

const utilityBtn = "grid h-9 w-9 place-items-center rounded-full border border-slate-300/80 bg-white/60 text-slate-600 outline-none backdrop-blur transition-colors duration-300 hover:bg-white hover:text-[#003399] focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white";

/** Theme toggle and help. */
function Utilities() {
  const { theme, toggle } = useTheme();
  const { byId: branchById } = useBranchTools();
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={utilityBtn}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme} initial={{ rotate: -60, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 60, opacity: 0, scale: 0.6 }} transition={{ duration: 0.18 }}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
      <Popover
        align="end"
        width={300}
        trigger={({ toggle: t }) => (
          <button onClick={t} aria-label="Help" className={utilityBtn}>
            <CircleHelp className="h-4 w-4" />
          </button>
        )}
      >
        {() => (
          <div className="space-y-2 p-3 text-[12.5px] leading-5 text-muted">
            <p className="text-[13px] font-semibold text-fg">Need a hand signing in?</p>
            <p>Sign in with the official email address (or employee ID) registered for you in the Employee Directory.</p>
            <p>First time here? Choose “Activate your account” and set a password. Your Admin must have added your email first.</p>
            <p className="rounded-md bg-tint px-2.5 py-2 text-accent-text">Locked out? Contact Central Admin at Head Office: {branchById(HQ_ID)?.manager} · {branchById(HQ_ID)?.phone.split(" / ")[0]}</p>
          </div>
        )}
      </Popover>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const rpm = useMotionValue(0);
  const typed = useMotionValue(0);
  const typedText = useTransform(typed, (p: number) => BOOT_TEXT.slice(0, Math.round(p * BOOT_TEXT.length)));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState<"signin" | "activate">("signin");
  const [checking, setChecking] = useState(false);
  // Set while an Admin must still enter the passcode from Settings → Security.
  const [gate, setGate] = useState<Employee | null>(null);
  const security = useSettings((s) => s.settings.security);
  const [gear, setGear] = useState("N");
  const [stage, setStage] = useState<LaunchStage>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idle = useRef<{ stop: () => void } | null>(null);
  /** Typing-throttle bookkeeping: `token` invalidates stale follow-up animations, `timer` is the 800 ms rev-down. */
  const tap = useRef<{ token: number; timer: ReturnType<typeof setTimeout> | null; ctl: { stop: () => void } | null }>({ token: 0, timer: null, ctl: null });

  const startIdle = useCallback(() => {
    idle.current = animate(rpm, IDLE_RPM, { duration: 1.1, repeat: Infinity, ease: "easeInOut" });
  }, [rpm]);

  /* Ignition on load: 0 → 12,000 RPM with an amber shift-light blink, then settle to idle. */
  useEffect(() => {
    const t = timers.current;
    const later = (fn: () => void, ms: number) => t.push(setTimeout(fn, ms));
    if (reduced) {
      rpm.set(1.3);
      typed.set(1);
      return () => t.forEach(clearTimeout);
    }
    let cancelled = false;
    const sweep = animate(rpm, [0, 12, 1.3], { duration: 1.2, times: [0, 0.58, 1], ease: ["easeIn", "easeOut"] });
    const type = animate(typed, 1, { duration: 0.9, delay: 0.25, ease: "linear" });
    idle.current = sweep;
    later(() => setFlash(true), 650);
    later(() => setFlash(false), 1100);
    // If typing already took over the needle, leave it alone.
    sweep.then(() => {
      if (!cancelled && tap.current.token === 0) startIdle();
    });
    return () => {
      cancelled = true;
      sweep.stop();
      type.stop();
      idle.current?.stop();
      t.forEach(clearTimeout);
    };
  }, [rpm, typed, reduced, startIdle]);

  useEffect(() => {
    const ref = tap.current;
    return () => {
      if (ref.timer) clearTimeout(ref.timer);
      ref.ctl?.stop();
    };
  }, []);

  useEffect(() => {
    const saved = loadRemembered();
    if (saved) {
      // Restoring a remembered email needs localStorage, which only exists on the client after hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      setEmail(saved);
      setRemember(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  /** When typing stops, the needle falls back to idle on a spring and the engine settles. */
  const settle = useCallback(() => {
    const t = tap.current;
    t.token++;
    const mine = t.token;
    t.ctl?.stop();
    const ctl = animate(rpm, 1.3, { type: "spring", stiffness: 200, damping: 15 });
    t.ctl = ctl;
    setGear("N");
    ctl.then(() => {
      if (tap.current.token === mine) startIdle();
    });
  }, [rpm, startIdle]);

  /** One keystroke: the throttle blips +0.8–1.5k above the level the text length calls for, then springs to that level. */
  const throttle = (chars: number) => {
    if (stage !== "idle") return;
    const level = levelFor(chars);
    if (reduced) {
      rpm.set(level);
      return;
    }
    const t = tap.current;
    t.token++;
    const mine = t.token;
    idle.current?.stop();
    t.ctl?.stop();
    const peak = Math.min(MAX, level + 0.8 + Math.random() * 0.7);
    sfx.blip();
    setGear(gearFor(level));
    const up = animate(rpm, peak, { duration: 0.07, ease: "easeOut" });
    t.ctl = up;
    up.then(() => {
      if (tap.current.token === mine) tap.current.ctl = animate(rpm, level, { type: "spring", stiffness: 200, damping: 15 });
    });
    if (t.timer) clearTimeout(t.timer);
    t.timer = setTimeout(settle, 800);
  };

  /**
   * Launch control. Stage 1 (0.5s): the button becomes a throttle indicator and the RPM bar shoots to the redline.
   * Stage 2 (0.55s): "GO!" — shift lights flash, the track speeds up, light streams out of the horizon.
   * Then the portal opens for the employee who signed in.
   */
  const enter = (who: Employee) => {
    const t = tap.current;
    if (t.timer) clearTimeout(t.timer);
    t.token++;
    t.ctl?.stop();
    idle.current?.stop();
    setStage("rev");
    setGear("1");
    sfx.launch();
    animate(rpm, 12, { duration: 0.5, ease: "easeIn" });
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
    later(() => setGear("2"), 250);
    later(() => {
      setStage("launch");
      setFlash(true);
      setGear("3");
    }, 500);
    later(() => {
      // Central admins start on the whole network; someone limited to one showroom lands on that showroom.
      const scope = who.access !== "all" && who.access.length === 1 ? who.access[0] : "all";
      useEmployees.getState().signIn(who);
      useApp.getState().setBranchScope(scope, { silent: true });
      router.push("/branches");
      toast.success(`Welcome back, ${who.name.split(" ")[0]}`, `Signed in as ${who.role}`);
    }, 1050);
  };

  const submit = async () => {
    if (stage !== "idle" || checking) return;
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "Enter your work email or employee ID";
    if (!password) e.password = "Enter your password";
    setErrors(e);
    if (Object.keys(e).length) return;
    setChecking(true);
    try {
      // Strict: only an Active, activated employee in the directory who knows the password gets in.
      const auth = await authenticate(email, password);
      if (!auth.ok) {
        setErrors(auth.reason === "wrong-password" ? { password: ACCESS_DENIED[auth.reason] } : { email: ACCESS_DENIED[auth.reason] });
        return;
      }
      saveRemembered(remember ? email.trim() : null);
      proceed(auth.employee);
    } catch (err) {
      setErrors({ password: err instanceof Error ? err.message : "Couldn't verify the password. Please try again." });
    } finally {
      setChecking(false);
    }
  };

  /** Admins go through the passcode first when it is switched on; everyone else launches straight away. */
  const proceed = (who: Employee) => {
    if (who.role === "Admin" && security.passcodeOn && security.passcodeHash) {
      setErrors({});
      setGate(who);
      return;
    }
    enter(who);
  };

  const switchMode = (next: "signin" | "activate") => {
    if (stage !== "idle") return;
    setErrors({});
    setMode(next);
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center overflow-hidden bg-[#F1F5F9] transition-colors duration-300 dark:bg-[#050811]">
      <CockpitBackground rpm={rpm} fast={stage === "launch"} />
      {stage === "launch" && <LaunchStreaks />}

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
        <Utilities />
      </div>

      <motion.div
        animate={stage === "launch" ? { scale: 1.07, opacity: 0, filter: "blur(6px)" } : { scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, delay: stage === "launch" ? 0.12 : 0, ease: "easeIn" }}
        className="relative z-10 mx-auto my-auto w-full max-w-[440px] px-6 pb-8 pt-14 md:max-w-[500px] md:pt-12"
      >
        {/* header: logo, then a time-of-day greeting with a live clock */}
        <div className="flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}>
            <CockpitLogo />
          </motion.div>
          <GreetingClock />
        </div>

        {/* instruments — the needle answers every keystroke */}
        <div className="mt-4">
          <ShiftLights rpm={rpm} flash={flash} />
          <div className="mt-3">
            <TftTach rpm={rpm} gear={gear} />
          </div>
          <p className="mt-2 h-4 text-center font-mono text-[10.5px] tracking-[0.3em] text-slate-500 dark:text-slate-400" aria-live="polite">
            <motion.span>{typedText}</motion.span>
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-sky-500 align-middle" />
          </p>
        </div>

        {/* form */}
        <AnimatePresence mode="wait" initial={false}>
        {gate ? (
          <PasscodeStep key="passcode" who={gate} stage={stage} onType={throttle} onVerified={enter} onBack={() => setGate(null)} />
        ) : mode === "activate" ? (
          <ActivationFlow key="activate" stage={stage} initialEmail={email.includes("@") ? email.trim() : ""} onBack={() => switchMode("signin")} onType={throttle} onActivated={enter} />
        ) : (
        <motion.form key="signin" variants={revealContainer(0.45)} initial="hidden" animate="show" exit={{ opacity: 0, y: -10, transition: { duration: 0.12 } }} noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-5 space-y-4">
          <motion.div variants={revealItem}>
            <TelemetryField label="Employee ID / Work Email" icon={<Mail className="h-4 w-4" />} error={errors.email}>
              <input
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((x) => ({ ...x, email: "" }));
                  throttle(e.target.value.length + password.length);
                }}
                placeholder="e.g. name@vijayagiri.in"
                autoComplete="username"
                spellCheck={false}
                aria-invalid={!!errors.email}
                className={telemetryInputCls}
              />
            </TelemetryField>
          </motion.div>

          <motion.div variants={revealItem}>
            <TelemetryPassword
              value={password}
              onChange={(v) => {
                setPassword(v);
                setErrors((x) => ({ ...x, password: "" }));
                throttle(email.length + v.length);
              }}
              error={errors.password}
            />
          </motion.div>

          <motion.div variants={revealItem} className="flex items-center justify-between pt-1">
            <span className="flex cursor-pointer select-none items-center gap-2 text-[12px] tracking-wide text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={() => setRemember((r) => !r)}>
              <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
              Remember me
            </span>
            <button type="button" onClick={() => forgotPassword(email)} className="-my-2 rounded py-2 text-[12px] font-medium tracking-wide text-sky-700 underline-offset-4 outline-none transition-colors hover:text-sky-500 hover:underline focus-visible:underline dark:text-sky-300 dark:hover:text-sky-200">
              Forgot password?
            </button>
          </motion.div>

          <motion.div variants={revealItem}>
            <LaunchButton stage={stage} />
          </motion.div>

          <motion.div variants={revealItem} className="text-center">
            <button type="button" onClick={() => switchMode("activate")} disabled={stage !== "idle"} className="group inline-flex items-center gap-1.5 rounded py-2 text-[12.5px] tracking-wide text-slate-600 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">
              New employee? <span className="font-semibold text-sky-700 underline-offset-4 group-hover:underline dark:text-sky-300">Activate your account</span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-700 transition-transform group-hover:translate-x-0.5 dark:text-sky-300" />
            </button>
          </motion.div>
        </motion.form>
        )}
        </AnimatePresence>

        {mode === "signin" && !gate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-4 flex flex-col items-center gap-2.5 text-center">
          <p className="max-w-xs text-[11px] leading-4 tracking-wide text-slate-500 dark:text-slate-400">Only employees registered in the directory can sign in.</p>
        </motion.div>
        )}
      </motion.div>
    </div>
  );
}
