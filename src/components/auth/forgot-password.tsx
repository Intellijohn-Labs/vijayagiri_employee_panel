"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, MailCheck, Phone } from "lucide-react";
import { resetPassword } from "@/store/employee-store";
import { passwordProblem, useSettings } from "@/store/settings-store";
import { AuthField, PasswordField, SubmitButton, linkCls, type AuthStage } from "./auth-ui";

const EMAIL_OR_CODE = /^([^\s@]+@[^\s@]+\.[^\s@]{2,}|[A-Za-z0-9-]{3,})$/;

/**
 * Back of the sign-in card, "Reset Password" side. The registered email and phone must both match an active directory
 * record (checked on the server) before the new password is stored. On success it says so, then turns back to Sign in.
 */
export function ForgotPassword({ stage, active, initialEmail, onBack, onDone }: { stage: AuthStage; /** True while this side of the card is showing */ active: boolean; initialEmail: string; onBack: () => void; /** Called after the success message has been shown */ onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [success, setSuccess] = useState(false);
  const security = useSettings((s) => s.settings.security);
  const wasActive = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carry over an email typed on the sign-in side, once, as the card turns round.
  useEffect(() => {
    if (active && !wasActive.current) setEmail((cur) => cur || initialEmail);
    wasActive.current = active;
  }, [active, initialEmail]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const submit = async () => {
    if (working || success || stage !== "idle") return;
    const e: Record<string, string> = {};
    if (!EMAIL_OR_CODE.test(email.trim())) e.email = "Enter the work email registered for you";
    if (phone.replace(/\D/g, "").length < 10) e.phone = "Enter the 10-digit mobile number registered for you";
    const problem = passwordProblem(password, security);
    if (problem) e.password = problem;
    if (confirm !== password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;

    setWorking(true);
    const error = await resetPassword(email, phone, password);
    setWorking(false);
    if (error) return setErrors({ form: error });
    setSuccess(true);
    setPassword("");
    setConfirm("");
    // Let the message be read, then turn the card back to Sign in.
    timer.current = setTimeout(onDone, 1800);
  };

  const clear = (k: string) => setErrors((x) => ({ ...x, [k]: "", form: "" }));

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-[26px] font-semibold leading-8 tracking-tight text-slate-900 dark:text-white">Reset password</h2>
      <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">Confirm your registered email and phone number, then choose a new password.</p>

      <div className="mt-7 space-y-4">
        <AuthField
          label="Registered work email"
          icon={<MailCheck className="h-[18px] w-[18px]" />}
          autoComplete="username"
          spellCheck={false}
          placeholder="name@vijayagiri.in"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clear("email");
          }}
          error={errors.email}
          disabled={success}
        />
        <AuthField
          label="Registered mobile number"
          icon={<Phone className="h-[18px] w-[18px]" />}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98470 12345"
          value={phone}
          onChange={(v) => {
            setPhone(v);
            clear("phone");
          }}
          error={errors.phone}
          disabled={success}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder={`At least ${security.minPassword} characters`}
          value={password}
          onChange={(v) => {
            setPassword(v);
            clear("password");
          }}
          error={errors.password}
          disabled={success}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter the password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            clear("confirm");
          }}
          error={errors.confirm}
          disabled={success}
        />
      </div>

      {errors.form && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] font-medium text-red-700 dark:text-red-300">
          {errors.form}
        </p>
      )}
      {success && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password updated successfully. Please sign in.
        </p>
      )}

      <div className="mt-6">
        <SubmitButton label="Reset & Update Password" busyLabel="Updating…" loading={working} stage={success ? "launch" : stage} />
      </div>

      <p className="mt-6 text-center">
        <button type="button" onClick={onBack} disabled={stage !== "idle"} className={`${linkCls} inline-flex items-center gap-1 font-semibold text-[#0020B2] dark:text-sky-300`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </p>
    </form>
  );
}
