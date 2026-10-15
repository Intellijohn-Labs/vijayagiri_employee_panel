"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, MailCheck } from "lucide-react";
import { toast } from "@/store/toast-store";
import { useBranchTools } from "@/store/branch-store";
import { ACTIVATION_DENIED, activateAccount, checkInvite, type Employee } from "@/store/employee-store";
import { passwordProblem, useSettings } from "@/store/settings-store";
import { LaunchButton, REVEAL, TelemetryField, TelemetryPassword, telemetryInputCls, type LaunchStage } from "./cockpit";
import { cn } from "@/lib/utils";

const step = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: REVEAL }, exit: { opacity: 0, y: -10, transition: { duration: 0.12 } } };
const linkCls = "rounded py-2 text-[12px] font-medium tracking-wide text-sky-700 underline-offset-4 outline-none transition-colors hover:text-sky-500 hover:underline focus-visible:underline dark:text-sky-300 dark:hover:text-sky-200";

/**
 * Invited-employee activation. Step 1 checks the email against the directory an Admin maintains (unknown addresses are refused,
 * already-activated ones are sent back to Sign In); step 2 lets the invited person choose a password, which activates the account.
 */
export function ActivationFlow({ stage, initialEmail, onBack, onType, onActivated }: { stage: LaunchStage; initialEmail: string; onBack: () => void; onType: (chars: number) => void; onActivated: (e: Employee) => void }) {
  const { byId } = useBranchTools();
  const [email, setEmail] = useState(initialEmail);
  const [invited, setInvited] = useState<Employee | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const security = useSettings((s) => s.settings.security);

  const verify = () => {
    if (!email.trim()) return setErrors({ email: "Enter the work email your Admin registered for you" });
    const check = checkInvite(email);
    if (!check.ok) return setErrors({ email: ACTIVATION_DENIED[check.reason] });
    setErrors({});
    setPassword("");
    setConfirm("");
    setInvited(check.employee);
  };

  const activate = async () => {
    if (!invited || working || stage !== "idle") return;
    const e: Record<string, string> = {};
    const problem = passwordProblem(password, security);
    if (problem) e.password = problem;
    if (confirm !== password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;
    setWorking(true);
    try {
      const done = await activateAccount(invited.id, password);
      if (!done) {
        // Someone (or another tab) activated or deactivated the account since the email was verified.
        setInvited(null);
        const again = checkInvite(email);
        setErrors({ email: again.ok ? "Something went wrong. Please verify your email again." : ACTIVATION_DENIED[again.reason] });
        return;
      }
      toast.success("Account activated", "Your password is saved. Signing you in…");
      onActivated(done);
    } catch (err) {
      setErrors({ password: err instanceof Error ? err.message : "Couldn't save the password. Please try again." });
    } finally {
      setWorking(false);
    }
  };

  const showrooms = invited ? (invited.access === "all" ? "All Showrooms" : invited.access.map((id) => byId(id)?.name ?? id).join(", ")) : "";

  return (
    <motion.div {...step} className="mt-5">
      <AnimatePresence mode="wait" initial={false}>
        {!invited ? (
          <motion.form key="verify" {...step} noValidate onSubmit={(ev) => { ev.preventDefault(); verify(); }} className="space-y-4">
            <div>
              <p className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">Activate your account</p>
              <p className="mt-1 text-[12.5px] leading-5 text-slate-600 dark:text-slate-400">Enter the work email your Admin added to the employee directory. Only pre-approved employees can set a password.</p>
            </div>
            <TelemetryField label="Official Work Email" icon={<MailCheck className="h-4 w-4" />} error={errors.email}>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  setErrors({});
                  onType(ev.target.value.length);
                }}
                placeholder="e.g. name@vijayagiri.in"
                autoComplete="username"
                spellCheck={false}
                aria-invalid={!!errors.email}
                className={cn(telemetryInputCls, errors.email && "!border-red-500")}
              />
            </TelemetryField>
            <motion.button type="submit" whileTap={{ scale: 0.98 }} className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#003399] to-[#0047AB] text-[13px] font-bold tracking-[0.28em] text-white shadow-[0_10px_30px_-10px_rgba(0,51,153,0.9)] outline-none transition-shadow hover:shadow-[0_12px_34px_-8px_rgba(37,99,235,0.95)] focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F1F5F9] dark:focus-visible:ring-offset-[#050811]">
              VERIFY EMAIL
            </motion.button>
          </motion.form>
        ) : (
          <motion.form key="set" {...step} noValidate onSubmit={(ev) => { ev.preventDefault(); void activate(); }} className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" />
              <div className="min-w-0">
                <p className="text-[14px] font-bold leading-5 text-slate-900 dark:text-white">Welcome, {invited.name}</p>
                <p className="text-[12.5px] leading-5 text-slate-700 dark:text-slate-300">
                  {invited.role} • {showrooms}
                </p>
                <p className="truncate font-mono text-[11px] tracking-wide text-slate-500 dark:text-slate-400">{invited.email}</p>
              </div>
            </div>
            <TelemetryPassword
              label="Create Password"
              autoComplete="new-password"
              placeholder={`At least ${security.minPassword} characters${security.requireMixed ? ", letters and numbers" : ""}`}
              value={password}
              onChange={(v) => {
                setPassword(v);
                setErrors((x) => ({ ...x, password: "" }));
                onType(v.length + confirm.length);
              }}
              error={errors.password}
            />
            <TelemetryPassword
              label="Confirm Password"
              autoComplete="new-password"
              placeholder="Re-enter the password"
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                setErrors((x) => ({ ...x, confirm: "" }));
                onType(password.length + v.length);
              }}
              error={errors.confirm}
            />
            <LaunchButton stage={stage} label="COMPLETE ACTIVATION & SIGN IN" />
            <div className="text-center">
              <button type="button" onClick={() => { setInvited(null); setErrors({}); }} className={linkCls}>
                Not {invited.name.split(" ")[0]}? Use a different email
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-2 flex justify-center">
        <button type="button" onClick={onBack} disabled={stage !== "idle"} className={cn(linkCls, "inline-flex items-center gap-1.5 disabled:opacity-50")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </button>
      </div>
    </motion.div>
  );
}
