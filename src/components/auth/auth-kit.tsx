"use client";



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

/* ───────── Watermark mask ───────── */

const maskUrl = "url(/images/yamaha-revs-watermark.png)";
/** CSS mask that turns the logo PNG into a flat, tintable shape (used behind the app and on the sign-in screen). */
export const watermarkMask = { WebkitMaskImage: maskUrl, maskImage: maskUrl, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" } as const;
