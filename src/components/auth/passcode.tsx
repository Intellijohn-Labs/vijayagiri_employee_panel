"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound } from "lucide-react";
import { hashPassword, type Employee } from "@/store/employee-store";
import { useSettings } from "@/store/settings-store";
import { AuthField, SubmitButton, linkCls, stepMotion, type AuthStage } from "./auth-ui";

/** Salt used for the Admin passcode hash (kept in one place so Settings and sign-in agree). */
export const PASSCODE_SALT = "admin-passcode";

/** Second step for Admins when the passcode is switched on in Settings → Security. */
export function PasscodeStep({ who, stage, onVerified, onBack }: { who: Employee; stage: AuthStage; onVerified: (e: Employee) => void; onBack: () => void }) {
  const hash = useSettings((s) => s.settings.security.passcodeHash);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (busy || stage !== "idle") return;
    if (!code) return setError("Enter your Admin passcode");
    setBusy(true);
    try {
      if ((await hashPassword(PASSCODE_SALT, code)) === hash) return onVerified(who);
      const n = tries + 1;
      setTries(n);
      setCode("");
      if (n >= 3) return onBack();
      setError(`Incorrect passcode. ${3 - n} attempt${3 - n === 1 ? "" : "s"} left.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the passcode.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.form
      {...stepMotion}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Admin passcode</h2>
        <p className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Welcome back, {who.name.split(" ")[0]}. Admin accounts need the passcode set in Settings before they can continue.</p>
      </div>
      <AuthField
        label="Passcode"
        icon={<KeyRound className="h-[18px] w-[18px]" />}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={8}
        className="tracking-[0.35em]"
        value={code}
        onChange={(v) => {
          setCode(v.replace(/\D/g, ""));
          setError("");
        }}
        error={error}
      />
      <SubmitButton label="Verify & sign in" busyLabel="Checking…" loading={busy} stage={stage} />
      <div className="flex justify-center">
        <button type="button" onClick={onBack} disabled={stage !== "idle"} className={`${linkCls} inline-flex items-center gap-1.5 disabled:opacity-50`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </div>
    </motion.form>
  );
}
