"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { AlertTriangle, CircleHelp, Mail, Moon, ShieldAlert, Sun, X } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useTheme } from "@/store/theme-store";
import { HQ_ID } from "@/lib/branches";
import { useBranchTools } from "@/store/branch-store";
import { Popover } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/primitives";
import { ActivationFlow } from "@/components/auth/activation";
import { PasscodeStep } from "@/components/auth/passcode";
import { PortalInit } from "@/components/auth/portal-init";
import { AuthBackground, AuthField, BrandLogo, PasswordField, REVEAL, SubmitButton, linkCls, type AuthStage } from "@/components/auth/auth-ui";
import { useSettings } from "@/store/settings-store";
import { forgotPassword, loadRemembered, saveRemembered } from "@/components/auth/auth-kit";
import { ACCESS_DENIED, authenticate, useEmployees, type Employee } from "@/store/employee-store";

const utilityBtn = "grid h-9 w-9 place-items-center rounded-full border border-slate-300/80 bg-white/70 text-slate-600 outline-none backdrop-blur transition-all duration-200 hover:scale-105 hover:bg-white hover:text-[#003399] focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white";

/** Theme toggle and help. */
function Utilities() {
  const { theme, toggle } = useTheme();
  const { byId: branchById } = useBranchTools();
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={utilityBtn}>
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

/** A mobile number typed any usual way: +91 / 0 prefix, spaces, dashes or brackets, ending up as 10 digits. */
const mobileOk = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10;
};

type Notice = { tone: "error" | "warn"; title: string; text: string };

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: REVEAL } };

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

export default function LoginPage() {
  const router = useRouter();
  const shake = useAnimationControls();
  const legalName = useSettings((s) => s.settings.profile.legalName);
  const security = useSettings((s) => s.settings.security);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mode, setMode] = useState<"signin" | "activate">("signin");
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<AuthStage>("idle");
  // Set while an Admin must still enter the passcode from Settings → Security.
  const [gate, setGate] = useState<Employee | null>(null);
  /** Set once sign-in succeeded: shows the start-up sequence for this employee. */
  const [welcome, setWelcome] = useState<Employee | null>(null);

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

  const wiggle = () => void shake.start({ x: [0, -12, 11, -9, 7, -4, 2, 0], transition: { duration: 0.5, ease: "easeInOut" } });

  /** Signed in: the card steps back and the 3-second start-up sequence runs; when it ends the portal opens for this employee. */
  const enter = (who: Employee) => {
    setStage("launch");
    setWelcome(who);
  };

  /** Called by the start-up sequence at its 3.0 s mark. */
  const openPortal = (who: Employee) => {
    // Central admins start on the whole network; someone limited to one showroom lands on that showroom.
    const scope = who.access !== "all" && who.access.length === 1 ? who.access[0] : "all";
    useEmployees.getState().signIn(who);
    useApp.getState().setBranchScope(scope, { silent: true });
    router.push("/branches");
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
    if (Object.keys(e).length) return wiggle();
    setChecking(true);
    try {
      // Strict: only an Active, activated employee in the directory who knows the password gets in.
      const auth = await authenticate(email, password);
      if (!auth.ok) {
        if (auth.reason === "locked") setNotice({ tone: "warn", title: "Too many failed attempts", text: ACCESS_DENIED.locked });
        else setErrors(auth.reason === "wrong-password" ? { password: ACCESS_DENIED[auth.reason] } : { email: ACCESS_DENIED[auth.reason] });
        return wiggle();
      }
      saveRemembered(remember ? email.trim() : null);
      proceed(auth.employee);
    } catch (err) {
      setNotice({ tone: "error", title: "Couldn't sign you in", text: err instanceof Error ? err.message : "Couldn't reach the server. Please try again." });
      wiggle();
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

  const switchMode = (next: "signin" | "activate") => {
    if (stage !== "idle") return;
    setErrors({});
    setNotice(null);
    setMode(next);
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <AuthBackground />
      {welcome && <PortalInit name={welcome.name} onDone={() => openPortal(welcome)} />}

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
        <Utilities />
      </div>

      <motion.div
        animate={stage === "launch" ? { scale: 1.05, opacity: 0, filter: "blur(8px)", y: -12 } : { scale: 1, opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.5, ease: "easeIn" }}
        className="relative z-10 w-full max-w-[440px]"
      >
        {/* brand */}
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: -14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...REVEAL, delay: 0.05 }}>
            <BrandLogo />
          </motion.div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...REVEAL, delay: 0.18 }} className="mt-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0a47b8] dark:text-sky-300">
            Operations Hub &amp; Claim Management
          </motion.p>
        </div>

        {/* card */}
        <motion.div animate={shake}>
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...REVEAL, delay: 0.12 }}
            className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 p-6 shadow-[0_30px_80px_-30px_rgba(0,51,153,0.35)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_30px_90px_-30px_rgba(0,71,171,0.65)]"
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl dark:bg-sky-400/10" />

            <AnimatePresence mode="wait" initial={false}>
              {gate ? (
                <PasscodeStep key="passcode" who={gate} stage={stage} onVerified={enter} onBack={() => setGate(null)} />
              ) : mode === "activate" ? (
                <ActivationFlow key="activate" stage={stage} initialEmail={email.includes("@") ? email.trim() : ""} onBack={() => switchMode("signin")} onActivated={enter} />
              ) : (
                <motion.form
                  key="signin"
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                  className="relative"
                >
                  <motion.div variants={item} className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Welcome back</h1>
                    <p className="mt-1 text-[13.5px] text-slate-600 dark:text-slate-400">Sign in to your Vijayagiri workspace.</p>
                  </motion.div>

                  <AnimatePresence initial={false}>{notice && <NoticeBanner key="notice" notice={notice} onDismiss={() => setNotice(null)} />}</AnimatePresence>

                  <div className="space-y-4">
                    <motion.div variants={item}>
                      <AuthField
                        label="Work email or mobile number"
                        icon={<Mail className="h-[18px] w-[18px]" />}
                        autoFocus
                        autoComplete="username"
                        spellCheck={false}
                        value={email}
                        onChange={(v) => {
                          setEmail(v);
                          setErrors((x) => ({ ...x, email: "" }));
                        }}
                        error={errors.email}
                      />
                    </motion.div>

                    <motion.div variants={item}>
                      <PasswordField
                        value={password}
                        onChange={(v) => {
                          setPassword(v);
                          setErrors((x) => ({ ...x, password: "" }));
                        }}
                        error={errors.password}
                      />
                    </motion.div>
                  </div>

                  <motion.div variants={item} className="flex items-center justify-between pb-5 pt-4">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => forgotPassword(email)} className={`${linkCls} -my-2`}>
                      Forgot password?
                    </button>
                  </motion.div>

                  <motion.div variants={item}>
                    <SubmitButton label="Sign in" loading={checking} stage={stage} />
                  </motion.div>

                  <motion.div variants={item} className="mt-5 border-t border-slate-200/80 pt-4 text-center dark:border-white/10">
                    <button type="button" onClick={() => switchMode("activate")} disabled={stage !== "idle"} className="group inline-flex items-center gap-1.5 rounded py-1.5 text-[13px] text-slate-600 outline-none transition-colors hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">
                      New employee? <span className="font-semibold text-sky-700 underline-offset-4 group-hover:underline dark:text-sky-300">Activate your account</span>
                    </button>
                  </motion.div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-6 px-4 text-center text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">
          Only employees registered in the directory can sign in.
          <br />© {new Date().getFullYear()} {legalName}
        </motion.p>
      </motion.div>
    </div>
  );
}
