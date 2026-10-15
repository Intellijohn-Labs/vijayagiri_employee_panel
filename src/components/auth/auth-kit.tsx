"use client";

import { toast } from "@/store/toast-store";

/* ───────── Demo password (there is no real authentication behind the email check) ───────── */

export const DEMO_PASSWORD = "demo@1234";

/* ───────── Remember me ───────── */

const REMEMBER_KEY = "vg.remember";
export function loadRemembered(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveRemembered(email: string | null) {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage unavailable — nothing to remember */
  }
}

export function forgotPassword(email: string) {
  toast.info("Password reset requested", `${email.trim() ? `If ${email.trim()} has an account, a` : "A"} reset link is sent by Central Admin (Head Office, 9961774455). This demo sends no email.`);
}

/* ───────── Watermark mask ───────── */

const maskUrl = "url(/images/yamaha-revs-watermark.png)";
/** CSS mask that turns the logo PNG into a flat, tintable shape (used behind the app and on the sign-in screen). */
export const watermarkMask = { WebkitMaskImage: maskUrl, maskImage: maskUrl, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" } as const;
