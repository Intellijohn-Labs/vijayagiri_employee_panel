"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CircleHelp, Mail, Moon, ShieldAlert, SunMedium, X } from "lucide-react";
import { useApp } from "@/store/app-store";
import { HQ_ID } from "@/lib/branches";
import { useTheme } from "@/store/theme-store";
import { useBranchTools } from "@/store/branch-store";
import { Popover } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/primitives";
import { ActivationFlow } from "@/components/auth/activation";
import { ForgotPassword } from "@/components/auth/forgot-password";
import { PasscodeStep } from "@/components/auth/passcode";
import { AmbientBackground } from "@/components/auth/ambient-background";
import { AuthField, BrandLogo, PasswordField, SubmitButton, linkCls, stepMotion, type AuthStage } from "@/components/auth/auth-ui";
import { useSettings } from "@/store/settings-store";
import { loadRemembered, saveRemembered } from "@/components/auth/auth-kit";
import { ACCESS_DENIED, authenticate, useEmployees, type Employee } from "@/store/employee-store";

const utilityBtn = "grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm outline-none backdrop-blur transition-colors hover:text-[#0020B2] focus-visible:ring-2 focus-visible:ring-[#0020B2]/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:shadow-none dark:hover:text-white dark:focus-visible:ring-sky-400/60";

/** Light / dark toggle (remembered in this browser) and help. */
function Utilities() {
  const { theme, toggle } = useTheme();
  const { byId: branchById } = useBranchTools();
  return (
    <div className="flex items-center gap-1.5">
      <motion.button type="button" onClick={toggle} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88, rotate: 25 }} transition={{ type: "spring", stiffness: 420, damping: 20 }} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={utilityBtn}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme} initial={{ rotate: -90, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0.4, opacity: 0 }} transition={{ duration: 0.2 }} className="grid place-items-center">
            {theme === "dark" ? <SunMedium className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <Popover
        align="end"
        width={300}
        trigger={({ toggle: t }) => (
          <button type="button" onClick={t} aria-label="Help" className={utilityBtn}>
            <CircleHelp className="h-4 w-4" />
          </button>
        )}
      >
        {() => (
          <div className="space-y-2 p-3 text-[12.5px] leading-5 text-muted">
            <p className="text-[13px] font-semibold text-fg">Need a hand signing in?</p>
            <p>Sign in with the official email address or mobile number registered for you in the Employee Directory.</p>
            <p>First time here? Choose “Activate your account” and set a password. Your Admin must have added your email and phone first.</p>
            <p className="rounded-md bg-tint px-2.5 py-2 text-accent-text">Locked out? Contact Central Admin at Head Office: {branchById(HQ_ID)?.manager} · {branchById(HQ_ID)?.phone.split(" / ")[0]}</p>
          </div>
        )}
      </Popover>
    </div>
  );
}

/** A mobile number typed any usual way: +91 / 0 prefix, spaces, dashes or brackets, ending up as 10 digits. */
const mobileOk = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10;
};

type Notice = { tone: "error" | "warn"; title: string; text: string };


