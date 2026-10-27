/* ───────── Insurance add-ons (customer calculator) ───────── */

export type AddonId = "zerodep" | "engine" | "rti" | "rsa" | "pa";

export interface Addon {
  id: AddonId;
  name: string;
  blurb: string;
  recommended?: boolean;
  mandatory?: boolean;
  /** Indicative price by engine size: up to 125 cc, 126–160 cc, above 160 cc */
  price: [number, number, number];
}

/** Indicative add-on prices. The insurer's quote at issuance is the final word. */
export const ADDONS: Addon[] = [
  { id: "zerodep", name: "Zero Depreciation (Bumper-to-Bumper)", blurb: "Full claim value on replaced parts with no deduction for wear. Best for a new bike.", recommended: true, price: [1200, 1800, 2500] },
  { id: "engine", name: "Engine & Gearbox Protection", blurb: "Covers damage from water ingression and hydrostatic lock.", price: [500, 750, 1100] },
  { id: "rti", name: "Return to Invoice (RTI)", blurb: "Refund of the full invoice value on total loss or theft.", price: [900, 1400, 2000] },
  { id: "rsa", name: "24x7 Roadside Assistance (RSA)", blurb: "Towing, flat-tyre help and emergency fuel support.", price: [399, 499, 599] },
  { id: "pa", name: "Personal Accident Cover (₹15 Lakh)", blurb: "Owner-driver cover. Mandatory unless you already hold one.", mandatory: true, price: [750, 750, 750] },
];
export const DEFAULT_ADDONS: AddonId[] = ["pa"];

/** Engine size in cc from a spec like "155 cc"; null when it can't be read. */
export const ccOf = (engine: string | undefined): number | null => {
  const n = parseFloat((engine ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const tier = (cc: number | null) => (cc !== null && cc <= 125 ? 0 : cc !== null && cc > 160 ? 2 : 1);
export const addonPrice = (a: Addon, cc: number | null) => a.price[tier(cc)];

/** Rough cost of the base cover (1 year own damage + 5 years third party) by engine size; the Admin can correct it per model. */
export const baseInsuranceDefault = (cc: number | null) => [6500, 8000, 11500][tier(cc)];

/* ───────── Policy records (Insurance Hub) ───────── */

export const INSURERS = ["HDFC ERGO", "ICICI Lombard", "Bajaj Allianz", "Reliance General", "National Insurance", "New India Assurance", "United India Insurance", "Other"] as const;
export const POLICY_TYPES = ["Comprehensive", "Zero Depreciation", "Bundled 1+5", "Bundled 1+4"] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export interface Policy {
  id: string;
  branchId: string;
  customer: string;
  phone: string;
  modelName: string;
  chassisNo: string;
  engineNo: string;
  /** Registration number once allotted */
  regNo: string;
  partner: string;
  /** Empty while the policy is awaiting issuance */
  policyNo: string;
  type: PolicyType;
  /** yyyy-mm-dd */
  start: string;
  end: string;
  premium: number | null;
  /** Set when a renewal reminder was sent and the policy has not been renewed since */
  renewalPending: boolean;
  /** Name and size of the uploaded policy PDF (the file itself lives in IndexedDB under the policy id) */
  docName?: string;
  docSize?: number;
  /** Stock unit this was created from, when it was picked from stock */
  stockId?: string;
  createdAt: number;
}

export type PolicyStatus = "pending" | "renewal" | "expired" | "expiring" | "active";
export const EXPIRING_DAYS = 30;

const DAY = 86_400_000;
/** yyyy-mm-dd for a local date. */
export const isoDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
/** Whole days from today (local) to a yyyy-mm-dd date: negative once it has passed. */
export const daysUntil = (iso: string, now = new Date()) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${isoDate(now)}T00:00:00`).getTime()) / DAY);

export function policyStatus(p: Policy, now = new Date()): { status: PolicyStatus; days: number | null; label: string } {
  if (!p.policyNo.trim() || !p.end) return { status: "pending", days: null, label: "Pending Issuance" };
  const days = daysUntil(p.end, now);
  if (p.renewalPending && days <= EXPIRING_DAYS) return { status: "renewal", days, label: "Renewal Pending" };
  if (days < 0) return { status: "expired", days, label: "Expired" };
  if (days <= EXPIRING_DAYS) return { status: "expiring", days, label: days === 0 ? "Expires today" : `Expiring in ${days} day${days === 1 ? "" : "s"}` };
  return { status: "active", days, label: "Active" };
}

/** Suggested end date for a start date: one year for own-damage policies, five for a 1+5 bundle, four for 1+4 (the day before the anniversary). */
export function suggestEnd(start: string, type: PolicyType): string {
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + (type === "Bundled 1+5" ? 5 : type === "Bundled 1+4" ? 4 : 1));
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

export const fmtDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
