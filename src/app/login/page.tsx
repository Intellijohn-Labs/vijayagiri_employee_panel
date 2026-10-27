"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CircleHelp, Mail, Moon, ShieldAlert, Sun, X } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useTheme } from "@/store/theme-store";
import { HQ_ID } from "@/lib/branches";
import { useBranchTools } from "@/store/branch-store";
import { Popover } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/primitives";
import { ActivationFlow } from "@/components/auth/activation";
import { PasscodeStep } from "@/components/auth/passcode";
import { BrandShowcase } from "@/components/auth/brand-showcase";
import { AuthField, BrandLogo, PasswordField, SubmitButton, linkCls, stepMotion, type AuthStage } from "@/components/auth/auth-ui";
import { useSettings } from "@/store/settings-store";
import { forgotPassword, loadRemembered, saveRemembered } from "@/components/auth/auth-kit";
import { ACCESS_DENIED, authenticate, useEmployees, type Employee } from "@/store/employee-store";

const utilityBtn = "grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 outline-none transition-colors hover:text-[#0020B2] focus-visible:ring-2 focus-visible:ring-[#0020B2]/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white";

/** Theme toggle and help. */
function Utilities() {
  const { theme, toggle } = useTheme();
  const { byId: branchById } = useBranchTools();
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className={utilityBtn}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
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

export default function LoginPage() {
  const router = useRouter();
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

  /** Signed in: open the portal straight away. The button keeps its spinner until the next page takes over. */
  const enter = (who: Employee) => {
    setStage("launch");
    // Central admins start on the whole network; someone limited to one showroom lands on that showroom.
    const scope = who.access !== "all" && who.access.length === 1 ? who.access[0] : "all";
    useEmployees.getState().signIn(who);
    useApp.getState().setBranchScope(scope, { silent: true });
    router.push("/");
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

  const switchMode = (next: "signin" | "activate") => {
    if (stage !== "idle") return;
    setErrors({});
    setNotice(null);
    setMode(next);
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <BrandShowcase />

      <main className="relative flex flex-col bg-white dark:bg-[#0E1219]">
        <div className="flex justify-end p-4 sm:p-6">
          <Utilities />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12 sm:px-10">
          <div className="w-full max-w-[400px]">
            {/* on phones and tablets the showcase is hidden, so the logo leads */}
            <div className="mb-10 lg:hidden">
              <BrandLogo />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {gate ? (
                <PasscodeStep key="passcode" who={gate} stage={stage} onVerified={enter} onBack={() => setGate(null)} />
              ) : mode === "activate" ? (
                <ActivationFlow key="activate" stage={stage} initialEmail={email.includes("@") ? email.trim() : ""} onBack={() => switchMode("signin")} onActivated={enter} />
              ) : (
                <motion.form
                  key="signin"
                  {...stepMotion}
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
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-slate-600 dark:text-slate-400">
                      <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => forgotPassword(email)} className={`${linkCls} -my-2`}>
                      Forgot password?
                    </button>
                  </div>

                  <SubmitButton label="Sign In" loading={checking} stage={stage} />

                  <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
                    New employee?{" "}
                    <button type="button" onClick={() => switchMode("activate")} disabled={stage !== "idle"} className="rounded font-semibold text-[#0020B2] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0020B2]/40 disabled:opacity-50 dark:text-sky-300">
                      Activate your account
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>

            <p className="mt-10 text-center text-[12px] leading-5 text-slate-400 dark:text-slate-500">
              Only employees registered in the directory can sign in.
              <br />© {new Date().getFullYear()} {legalName}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
