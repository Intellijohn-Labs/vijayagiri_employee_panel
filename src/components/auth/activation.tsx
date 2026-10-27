"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MailCheck, Phone } from "lucide-react";
import { ACTIVATION_DENIED, activateAccount, checkInvite, type Employee } from "@/store/employee-store";
import { passwordProblem, useSettings } from "@/store/settings-store";
import { AuthField, PasswordField, SubmitButton, linkCls, type AuthStage } from "./auth-ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Back of the sign-in card. There is no open sign-up: the email AND phone number must both match a record an Admin created
 * (checked on the server, which gives the same answer for "no such person" and "wrong phone"). Only then is the chosen
 * password stored (scrypt) and the employee signed in.
 */
export function ActivationFlow({ stage, active, initialEmail, onBack, onActivated }: { stage: AuthStage; /** True while this side of the card is showing */ active: boolean; initialEmail: string; onBack: () => void; onActivated: (e: Employee) => void }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const security = useSettings((s) => s.settings.security);
  const wasActive = useRef(false);

  // Carry over an email typed on the sign-in side, once, as the card turns round.
  useEffect(() => {
    if (active && !wasActive.current) setEmail((cur) => cur || initialEmail);
    wasActive.current = active;
  }, [active, initialEmail]);

  const submit = async () => {
    if (working || stage !== "idle") return;
    const e: Record<string, string> = {};
    if (!EMAIL.test(email.trim())) e.email = "Enter the work email your Admin registered for you";
    if (phone.replace(/\D/g, "").length < 10) e.phone = "Enter the 10-digit mobile number your Admin registered for you";
    const problem = passwordProblem(password, security);
    if (problem) e.password = problem;
    if (confirm !== password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;

    setWorking(true);
    try {
      // Email and phone must match an active, not-yet-activated record an Admin created.
      const check = await checkInvite(email, phone);
      if (!check.ok) return setErrors({ form: ACTIVATION_DENIED[check.reason] });
      const done = await activateAccount(email, phone, password);
      if (!done) return setErrors({ form: ACTIVATION_DENIED["not-found"] });
      onActivated(done);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Couldn't reach the server. Please try again." });
    } finally {
      setWorking(false);
    }
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
      <h2 className="text-[26px] font-semibold leading-8 tracking-tight text-slate-900 dark:text-white">Activate your account</h2>
      <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">Verify your registered email and phone number to set your password.</p>

      <div className="mt-7 space-y-4">
        <AuthField
          label="Work email"
          icon={<MailCheck className="h-[18px] w-[18px]" />}
          type="email"
          autoComplete="username"
          spellCheck={false}
          placeholder="name@vijayagiri.in"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clear("email");
          }}
          error={errors.email}
        />
        <AuthField
          label="Mobile number"
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
        />
      </div>

      {errors.form && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] font-medium text-red-700 dark:text-red-300">
          {errors.form}
        </p>
      )}

      <div className="mt-6">
        <SubmitButton label="Verify & Activate Account" busyLabel="Verifying…" loading={working} stage={stage} />
      </div>

      <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
        Already activated?{" "}
        <button type="button" onClick={onBack} disabled={stage !== "idle"} className={`${linkCls} inline-flex items-center gap-1 font-semibold text-[#0020B2] dark:text-sky-300`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </p>
    </form>
  );
}
