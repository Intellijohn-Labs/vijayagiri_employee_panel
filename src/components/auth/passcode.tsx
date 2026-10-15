"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound } from "lucide-react";
import { hashPassword, type Employee } from "@/store/employee-store";
import { useSettings } from "@/store/settings-store";
import { LaunchButton, REVEAL, TelemetryField, telemetryInputCls, type LaunchStage } from "./cockpit";
import { cn } from "@/lib/utils";

/** Salt used for the Admin passcode hash (kept in one place so Settings and sign-in agree). */
export const PASSCODE_SALT = "admin-passcode";

/** Second step for Admins when the passcode is switched on in Settings → Security. */
export function PasscodeStep({ who, stage, onType, onVerified, onBack }: { who: Employee; stage: LaunchStage; onType: (chars: number) => void; onVerified: (e: Employee) => void; onBack: () => void }) {
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: REVEAL }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.12 } }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
      className="mt-5 space-y-4"
    >
      <div>
        <p className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">Admin passcode</p>
        <p className="mt-1 text-[12.5px] leading-5 text-slate-600 dark:text-slate-400">Welcome back, {who.name.split(" ")[0]}. Admin accounts need the passcode set in Settings before they can continue.</p>
      </div>
      <TelemetryField label="Passcode" icon={<KeyRound className="h-4 w-4" />} error={error}>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          maxLength={8}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setCode(v);
            setError("");
            onType(v.length);
          }}
          placeholder="••••••"
          aria-invalid={!!error}
          className={cn(telemetryInputCls, "tracking-[0.4em]", error && "!border-red-500")}
        />
      </TelemetryField>
      <LaunchButton stage={stage} label="VERIFY & SIGN IN" />
      <div className="flex justify-center">
        <button type="button" onClick={onBack} disabled={stage !== "idle"} className="inline-flex items-center gap-1.5 rounded py-2 text-[12px] font-medium tracking-wide text-sky-700 underline-offset-4 outline-none hover:underline focus-visible:underline disabled:opacity-50 dark:text-sky-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </button>
      </div>
    </motion.form>
  );
}