/** Dismissible banner for lockouts and other problems that aren't about one field. */
function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const warn = notice.tone === "warn";
  const Icon = warn ? ShieldAlert : AlertTriangle;
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, height: 0, y: -6 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className={`mb-4 flex items-start gap-3 rounded-xl border p-3.5 ${warn ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100" : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100"}`}>
        <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${warn ? "text-amber-600 dark:text-amber-300" : "text-red-600 dark:text-red-300"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-5">{notice.title}</p>
          <p className="text-[12.5px] leading-5 opacity-90">{notice.text}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current">
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

const clockFormat = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
/**
 * The logo as a coin: tapping it flips it round to show a live digital clock, and after 3 seconds it flips back. Kept in its
 * own component so the ticking clock re-renders only this, not the sign-in form.
 */
function SplitLogo() {
  const [isLogoFlipped, setIsLogoFlipped] = useState(false);
  const [time, setTime] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While the clock face is showing it ticks every second.
  useEffect(() => {
    if (!isLogoFlipped) return;
    const id = setInterval(() => setTime(clockFormat.format(new Date())), 1000);
    return () => clearInterval(id);
  }, [isLogoFlipped]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flip = () => {
    setTime(clockFormat.format(new Date()));
    setIsLogoFlipped(true);
    // Tapping again while the clock shows just restarts the 3 seconds.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsLogoFlipped(false), 3000);
  };

  return (
    <button type="button" onClick={flip} aria-label="Vijayagiri — tap to show the time" className="block w-fit cursor-pointer rounded-md outline-none [perspective:600px] focus-visible:ring-2 focus-visible:ring-sky-400/60">
      <span className={`grid [transform-style:preserve-3d] transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${isLogoFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
        {/* front: the emblem */}
        <span aria-hidden={isLogoFlipped} className="block [backface-visibility:hidden] [grid-area:1/1]">
          <BrandLogo className="w-[210px] sm:w-[240px]" />
        </span>
        {/* back: the clock, like a small digital gauge */}
        <span aria-hidden={!isLogoFlipped} className="grid place-items-center [backface-visibility:hidden] [grid-area:1/1] [transform:rotateY(180deg)]">
          <span role="timer" className="whitespace-nowrap rounded-full border border-cyan-400/30 bg-[#05070d] px-5 py-2.5 font-mono text-xs font-semibold tracking-widest text-cyan-300 shadow-[inset_0_0_14px_rgba(0,80,255,0.35),0_0_24px_rgba(0,80,255,0.35)] [text-shadow:0_0_12px_rgba(34,211,238,0.85)] sm:text-sm">
            {time}
          </span>
        </span>
      </span>
    </button>
  );
}

/** A soft blue and cyan ring of light that sweeps out from the card across the whole screen. GPU-only: just a scale and a fade. */
function Shockwave() {
  return (
    <motion.div
      aria-hidden
      initial={{ scale: 0.04, opacity: 0.95 }}
      animate={{ scale: 1, opacity: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="pointer-events-none absolute left-1/2 top-1/2 -ml-[80vmax] -mt-[80vmax] h-[160vmax] w-[160vmax] rounded-full will-change-transform"
      style={{ background: "radial-gradient(circle, transparent 36%, rgba(0,80,255,0.22) 43%, rgba(34,211,238,0.38) 48%, rgba(0,102,255,0.2) 53%, transparent 60%)" }}
    />
  );
}

/** Status badge that slides up from under the card once the identity is accepted. */
function HudBadge() {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="absolute left-1/2 top-full z-10 mt-4 -translate-x-1/2 whitespace-nowrap will-change-transform" role="status">
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-zinc-950/90 px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-blue-400 shadow-[0_0_24px_rgba(0,102,255,0.45)] [text-shadow:0_0_10px_rgba(96,165,250,0.8)] sm:text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
        Identity verified • Access granted
      </span>
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Unlock sequence: "check" 0–400 ms, "verify" 400–900 ms, "out" 900–1400 ms. */
  const [phase, setPhase] = useState<"idle" | "check" | "verify" | "out">("idle");
  const legalName = useSettings((s) => s.settings.profile.legalName);
  const security = useSettings((s) => s.settings.security);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  /** The card's views: "signin" is the front; "activate" and "forgot" share the back. */
  const [isFlipped, setIsFlipped] = useState(false);
  const [backView, setBackView] = useState<"activate" | "forgot">("activate");
  /** Bumped each time the back is opened, so it always starts as a fresh form. */
  const [backKey, setBackKey] = useState(0);
  const view: "signin" | "activate" | "forgot" = isFlipped ? backView : "signin";
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<AuthStage>("idle");
  // Set while an Admin must still enter the passcode from Settings → Security.
  const [gate, setGate] = useState<Employee | null>(null);

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

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  /**
   * Signed in: a 1.4 s unlock. 0–400 ms the button becomes a glowing capsule with an unlock icon; 400–900 ms a shockwave sweeps
   * out, the card lifts under a blue halo and "Identity verified" slides up; at 900 ms the screen warps forward and fades over
   * 500 ms as the portal opens (the navigation starts then). Everything animates only transform, opacity and filter.
   */
  const enter = (who: Employee) => {
    setStage("launch");
    const open = () => {
      // Central admins start on the whole network; someone limited to one showroom lands on that showroom.
      const scope = who.access !== "all" && who.access.length === 1 ? who.access[0] : "all";
      useEmployees.getState().signIn(who);
      useApp.getState().setBranchScope(scope, { silent: true });
      router.push("/");
    };
    if (reduced) return open();
    setPhase("check");
    timers.current.push(
      setTimeout(() => setPhase("verify"), 400),
      setTimeout(() => {
        setPhase("out");
        open();
      }, 900),
    );
  };

  const submit = async () => {
    if (stage !== "idle" || checking) return;
    const e: Record<string, string> = {};
    const id = email.trim();
    if (!id) e.email = "Enter your work email or mobile number";
    else if (id.includes("@") ? !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id) : /^[\d\s\-()+]+$/.test(id) && !mobileOk(id)) e.email = id.includes("@") ? "Enter a valid email address" : "Enter a valid 10-digit mobile number";
    if (!password) e.password = "Enter your password";
    setErrors(e);
    setNotice(null);
    if (Object.keys(e).length) return;
    setChecking(true);
    try {
      // Strict: only an Active, activated employee in the directory who knows the password gets in.
      const auth = await authenticate(email, password);
      if (!auth.ok) {
        if (auth.reason === "locked") setNotice({ tone: "warn", title: "Too many failed attempts", text: ACCESS_DENIED.locked });
        else setErrors(auth.reason === "wrong-password" ? { password: ACCESS_DENIED[auth.reason] } : { email: ACCESS_DENIED[auth.reason] });
        return;
      }
      saveRemembered(remember ? email.trim() : null);
      proceed(auth.employee);
    } catch (err) {
      setNotice({ tone: "error", title: "Couldn't sign you in", text: err instanceof Error ? err.message : "Couldn't reach the server. Please try again." });
    } finally {
      setChecking(false);
    }
  };

  /** Admins go through the passcode first when it is switched on; everyone else is let in straight away. */
  const proceed = (who: Employee) => {
    if (who.role === "Admin" && security.passcodeOn && security.passcodeHash) {
      setErrors({});
      setGate(who);
      return;
    }
    enter(who);
  };

  const flipTo = (next: "signin" | "activate" | "forgot") => {
    if (stage !== "idle") return;
    setErrors({});
    setNotice(null);
    if (next !== "signin") {
      setBackView(next);
      setBackKey((k) => k + 1);
    }
    setIsFlipped(next !== "signin");
  };

  // Once the card has turned, put the cursor in the first field of the side now facing the user.
  useEffect(() => {
    const t = setTimeout(() => (isFlipped ? back : front).current?.querySelector("input")?.focus({ preventScroll: true }), 420);
    return () => clearTimeout(t);
  }, [isFlipped]);

  const unlocking = phase === "verify" || phase === "out";

  return (
    <motion.div animate={phase === "out" ? { opacity: 0, scale: 1.1, filter: "blur(4px)" } : { opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.5, ease: "easeIn" }} className="relative flex will-change-transform min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-14 sm:px-6">
      <AmbientBackground lit={unlocking} />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
        <Utilities />
      </div>

      <motion.div animate={unlocking ? { scale: 1.02 } : { scale: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} className="relative z-10 w-full max-w-[440px] will-change-transform">
        {/* brand */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} className="mb-10 flex flex-col items-center text-center">
          <SplitLogo />
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#0020B2]/20 bg-[#0020B2]/[0.05] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[#0020B2] dark:border-white/10 dark:bg-white/[0.05] dark:text-sky-200/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0050FF] shadow-[0_0_10px_#0050FF]" />
            Operations Hub &amp; Claim Management
          </span>
        </motion.div>

        {/* floating glass card; the frosted pane stays put while its two faces turn */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.1 }} className="relative">
          {unlocking && <Shockwave />}
          <AnimatePresence>{unlocking && <HudBadge key="hud" />}</AnimatePresence>
          <div aria-hidden className={`absolute inset-0 rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-[#0020B2]/10 transition-shadow duration-500 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] ${unlocking ? "!shadow-[0_0_60px_rgba(0,102,255,0.4)] dark:!shadow-[0_0_60px_rgba(0,102,255,0.4)]" : ""}`} />
          <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#0050FF] to-transparent" />
          <div className="relative">
            <div data-view={view} className="[perspective:1000px]">
              <div className={`grid [transform-style:preserve-3d] transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                <div ref={front} inert={isFlipped} aria-hidden={isFlipped} className="rounded-3xl border border-transparent p-7 [backface-visibility:hidden] [grid-area:1/1] dark:border-zinc-800 dark:bg-zinc-950 sm:p-9">
                  <AnimatePresence mode="wait" initial={false}>
                    {gate ? (
                      <PasscodeStep key="passcode" who={gate} stage={stage} onVerified={enter} onBack={() => setGate(null)} />
                    ) : (
                      <motion.div key="signin" {...stepMotion}>
                        <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-slate-900 dark:text-white">Sign in to Vijayagiri Workspace</h1>
                  <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">Enter your registered credentials to access claims and inventory.</p>

                  <div className="mt-8">
                    <AnimatePresence initial={false}>{notice && <NoticeBanner key="notice" notice={notice} onDismiss={() => setNotice(null)} />}</AnimatePresence>
                  </div>

                  <div className="space-y-5">
                    <AuthField
                      label="Work email or mobile number"
                      icon={<Mail className="h-[18px] w-[18px]" />}
                      autoFocus
                      autoComplete="username"
                      spellCheck={false}
                      placeholder="name@vijayagiri.in or 98470 12345"
                      value={email}
                      onChange={(v) => {
                        setEmail(v);
                        setErrors((x) => ({ ...x, email: "" }));
                      }}
                      error={errors.email}
                    />
                    <PasswordField
                      placeholder="Enter your password"
                      value={password}
                      onChange={(v) => {
                        setPassword(v);
                        setErrors((x) => ({ ...x, password: "" }));
                      }}
                      error={errors.password}
                    />
                  </div>

                  <div className="flex items-center justify-between pb-6 pt-4">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-400">
                      <Checkbox checked={remember} onChange={setRemember} label="Remember me" boxClassName="dark:border-zinc-700 dark:bg-zinc-900 dark:aria-checked:border-blue-600 dark:aria-checked:bg-blue-600" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => flipTo("forgot")} className={`${linkCls} -my-2`}>
                      Forgot password?
                    </button>
                  </div>

                  <SubmitButton label="Sign In" loading={checking} stage={stage} />

                  <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
                    New employee?{" "}
                    <button type="button" onClick={() => flipTo("activate")} disabled={stage !== "idle"} className="rounded font-semibold text-[#0020B2] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0020B2]/40 disabled:opacity-50 dark:text-sky-300">
                      Activate your account
                    </button>
                  </p>
                </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div ref={back} inert={!isFlipped} aria-hidden={!isFlipped} className="rounded-3xl border border-transparent p-7 [backface-visibility:hidden] [grid-area:1/1] [transform:rotateY(180deg)] dark:border-zinc-800 dark:bg-zinc-950 sm:p-9">
                  {backView === "forgot" ? (
                      <ForgotPassword key={backKey} stage={stage} active={isFlipped} initialEmail={email.includes("@") ? email.trim() : ""} onBack={() => flipTo("signin")} onDone={() => flipTo("signin")} />
                    ) : (
                      <ActivationFlow key={backKey} stage={stage} active={isFlipped} initialEmail={email.includes("@") ? email.trim() : ""} onBack={() => flipTo("signin")} onActivated={enter} />
                    )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <p className={`mt-8 px-4 text-center text-[12px] leading-5 text-slate-500 transition-opacity duration-300 dark:text-slate-400 ${unlocking ? "opacity-0" : ""}`}>
          Only employees registered in the directory can sign in.
          <br />© {new Date().getFullYear()} {legalName}
        </p>
      </motion.div>
    </motion.div>
  );
}
