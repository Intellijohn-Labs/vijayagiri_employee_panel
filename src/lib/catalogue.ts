import { BOOKED, IN_STOCK, TRANSIT, modelKey, type ModelOption } from "./stock-options";
import type { StockEntry } from "@/store/stock-store";
import { baseInsuranceDefault, ccOf } from "./insurance";

/* ───────── Types ───────── */

export type PhotoKind = "hero" | "angle" | "lifestyle";
export const PHOTO_KINDS: { value: PhotoKind; label: string }[] = [
  { value: "hero", label: "Studio hero" },
  { value: "angle", label: "360° / angle" },
  { value: "lifestyle", label: "Lifestyle" },
];

export interface CataloguePhoto {
  id: string;
  /** Downscaled full image (data URL) */
  src: string;
  thumb: string;
  /** Colour this photo shows; null = shown for every colour */
  colour: string | null;
  kind: PhotoKind;
}

/** Photos and the brochure for one model. These are large, so they live in IndexedDB (keyed by model id). */
export interface ModelMedia {
  id: string;
  photos: CataloguePhoto[];
  brochure?: { name: string; size: number; blob: Blob };
}

export interface CatalogueSpecs {
  engine: string;
  mileage: string;
  power: string;
  torque: string;
  weight: string;
  seatHeight: string;
  braking: string;
}
export const SPEC_FIELDS: { key: keyof CatalogueSpecs; label: string; placeholder: string }[] = [
  { key: "engine", label: "Engine (cc)", placeholder: "155 cc" },
  { key: "mileage", label: "Mileage (kmpl)", placeholder: "56 kmpl" },
  { key: "power", label: "Max power", placeholder: "18.1 PS @ 10,000 rpm" },
  { key: "torque", label: "Max torque", placeholder: "14.1 Nm @ 7,500 rpm" },
  { key: "weight", label: "Kerb weight", placeholder: "141 kg" },
  { key: "seatHeight", label: "Seat height", placeholder: "810 mm" },
  { key: "braking", label: "Braking", placeholder: "Dual-channel ABS" },
];

/** The text and numbers an Admin maintains per model (everything except photos and the brochure). */
export interface CatalogueInfo {
  tagline: string;
  specs: CatalogueSpecs;
  features: string[];
  exShowroom: number;
  /** RTO + insurance estimate added on top of ex-showroom to reach the on-road price */
  rtoInsurance: number;
  /** Part of that estimate that is the base insurance (1 year own damage + 5 years third party) */
  baseInsurance: number;
}

/* ───────── Defaults ───────── */

/**
 * Indicative starting figures so the showcase is usable on day one. They are NOT a substitute for the official brochure:
 * the Admin should check and correct them in the Catalogue Manager.
 */
const DEFAULTS: Record<string, { tagline: string; specs: CatalogueSpecs; features: string[] }> = {
  "mt15-v2": { tagline: "The dark side of Japan. Hyper naked attitude.", specs: { engine: "155 cc", mileage: "56 kmpl", power: "18.1 PS @ 10,000 rpm", torque: "14.1 Nm @ 7,500 rpm", weight: "141 kg", seatHeight: "810 mm", braking: "Dual-channel ABS" }, features: ["Traction Control System", "Variable Valve Actuation (VVA)", "Assist & Slipper Clutch", "Y-Connect Bluetooth", "Full LED headlamp", "Upside-down front forks"] },
  r15: { tagline: "Born on the track. Built for the street.", specs: { engine: "155 cc", mileage: "45 kmpl", power: "18.4 PS @ 10,000 rpm", torque: "14.2 Nm @ 7,500 rpm", weight: "142 kg", seatHeight: "815 mm", braking: "Dual-channel ABS" }, features: ["Quick Shifter (R15M)", "Traction Control System", "Variable Valve Actuation (VVA)", "Assist & Slipper Clutch", "Y-Connect Bluetooth", "Upside-down front forks"] },
  "aerox-155": { tagline: "Maxi-sports scooter with real performance.", specs: { engine: "155 cc", mileage: "48 kmpl", power: "15.0 PS @ 8,000 rpm", torque: "13.9 Nm @ 6,500 rpm", weight: "126 kg", seatHeight: "790 mm", braking: "Single-channel ABS" }, features: ["Variable Valve Actuation (VVA)", "Traction Control System", "Y-Connect Bluetooth", "Smart Key", "Full digital LCD cluster", "Large under-seat storage"] },
  "fzs-fi-v4": { tagline: "Street style, everyday confidence.", specs: { engine: "149 cc", mileage: "49 kmpl", power: "12.4 PS @ 7,250 rpm", torque: "13.3 Nm @ 5,500 rpm", weight: "138 kg", seatHeight: "790 mm", braking: "Single-channel ABS" }, features: ["Fuel-injected engine", "Full LED headlamp", "Bluetooth connectivity (Deluxe)", "Muscular fuel tank design", "Single-channel ABS"] },
  "fz-x": { tagline: "Neo-retro street with a modern heart.", specs: { engine: "149 cc", mileage: "50 kmpl", power: "12.4 PS @ 7,250 rpm", torque: "13.3 Nm @ 5,500 rpm", weight: "139 kg", seatHeight: "810 mm", braking: "Single-channel ABS" }, features: ["Neo-retro round LED headlamp", "Y-Connect Bluetooth", "Fuel-injected engine", "Block-pattern tyres", "Single-channel ABS"] },
  "rayzr-125": { tagline: "Hybrid power. Street-rally spirit.", specs: { engine: "125 cc", mileage: "66 kmpl", power: "8.2 PS @ 6,500 rpm", torque: "10.3 Nm @ 5,000 rpm", weight: "99 kg", seatHeight: "785 mm", braking: "Drum / Disc (variant)" }, features: ["Hybrid assist (Smart Motor Generator)", "Idle Stop-Start system", "Y-Connect Bluetooth (select variants)", "LED headlamp", "Side-stand engine cut-off"] },
  "fascino-125": { tagline: "Stylish, light and fuel smart.", specs: { engine: "125 cc", mileage: "68 kmpl", power: "8.2 PS @ 6,500 rpm", torque: "10.3 Nm @ 5,000 rpm", weight: "99 kg", seatHeight: "780 mm", braking: "Drum / Disc (variant)" }, features: ["Hybrid assist (Smart Motor Generator)", "Idle Stop-Start system", "LED headlamp", "Large under-seat storage", "Side-stand engine cut-off"] },
};

