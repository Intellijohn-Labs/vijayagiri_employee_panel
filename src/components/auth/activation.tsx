"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, MailCheck } from "lucide-react";
import { toast } from "@/store/toast-store";
import { useBranchTools } from "@/store/branch-store";
import { ACTIVATION_DENIED, activateAccount, checkInvite, type Employee } from "@/store/employee-store";
import { passwordProblem, useSettings } from "@/store/settings-store";
import { AuthField, PasswordField, SubmitButton, linkCls, stepMotion, type AuthStage } from "./auth-ui";
import { cn } from "@/lib/utils";

/**
 * Invited-employee activation. Step 1 checks the email against the directory an Admin maintains (unknown addresses are refused,
 * already-activated ones are sent back to Sign In); step 2 lets the invited person choose a password, which activates the account.
 */
export function ActivationFlow({ stage, initialEmail, onBack, onActivated }: { stage: AuthStage; initialEmail: string; onBack: () => void; onActivated: (e: Employee) => void }) {
  const { byId } = useBranchTools();
  const [email, setEmail] = useState(initialEmail);
  const [invited, setInvited] = useState<Employee | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const security = useSettings((s) => s.settings.security);

  const verify = async () => {
    if (working) return;
    if (!email.trim()) return setErrors({ email: "Enter the work email your Admin registered for you" });
    setWorking(true);
    const check = await checkInvite(email).catch(() => null);
    setWorking(false);
    if (!check) return setErrors({ email: "Couldn't reach the server. Please try again." });
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
      const done = await activateAccount(email, password);
      if (!done) {
        // Someone (or another tab) activated or deactivated the account since the email was verified.
        setInvited(null);
        const again = await checkInvite(email);
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
    <motion.div {...stepMotion}>
      <AnimatePresence mode="wait" initial={false}>
        {!invited ? (
          <motion.form
            key="verify"
            {...stepMotion}
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault();
              void verify();
            }}
            className="space-y-4"
          >
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Activate your account</h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Enter the work email your Admin added to the employee directory. Only pre-approved employees can set a password.</p>
            </div>
            <AuthField
              label="Official work email"
              icon={<MailCheck className="h-[18px] w-[18px]" />}
              type="email"
              autoFocus
              autoComplete="username"
              spellCheck={false}
              value={email}
              onChange={(v) => {
                setEmail(v);
                setErrors({});
              }}
              error={errors.email}
            />
            <SubmitButton label="Verify email" busyLabel="Checking…" loading={working} stage={stage} />
          </motion.form>
        ) : (
          <motion.form
            key="set"
            {...stepMotion}
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault();
              void activate();
            }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-5 text-slate-900 dark:text-white">Welcome, {invited.name}</p>
                <p className="text-[12.5px] leading-5 text-slate-700 dark:text-slate-300">
                  {invited.role} • {showrooms}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">{invited.email}</p>
              </div>
            </div>
            <PasswordField
              label="Create password"
              autoComplete="new-password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                setErrors((x) => ({ ...x, password: "" }));
              }}
              error={errors.password}
            />
            <p className="-mt-2 pl-1 text-[11.5px] text-slate-500 dark:text-slate-400">
              At least {security.minPassword} characters{security.requireMixed ? ", with letters and numbers" : ""}.
            </p>
            <PasswordField
              label="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                setErrors((x) => ({ ...x, confirm: "" }));
              }}
              error={errors.confirm}
            />
            <SubmitButton label="Activate & sign in" busyLabel="Activating…" loading={working} stage={stage} />
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setInvited(null);
                  setErrors({});
                }}
                className={linkCls}
              >
                Not {invited.name.split(" ")[0]}? Use a different email
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-1 flex justify-center">
        <button type="button" onClick={onBack} disabled={stage !== "idle"} className={cn(linkCls, "inline-flex items-center gap-1.5 disabled:opacity-50")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </div>
    </motion.div>
  );
}
