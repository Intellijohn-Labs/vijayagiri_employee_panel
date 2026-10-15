"use client";

import { create } from "zustand";
import { sessionIsAdmin } from "./employee-store";
import { toast } from "./toast-store";
import { overrideOf, type Branch } from "@/lib/branches";

const KEY = "vg.settings";
/** Read by the inline theme script in <head> before first paint, so it lives outside the main settings blob. */
export { THEME_DEFAULT_KEY } from "./theme-store";
import { THEME_DEFAULT_KEY } from "./theme-store";

export interface Scheme {
  id: string;
  name: string;
  /** % per annum */
  rate: number;
  enabled: boolean;
}

export interface Settings {
  profile: {
    legalName: string;
    address: string;
    gstin: string;
    cin: string;
    hotline: string;
    email: string;
    /** HH:MM, 24-hour */
    opens: string;
    closes: string;
    /** Custom logo data URLs; null = the official Vijayagiri artwork */
    logoLight: string | null;
    logoDark: string | null;
  };
  finance: {
    interest: number;
    minDownPct: number;
    tenure: number;
    schemes: Scheme[];
    processingFee: number;
    docCharge: number;
  };
  showcase: {
    /** Show the ex-showroom / RTO split to customers (otherwise only the on-road price) */
    priceSplit: boolean;
    /** Offer the "check other branches" yard view on the kiosk */
    interBranch: boolean;
    /** Email address or WhatsApp number that test-ride requests are sent to */
    notifyTarget: string;
    /** Minutes of inactivity before the kiosk returns to the home screen; 0 = never */
    idleMinutes: number;
  };
  security: {
    /** Minutes of inactivity before an employee is signed out; 0 = never */
    sessionMinutes: number;
    passcodeOn: boolean;
    /** Salted SHA-256 of the Admin passcode */
    passcodeHash: string;
    minPassword: number;
    /** Passwords must mix letters and numbers */
    requireMixed: boolean;
  };
  appearance: {
    theme: "system" | "light" | "dark";
    sound: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    legalName: "Vijayagiri Auto Agencies",
    address: "16/386, Group Mukkadan, Opp. CRL Main Entrance, Ambalamugal, Ernakulam - 682302",
    gstin: "",
    cin: "",
    hotline: "9961774455",
    email: "",
    opens: "09:00",
    closes: "19:00",
    logoLight: null,
    logoDark: null,
  },
  finance: {
    interest: 9.5,
    minDownPct: 15,
    tenure: 36,
    schemes: [
      { id: "hdfc", name: "HDFC Bank", rate: 9.5, enabled: true },
      { id: "indusind", name: "IndusInd Bank", rate: 10.25, enabled: true },
      { id: "lnt", name: "L&T Finance", rate: 11.5, enabled: true },
      { id: "tvs", name: "TVS Credit", rate: 11.99, enabled: true },
      { id: "idfc", name: "IDFC First Bank", rate: 10.5, enabled: true },
    ],
    processingFee: 1500,
    docCharge: 500,
  },
  showcase: { priceSplit: true, interBranch: true, notifyTarget: "", idleMinutes: 2 },
  security: { sessionMinutes: 60, passcodeOn: false, passcodeHash: "", minPassword: 8, requireMixed: false },
  appearance: { theme: "light", sound: false },
};

/** Merge saved values over the defaults one section at a time, so settings added later still get their defaults. */
function merge(saved: Partial<Settings> | null): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    profile: { ...d.profile, ...saved?.profile },
    finance: { ...d.finance, ...saved?.finance, schemes: saved?.finance?.schemes?.length ? saved.finance.schemes : d.finance.schemes },
    showcase: { ...d.showcase, ...saved?.showcase },
    security: { ...d.security, ...saved?.security },
    appearance: { ...d.appearance, ...saved?.appearance },
  };
}

interface SettingsState {
  hydrated: boolean;
  settings: Settings;
  hydrate: () => void;
  /** Admin only. Returns false (and says why) for anyone else. */
  save: (next: Settings) => boolean;
}

export const useSettings = create<SettingsState>((set) => ({
  hydrated: false,
  settings: DEFAULT_SETTINGS,
  hydrate: () => {
    let saved: Partial<Settings> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
    } catch {
      /* unreadable — use the defaults */
    }
    set({ settings: merge(saved), hydrated: true });
  },
  save: (next) => {
    if (!sessionIsAdmin()) {
      toast.error("Unauthorized: Only Admins can change settings.");
      return false;
    }
    set({ settings: next });
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.setItem(THEME_DEFAULT_KEY, next.appearance.theme);
    } catch {
      /* storage unavailable — holds for this session only */
    }
    return true;
  },
}));

/** Settings for code outside React (stores, helpers). */
export const getSettings = () => useSettings.getState().settings;

/* ───────── Derived helpers ───────── */

/** "09:00" → "9:00 AM" */
export function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
/** The dealership's default hours as shown on screen, e.g. "9:00 AM – 7:00 PM". */
export const hoursText = (p: Pick<Settings["profile"], "opens" | "closes">) => `${clock12(p.opens)} – ${clock12(p.closes)}`;

/** Minutes after midnight for each end of "9:00 AM – 7:00 PM" style text; null when it can't be read. */
export function parseHours(text: string): [number, number] | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(text);
  if (!m) return null;
  const to = (h: string, min: string | undefined, ap: string | undefined) => {
    let hh = Number(h) % 12;
    if (ap?.toLowerCase() === "pm") hh += 12;
    return hh * 60 + Number(min ?? 0);
  };
  const end = to(m[4], m[5], m[6]);
  return [to(m[1], m[2], m[3] ?? m[6]), end];
}

/** Open right now? Force Closed / Force Open win; Auto lets the branch's hours decide. */
export function isOpenNow(branch: Pick<Branch, "status" | "statusOverride" | "hours">, nowMs: number, fallback: Pick<Settings["profile"], "opens" | "closes">): boolean {
  const override = overrideOf(branch);
  if (override === "closed") return false;
  if (override === "open") return true;
  const range = parseHours(branch.hours) ?? parseHours(hoursText(fallback));
  if (!range) return true;
  const d = new Date(nowMs);
  const mins = d.getHours() * 60 + d.getMinutes();
  const [from, to] = range;
  return from <= to ? mins >= from && mins < to : mins >= from || mins < to;
}

/** Password rules from the reset policy: returns a message when the password breaks one. */
export function passwordProblem(pw: string, s: Settings["security"]): string | null {
  if (pw.length < s.minPassword) return `Password must be at least ${s.minPassword} characters`;
  if (s.requireMixed && !(/[A-Za-z]/.test(pw) && /\d/.test(pw))) return "Password must include both letters and numbers";
  return null;
}