const BLANK_SPECS: CatalogueSpecs = { engine: "", mileage: "", power: "", torque: "", weight: "", seatHeight: "", braking: "" };

/** Catalogue details for a model before the Admin has saved anything: the indicative defaults above, or blanks for a new model. */
export function defaultInfo(m: ModelOption): CatalogueInfo {
  const d = DEFAULTS[m.id];
  return {
    tagline: d?.tagline ?? "",
    specs: d?.specs ?? BLANK_SPECS,
    features: d?.features ?? [],
    exShowroom: m.exShowroom,
    rtoInsurance: Math.max(0, m.onRoad - m.exShowroom),
    baseInsurance: baseInsuranceDefault(ccOf(d?.specs.engine)),
  };
}

/* ───────── Money ───────── */

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Unrounded reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1), with r = annual rate / 12 / 100. */
function emiRaw(principal: number, annualPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualPct / 1200;
  if (!r) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}
export const emi = (principal: number, annualPct: number, months: number) => Math.round(emiRaw(principal, annualPct, months));

/* ───────── Finance plan (customer EMI calculator) ───────── */

export type RateMethod = "reducing" | "flat";
export const RATE_METHODS: { value: RateMethod; label: string }[] = [
  { value: "reducing", label: "Reducing balance" },
  { value: "flat", label: "Flat rate" },
];
export interface FinancePlan {
  /** On-road price including the base insurance */
  price: number;
  /** Insurance add-ons chosen on top (₹); 0 when none */
  insurance: number;
  /** One-time financier charges (processing fee + documentation), payable upfront */
  charges: number;
  down: number;
  /** % per annum */
  rate: number;
  /** months */
  tenure: number;
  method: RateMethod;
}
export const PRICE_MIN = 20_000;
export const PRICE_MAX = 1_000_000;
export const DOWN_MIN = 10_000;
export const RATE_MIN = 6.5;
export const RATE_MAX = 16;
/** What the customer is financing / paying in total: the on-road price plus any insurance add-ons. */
export const totalPrice = (p: Pick<FinancePlan, "price" | "insurance">) => p.price + p.insurance;
export const TENURE_OPTIONS = [12, 24, 36, 48, 60] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Smallest allowed down payment: the dealership's minimum % of the total price (rounded to ₹500), but never under ₹10,000. */
export const minDownFor = (total: number, minPct: number) => Math.max(DOWN_MIN, Math.round((total * minPct) / 100 / 500) * 500);

/** Keeps a plan inside the calculator's limits: down payment from the minimum up to price − ₹10,000, rate 6.5–16%. */
export function normalizePlan(p: FinancePlan, minDownPct = 0): FinancePlan {
  const price = clamp(Math.round(p.price) || PRICE_MIN, PRICE_MIN, PRICE_MAX);
  const insurance = Math.max(0, Math.round(p.insurance) || 0);
  const total = price + insurance;
  return { ...p, price, insurance, charges: Math.max(0, Math.round(p.charges) || 0), down: clamp(Math.round(p.down) || DOWN_MIN, minDownFor(total, minDownPct), total - DOWN_MIN), rate: clamp(Number.isFinite(p.rate) ? p.rate : 9.5, RATE_MIN, RATE_MAX) };
}

export interface FinanceResult {
  loan: number;
  emi: number;
  interest: number;
  /** Down payment + loan + interest */
  totalPaid: number;
  /** Cash due at delivery: down payment + one-time financier charges */
  upfront: number;
  /** Share of the loan repayments that is principal, 0–1 */
  principalShare: number;
}

/**
 * Reducing balance: EMI = P·r·(1+r)^n / ((1+r)^n − 1) on the falling balance.
 * Flat rate: interest = P × rate × years on the original loan, spread evenly over the months.
 */
export function financeResult(p: FinancePlan): FinanceResult {
  const loan = Math.max(0, totalPrice(p) - p.down);
  const raw = p.method === "flat" ? (loan + (loan * p.rate * p.tenure) / 1200) / p.tenure : emiRaw(loan, p.rate, p.tenure);
  const interest = Math.round(raw * p.tenure - loan);
  return { loan, emi: Math.round(raw), interest, totalPaid: p.down + loan + interest, upfront: p.down + p.charges, principalShare: loan > 0 ? loan / (loan + interest) : 1 };
}

/* ───────── Kiosk categories ───────── */

export const KIOSK_TABS = [
  { id: "all", label: "All Bikes" },
  { id: "r", label: "R-World", sub: "Supersport" },
  { id: "mt", label: "MT Series", sub: "Hyper Naked" },
  { id: "fz", label: "Street", sub: "FZ" },
  { id: "scooter", label: "Smart Scooters", sub: "Aerox · RayZR · Fascino" },
] as const;
export type KioskTab = (typeof KIOSK_TABS)[number]["id"];

/** Which kiosk tab a model sits under. Models that fit none (custom ones) only show under All Bikes. */
export function kioskTab(m: Pick<ModelOption, "category" | "series" | "name">): Exclude<KioskTab, "all"> | null {
  if (m.category === "Scooter") return "scooter";
  const t = `${m.series} ${m.name}`;
  if (/R-World|\bR15|\bR7|\bR3\b|YZF/i.test(t)) return "r";
  if (/\bMT[-\s]?\d|MT Hyper/i.test(t)) return "mt";
  if (/\bFZ/i.test(t)) return "fz";
  return null;
}

/* ───────── Live stock for a model ───────── */

export interface Counts {
  inStock: number;
  booked: number;
  transit: number;
}
export interface Availability extends Counts {
  byColour: Record<string, Counts>;
}
const blank = (): Counts => ({ inStock: 0, booked: 0, transit: 0 });

/** What is physically (or about to be) in the yard for one model, optionally limited to some showrooms, with a per-colour breakdown. */
export function availability(entries: StockEntry[], model: Pick<ModelOption, "name">, branchIds?: string[] | null): Availability {
  const key = modelKey(model.name);
  const out: Availability = { ...blank(), byColour: {} };
  for (const e of entries) {
    if (modelKey(e.modelName) !== key || (branchIds && !branchIds.includes(e.branchId))) continue;
    const c = (out.byColour[e.colour] ??= blank());
    const field = e.status === IN_STOCK ? "inStock" : e.status === BOOKED ? "booked" : e.status === TRANSIT ? "transit" : null;
    if (!field) continue;
    out[field]++;
    c[field]++;
  }
  return out;
}

/** Headline for a model's stock badge. */
export function stockHeadline(a: Counts): { tone: "ok" | "info" | "neutral"; text: string } {
  if (a.inStock > 0) return { tone: "ok", text: `In Stock: ${a.inStock} unit${a.inStock === 1 ? "" : "s"} ready for immediate delivery` };
  if (a.transit > 0) return { tone: "info", text: `${a.transit} unit${a.transit === 1 ? "" : "s"} arriving soon — book yours` };
  return { tone: "neutral", text: "Available on booking" };
}

/** Per-colour line, e.g. "2 units in yard" or "Available on booking". */
export function colourStatus(c: Counts | undefined): string {
  if (c && c.inStock > 0) return `${c.inStock} unit${c.inStock === 1 ? "" : "s"} in yard`;
  if (c && c.transit > 0) return `${c.transit} in transit`;
  return "Available on booking";
}
