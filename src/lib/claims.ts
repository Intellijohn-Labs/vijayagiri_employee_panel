/* ───────── Vehicle Claims & Workshop — domain model, SLA rules, sample data ───────── */

import { fmtHours, stageSla } from "./sla-config";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Fixed SOP limits. The timers' thresholds are configurable: see `lib/sla-config`. */
export const SLA = {
  /** Stage 5: longest transit ETA a Parts Manager can set, order to arrival at the Central yard. */
  maxTransitDays: 6,
} as const;

/** Transit warns a flat day before its ETA, whatever the stage 5 buffer says. */
const TRANSIT_WARN = DAY;

export type StageNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface StageDef {
  no: StageNo;
  name: string;
  short: string;
  blurb: string;
}

export const STAGES: StageDef[] = [
  { no: 1, name: "Customer Intake & Claim Initiation", short: "Intake", blurb: "Customer registered and the initial vehicle and accident details captured." },
  { no: 2, name: "Job Card & Claim Number Allocation", short: "Job Card", blurb: "Job card finalised and the official Claim No assigned." },
  { no: 3, name: "Estimation & Insurance Intimation", short: "Estimate", blurb: "Repair estimate prepared and the insurer intimated." },
  { no: 4, name: "Surveyor Showroom Inspection", short: "Survey", blurb: "Surveyor inspects the vehicle; the survey report is approved." },
  { no: 5, name: "Spare Parts Ordering", short: "Parts Order", blurb: "Parts Manager orders from Yamaha; transit to Central is tracked." },
  { no: 6, name: "Central Dispatch / Transit", short: "In Transit", blurb: "Parts received at Central and dispatched to the branch." },
  { no: 7, name: "Vehicle Body Repair & Paint", short: "Body & Paint", blurb: "Repair begins on the ramp; the customer is notified with a photo." },
  { no: 8, name: "Final Inspection & Billing", short: "Inspection", blurb: "Mechanical, body and paint work completed against the checklist and inspected." },
  { no: 9, name: "Settlement & Gate Pass", short: "Settlement", blurb: "Total bill, insurance credit and the customer's balance made transparent and settled." },
  { no: 10, name: "Vehicle Delivery & Closure", short: "Delivery", blurb: "Branch Manager approves delivery; gatepass issued and the vehicle handed over." },
];
export const stageDef = (no: StageNo) => STAGES[no - 1];

/* ───────── Types ───────── */

export interface EstimateLine {
  id: string;
  category: "Parts" | "Labour" | "Paint" | "Other";
  description: string;
  amount: number;
}
export const ESTIMATE_CATEGORIES: EstimateLine["category"][] = ["Parts", "Labour", "Paint", "Other"];

export const INTIMATION_MODES = ["Insurer portal", "Email", "Phone call", "WhatsApp"] as const;
export const VISIT_STATUSES = ["Scheduled", "Visited", "Revisit needed"] as const;
export const APPROVALS = ["Pending", "Approved", "Rejected"] as const;

/** A file kept in IndexedDB (see photo-db); only its description lives on the claim. */
export interface ClaimFile {
  name: string;
  size: number;
  at: number;
  /** False for demo records that point at a file nobody uploaded */
  stored: boolean;
}

export interface ChecklistItem {
  id: string;
  group: "Mechanical" | "Body repair" | "Painting";
  label: string;
  done: boolean;
}

export interface StageLogEntry {
  enteredAt: number;
  completedAt: number;
  /** The deadline that applied, when the stage had one */
  dueAt?: number;
  breached: boolean;
}

export interface ClaimEvent {
  at: number;
  text: string;
  tone: "info" | "ok" | "warn" | "danger";
  /** A note added by staff rather than something the system logged */
  kind?: "remark";
}

export interface Claim {
  id: string;
  /** Internal reference generated at intake, e.g. CLM-PBR-0012 */
  ref: string;
  /** Official claim number, assigned at stage 2 */
  claimNo: string;
  jobCardNo: string;
  branchId: string;
  stage: StageNo;
  /** When the current stage began — every stage SLA counts from here (stage 5's transit counts from the order) */
  stageEnteredAt: number;
  createdAt: number;
  createdBy: string;
  /** Set when the vehicle is handed over; the claim is then "Delivered to Customer" */
  closedAt?: number;
  sample?: boolean;

  customerName: string;
  phone: string;
  email: string;
  address: string;
  regNo: string;
  model: string;
  chassisNo: string;
  odometer: string;
  insurer: string;
  policyNo: string;
  accidentDate: string;
  damage: string;
  /** Check-in / damage photo uploaded at intake, as a compressed JPEG data URL. Cards show the catalogue picture without one. */
  vehicleImage?: string;

  jobCard: { date: string; advisor: string; notes: string };
  estimate: { lines: EstimateLine[]; intimationDate: string; intimationMode: (typeof INTIMATION_MODES)[number]; intimationRef: string; notes: string };
  survey: { surveyor: string; phone: string; visit: (typeof VISIT_STATUSES)[number]; visitDate: string; notes: string; report: ClaimFile | null; approval: (typeof APPROVALS)[number] };
  parts: { orderNo: string; orderedAt: number | null; orderedBy: string; etaDays: number; receivedAt: number | null };
  transit: { dispatchRef: string; carrier: string; dispatchedAt: number | null; reachedAt: number | null };
  work: { ramp: ClaimFile | null; startedAt: number | null; notifiedAt: number | null };
  checklist: ChecklistItem[];
  billing: { invoiceNo: string; totalBill: number | null; insuranceCredited: number | null; depreciation: number | null; paymentRef: string; balancePaid: boolean };
  handover: { approved: boolean; approvedBy: string; approvedAt: number | null; gatepassNo: string; gatepassAt: number | null; collectedBy: string };

  stageLog: Partial<Record<StageNo, StageLogEntry>>;
  events: ClaimEvent[];
  /** SLA phases already escalated (so each breach raises its alert once) */
  escalations: string[];
}

/* ───────── SLA ───────── */

export type Health = "ok" | "warn" | "breach" | "done";

export interface SlaState {
  /** Stable key for the phase, used to raise each alert once */
  key: string;
  label: string;
  startedAt: number;
  dueAt: number;
  totalMs: number;
  remainingMs: number;
  health: Exclude<Health, "done">;
  /** This stage's rule sends an overdue claim to Top Management (see `isEscalated` for when) */
  topManagement: boolean;
  /** How long past the deadline before it does */
  escalateAfterMs: number;
}

const stateOf = (key: string, label: string, stage: StageNo, startedAt: number, dueAt: number, now: number, warnMs: number): SlaState => {
  const rule = stageSla(stage);
  const remainingMs = dueAt - now;
  return {
    key,
    label,
    startedAt,
    dueAt,
    totalMs: dueAt - startedAt,
    remainingMs,
    health: remainingMs <= 0 ? "breach" : remainingMs <= warnMs ? "warn" : "ok",
    topManagement: rule.escalate,
    escalateAfterMs: rule.escalateDays * DAY,
  };
};

/** Overdue for long enough that the stage's rule has sent it to Top Management. */
export const isEscalated = (s: SlaState | null): boolean => !!s && s.topManagement && s.health === "breach" && -s.remainingMs >= s.escalateAfterMs;

const PHASE_LABEL: Partial<Record<StageNo, string>> = { 6: "Dispatch & reach branch", 7: "Start repair on ramp", 8: "Complete repair" };

/** The clock that currently applies to a claim, or null once it is delivered. */
export function slaFor(c: Claim, now: number): SlaState | null {
  if (c.closedAt) return null;
  const rule = stageSla(c.stage);
  const dur = rule.durationH * HOUR;
  const warn = rule.warnH * HOUR;
  if (c.stage === 5 && c.parts.orderNo && c.parts.orderedAt !== null) return stateOf("5:transit", "Transit to Central (ETA)", 5, c.parts.orderedAt, c.parts.orderedAt + c.parts.etaDays * DAY, now, TRANSIT_WARN);
  const key = c.stage === 5 ? "5:order" : c.stage === 6 ? "6:central" : c.stage === 7 ? "7:start" : c.stage === 8 ? "8:repair" : `${c.stage}:stage`;
  const label = c.stage === 5 ? "Place Yamaha order" : (PHASE_LABEL[c.stage] ?? `Complete ${stageDef(c.stage).short}`);
  return stateOf(key, label, c.stage, c.stageEnteredAt, c.stageEnteredAt + dur, now, warn);
}

/** The stage's SLA in plain words, from the thresholds currently in force. */
export function slaSummary(no: StageNo): string {
  const h = fmtHours(stageSla(no).durationH);
  return no === 5 ? `Order within ${h} · transit ETA up to ${SLA.maxTransitDays} days` : `Complete within ${h}`;
}

export const healthOf = (c: Claim, now: number): Health => (c.closedAt ? "done" : (slaFor(c, now)?.health ?? "ok"));

export const HEALTH_LABEL: Record<Health, string> = { ok: "On Track", warn: "Approaching", breach: "Overdue", done: "Delivered to Customer" };

/** Whether completing the current stage right now would be late (recorded in the stage log). */
function lateAt(c: Claim, now: number): { dueAt?: number; breached: boolean } {
  const dur = stageSla(c.stage).durationH * HOUR;
  if (c.stage === 5) {
    const orderedAt = c.parts.orderedAt ?? now;
    const dueAt = orderedAt + c.parts.etaDays * DAY;
    return { dueAt, breached: orderedAt > c.stageEnteredAt + dur || now > dueAt };
  }
  const dueAt = c.stageEnteredAt + dur;
  return { dueAt, breached: now > dueAt };
}

/* ───────── Money ───────── */

export const estimateTotal = (c: Pick<Claim, "estimate">) => c.estimate.lines.reduce((s, l) => s + (l.amount || 0), 0);
/** What the customer still owes: the bill less what the insurer credited. Depreciation is the main part of it. */
export const customerPayable = (b: Claim["billing"]) => Math.max(0, (b.totalBill ?? 0) - (b.insuranceCredited ?? 0));

/* ───────── Stage requirements ───────── */

/** What is still missing before the claim can leave its current stage. Empty means it can advance. */
export function missingFor(c: Claim): string[] {
  const m: string[] = [];
  switch (c.stage) {
    case 1:
      if (!c.customerName.trim()) m.push("Customer name");
      if (c.phone.replace(/\D/g, "").length < 10) m.push("A 10-digit customer phone number");
      if (!c.regNo.trim()) m.push("Vehicle registration number");
      if (!c.model.trim()) m.push("Vehicle model");
      if (!c.jobCardNo.trim()) m.push("Job card number");
      if (!c.damage.trim()) m.push("Damage description");
      break;
    case 2:
      if (!c.jobCardNo.trim()) m.push("Job card number");
      if (!c.jobCard.advisor.trim()) m.push("Service advisor");
      if (!c.claimNo.trim()) m.push("Official claim number");
      break;
    case 3:
      if (!c.estimate.lines.some((l) => l.amount > 0)) m.push("At least one estimate line with an amount");
      if (!c.estimate.intimationDate) m.push("Insurance intimation date");
      break;
    case 4:
      if (!c.survey.surveyor.trim()) m.push("Surveyor name");
      if (c.survey.visit !== "Visited") m.push("Surveyor visit marked as Visited");
      if (!c.survey.report) m.push("Survey report upload");
      if (c.survey.approval !== "Approved") m.push("Survey report approved");
      break;
    case 5:
      if (!c.parts.orderNo.trim() || c.parts.orderedAt === null) m.push("Yamaha order placed with an order number");
      break;
    case 6:
      if (!c.transit.dispatchRef.trim()) m.push("Dispatch reference (vehicle / consignment no.)");
      break;
    case 7:
      if (!c.work.ramp) m.push("Ramp photo");
      break;
    case 8: {
      const open = c.checklist.filter((i) => !i.done).length;
      if (open) m.push(`${open} checklist item${open === 1 ? "" : "s"} still open`);
      break;
    }
    case 9:
      if (!c.billing.totalBill || c.billing.totalBill <= 0) m.push("Total bill amount");
      if (c.billing.insuranceCredited === null) m.push("Insurance credited amount (enter 0 if none)");
      else if (c.billing.insuranceCredited > (c.billing.totalBill ?? 0)) m.push("Insurance credited cannot exceed the total bill");
      if (customerPayable(c.billing) > 0 && !c.billing.balancePaid) m.push("Customer balance collected");
      break;
    case 10:
      if (!c.handover.approved) m.push("Branch Manager delivery approval");
      if (!c.handover.gatepassNo) m.push("Gatepass");
      break;
  }
  return m;
}

/** The log entry to record as `c` leaves its current stage at `now`. */
export const logEntry = (c: Claim, now: number): StageLogEntry => ({ enteredAt: c.stageEnteredAt, completedAt: now, ...lateAt(c, now) });

/* ───────── Numbers, labels, formatting ───────── */

const BRANCH_CODE: Record<string, string> = { hq: "HQ", perumbavoor: "PBR", kothamangalam: "KTM", allapra: "ALP", angamaly: "AGM", kalady: "KLD" };
export const branchCode = (id: string) => BRANCH_CODE[id] ?? id.slice(0, 3).toUpperCase();

const seqOf = (s: string) => Number(/(\d+)$/.exec(s)?.[1] ?? 0);
const pad = (n: number, w = 4) => String(n).padStart(w, "0");

/** Next internal claim reference for a branch, e.g. CLM-PBR-0012. */
export const nextRef = (claims: Claim[], branchId: string) => `CLM-${branchCode(branchId)}-${pad(Math.max(0, ...claims.filter((c) => c.branchId === branchId).map((c) => seqOf(c.ref))) + 1)}`;

/** Financial year label, April to March: 26-27. */
const fy = (d: Date) => {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
};
/** Next official claim number, e.g. VAA/CLM/26-27/0041. */
export const nextClaimNo = (claims: Claim[], now = new Date()) => `VAA/CLM/${fy(now)}/${pad(Math.max(40, ...claims.map((c) => seqOf(c.claimNo))) + 1)}`;
/** Next job card number, e.g. JC-26-0482. */
export const nextJobCardNo = (claims: Claim[], now = new Date()) => `JC-${String(now.getFullYear()).slice(2)}-${pad(Math.max(480, ...claims.map((c) => seqOf(c.jobCardNo))) + 1)}`;
export const nextGatepassNo = (claims: Claim[], now = new Date()) => `GP-${String(now.getFullYear()).slice(2)}-${pad(Math.max(0, ...claims.map((c) => seqOf(c.handover.gatepassNo))) + 1)}`;

export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
};

/** "04h 12m 05s", or "2d 03h 10m" once there are days left. Negative input is shown as its absolute value. */
export function formatSpan(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${p(h)}h ${p(m)}m`;
  return `${p(h)}h ${p(m)}m ${p(s % 60)}s`;
}

export const fmtDateTime = (ts: number) => new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
export const fmtDay = (ts: number) => new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const YAMAHA_MODELS = ["MT-15 V2", "YZF R15 V4 / R15M", "FZS-FI V4", "FZ-X", "Aerox 155", "RayZR 125 Fi Hybrid", "Fascino 125 Fi Hybrid", "YZF R3"];

/* ───────── Blank claim & sample data ───────── */

export const defaultChecklist = (): ChecklistItem[] => {
  const mk = (group: ChecklistItem["group"], labels: string[]): ChecklistItem[] => labels.map((label, i) => ({ id: `${group[0].toLowerCase()}${i + 1}`, group, label, done: false }));
  return [
    ...mk("Mechanical", ["Engine & transmission inspection", "Front fork and suspension alignment", "Brake system and ABS check", "Wiring harness and electricals"]),
    ...mk("Body repair", ["Damaged panels and fairings replaced", "Fuel tank and seat refit", "Frame and swingarm straightness check", "Mirrors, levers and footrests"]),
    ...mk("Painting", ["Surface preparation and primer", "Colour match and base coat", "Clear coat and polish", "Decals and graphics refit"]),
  ];
};

export type Intake = Pick<Claim, "branchId" | "customerName" | "phone" | "email" | "address" | "regNo" | "model" | "chassisNo" | "odometer" | "insurer" | "policyNo" | "accidentDate" | "damage" | "jobCardNo" | "vehicleImage">;

/** A new claim at stage 1 with every later stage empty. */
export function blankClaim(i: Intake, id: string, ref: string, by: string, now: number): Claim {
  return {
    ...i,
    id,
    ref,
    claimNo: "",
    stage: 1,
    stageEnteredAt: now,
    createdAt: now,
    createdBy: by,
    jobCard: { date: isoToday(), advisor: "", notes: "" },
    estimate: { lines: [], intimationDate: "", intimationMode: "Insurer portal", intimationRef: "", notes: "" },
    survey: { surveyor: "", phone: "", visit: "Scheduled", visitDate: "", notes: "", report: null, approval: "Pending" },
    parts: { orderNo: "", orderedAt: null, orderedBy: "", etaDays: SLA.maxTransitDays, receivedAt: null },
    transit: { dispatchRef: "", carrier: "", dispatchedAt: null, reachedAt: null },
    work: { ramp: null, startedAt: null, notifiedAt: null },
    checklist: defaultChecklist(),
    billing: { invoiceNo: "", totalBill: null, insuranceCredited: null, depreciation: null, paymentRef: "", balancePaid: false },
    handover: { approved: false, approvedBy: "", approvedAt: null, gatepassNo: "", gatepassAt: null, collectedBy: "" },
    stageLog: {},
    events: [{ at: now, text: `Claim ${ref} opened`, tone: "info" }],
    escalations: [],
  };
}

interface Seed {
  branchId: string;
  customerName: string;
  model: string;
  regNo: string;
  insurer: string;
  stage: StageNo;
  /** Hours spent so far in the current stage */
  inStageH: number;
  /** Fills in or tweaks the stage-specific state after the earlier stages are completed */
  tweak?: (c: Claim, now: number) => void;
}

/** Tick the first `count` checklist items (all of them by default). */
const markDone = (c: Claim, count = Number.POSITIVE_INFINITY) => {
  c.checklist.forEach((i, n) => {
    i.done = n < count;
  });
};

const SEEDS: Seed[] = [
  { branchId: "perumbavoor", customerName: "Rahul Menon", model: "MT-15 V2", regNo: "KL-40-AB-4521", insurer: "HDFC ERGO", stage: 1, inStageH: 1 },
  { branchId: "kothamangalam", customerName: "Anjali Nair", model: "Aerox 155", regNo: "KL-17-C-7788", insurer: "ICICI Lombard", stage: 2, inStageH: 3 },
  { branchId: "allapra", customerName: "Suresh Pillai", model: "YZF R15 V4 / R15M", regNo: "KL-63-DQ-1204", insurer: "Bajaj Allianz", stage: 3, inStageH: 6, tweak: (c) => { c.estimate.lines = [{ id: "l1", category: "Parts", description: "Front fairing set", amount: 7800 }, { id: "l2", category: "Labour", description: "Dismantle & refit", amount: 1800 }]; } },
  { branchId: "angamaly", customerName: "Fathima Rasheed", model: "RayZR 125 Fi Hybrid", regNo: "KL-07-BE-3320", insurer: "Reliance General", stage: 4, inStageH: 20, tweak: (c) => { c.survey = { ...c.survey, surveyor: "T. K. Varghese", phone: "98470 70707", visit: "Scheduled", visitDate: isoToday() }; } },
  { branchId: "perumbavoor", customerName: "Joseph Thomas", model: "FZS-FI V4", regNo: "KL-40-M-3321", insurer: "National Insurance", stage: 5, inStageH: 1 },
  { branchId: "kalady", customerName: "Deepak Varma", model: "FZ-X", regNo: "KL-63-F-9090", insurer: "HDFC ERGO", stage: 5, inStageH: 4.17 },
  { branchId: "kothamangalam", customerName: "Sreeja Mohan", model: "Fascino 125 Fi Hybrid", regNo: "KL-17-T-5512", insurer: "New India Assurance", stage: 5, inStageH: 7.5 },
  {
    branchId: "angamaly",
    customerName: "Nikhil Raj",
    model: "YZF R3",
    regNo: "KL-07-CK-8806",
    insurer: "ICICI Lombard",
    stage: 5,
    inStageH: 30,
    tweak: (c, now) => { c.parts = { ...c.parts, orderNo: "YMD-PO-884120", orderedAt: now - 26 * HOUR, orderedBy: "Parts Manager", etaDays: 5 }; },
  },
  { branchId: "allapra", customerName: "Maya Krishnan", model: "MT-15 V2", regNo: "KL-63-G-2210", insurer: "Bajaj Allianz", stage: 6, inStageH: 3, tweak: (c, now) => { c.parts = { ...c.parts, receivedAt: now - 3 * HOUR }; } },
  { branchId: "perumbavoor", customerName: "Faisal Ahmed", model: "Aerox 155", regNo: "KL-40-N-6643", insurer: "ICICI Lombard", stage: 6, inStageH: 14, tweak: (c, now) => { c.parts = { ...c.parts, receivedAt: now - 14 * HOUR }; } },
  { branchId: "kalady", customerName: "Lekshmi Pillai", model: "FZS-FI V4", regNo: "KL-63-H-1187", insurer: "United India Insurance", stage: 6, inStageH: 10, tweak: (c, now) => { c.parts = { ...c.parts, receivedAt: now - 10 * HOUR }; } },
  { branchId: "kothamangalam", customerName: "Arun Kumar", model: "YZF R15 V4 / R15M", regNo: "KL-17-W-9021", insurer: "HDFC ERGO", stage: 7, inStageH: 2 },
  { branchId: "angamaly", customerName: "Divya Suresh", model: "RayZR 125 Fi Hybrid", regNo: "KL-07-AF-4417", insurer: "Reliance General", stage: 7, inStageH: 6.9 },
  {
    branchId: "perumbavoor",
    customerName: "Vishnu Prasad",
    model: "MT-15 V2",
    regNo: "KL-40-R-1902",
    insurer: "HDFC ERGO",
    stage: 8,
    inStageH: 20,
    tweak: (c) => markDone(c, 5),
  },
  { branchId: "kalady", customerName: "Reshma Babu", model: "Fascino 125 Fi Hybrid", regNo: "KL-63-K-7765", insurer: "National Insurance", stage: 8, inStageH: 50, tweak: (c) => markDone(c, 8) },
  { branchId: "perumbavoor", customerName: "George Mathew", model: "FZ-X", regNo: "KL-40-S-3098", insurer: "ICICI Lombard", stage: 9, inStageH: 5, tweak: (c) => markDone(c) },
  {
    branchId: "perumbavoor",
    customerName: "Neethu Joseph",
    model: "Aerox 155",
    regNo: "KL-40-P-5521",
    insurer: "Bajaj Allianz",
    stage: 10,
    inStageH: 4,
    tweak: (c) => {
      markDone(c);
      c.billing = { invoiceNo: "INV-26-1184", totalBill: 24600, insuranceCredited: 20300, depreciation: 3800, paymentRef: "UPI 4410 2288", balancePaid: true };
    },
  },
  {
    branchId: "kothamangalam",
    customerName: "Basil Varghese",
    model: "MT-15 V2",
    regNo: "KL-17-V-2204",
    insurer: "HDFC ERGO",
    stage: 10,
    inStageH: 3,
    tweak: (c, now) => {
      markDone(c);
      c.billing = { invoiceNo: "INV-26-1171", totalBill: 18900, insuranceCredited: 15900, depreciation: 2600, paymentRef: "Cash", balancePaid: true };
      c.handover = { approved: true, approvedBy: "Branch Manager - Kothamangalam", approvedAt: now - 2 * HOUR, gatepassNo: "GP-26-0007", gatepassAt: now - 1.5 * HOUR, collectedBy: c.customerName };
      c.closedAt = now - 1.5 * HOUR;
    },
  },
];

/** Demo claims across the branches with every stage populated, timed relative to `now` so timers show all three colours. */
export function buildSampleClaims(now: number): Claim[] {
  const counts: Record<string, number> = {};
  return SEEDS.map((s, i) => {
    counts[s.branchId] = (counts[s.branchId] ?? 0) + 1;
    const enteredAt = now - s.inStageH * HOUR;
    const ref = `CLM-${branchCode(s.branchId)}-${pad(100 + counts[s.branchId])}`;
    const c = blankClaim(
      {
        branchId: s.branchId,
        customerName: s.customerName,
        phone: `98470 ${String(40000 + i * 137).slice(0, 5)}`,
        email: "",
        address: "Ernakulam, Kerala",
        regNo: s.regNo,
        model: s.model,
        chassisNo: `ME1RG66${String(10000 + i * 7).padStart(5, "0")}N${200000 + i}`.slice(0, 17),
        odometer: String(2000 + i * 913),
        insurer: s.insurer,
        policyNo: `POL-${700000 + i * 31}`,
        accidentDate: new Date(now - (s.stage + 2) * DAY).toISOString().slice(0, 10),
        damage: ["Front fairing and headlight cracked, fork bent", "Rear panel and tail section damaged in a low-speed collision", "Side fairing scraped, handlebar and mirror broken", "Fuel tank dented, left footrest bent"][i % 4],
        jobCardNo: `JC-26-${pad(470 + i)}`,
      },
      `clm-sample-${i + 1}`,
      ref,
      "Demo data",
      enteredAt,
    );
    c.sample = true;
    c.stage = s.stage;
    c.stageEnteredAt = enteredAt;
    c.createdAt = now - (s.stage * 6 + s.inStageH) * HOUR;

    // Fill in every earlier stage, walking backwards so each one has a plausible entry in the log.
    if (s.stage > 1) c.claimNo = `VAA/CLM/${fy(new Date(now))}/${pad(41 + i)}`;
    c.jobCard = { date: c.accidentDate, advisor: "Service Advisor", notes: "" };
    if (s.stage > 3) c.estimate = { ...c.estimate, lines: [{ id: "l1", category: "Parts", description: "Front fairing set", amount: 7800 }, { id: "l2", category: "Parts", description: "Fork assembly", amount: 9200 }, { id: "l3", category: "Labour", description: "Dismantle, fit & align", amount: 3400 }, { id: "l4", category: "Paint", description: "Panel paint & polish", amount: 3200 }], intimationDate: c.accidentDate, intimationRef: `INT-${900 + i}` };
    if (s.stage > 4) c.survey = { surveyor: "T. K. Varghese", phone: "98470 70707", visit: "Visited", visitDate: c.accidentDate, notes: "Damage consistent with the reported accident. Parts replacement approved.", report: { name: "survey-report.pdf", size: 184_320, at: enteredAt - 30 * HOUR, stored: false }, approval: "Approved" };
    if (s.stage > 5) c.parts = { orderNo: `YMD-PO-${884000 + i * 17}`, orderedAt: enteredAt - 90 * HOUR, orderedBy: "Parts Manager", etaDays: SLA.maxTransitDays, receivedAt: enteredAt };
    if (s.stage > 6) c.transit = { dispatchRef: `KL-07-GT-${1000 + i}`, carrier: "Branch pickup van", dispatchedAt: enteredAt - 6 * HOUR, reachedAt: enteredAt };
    if (s.stage > 7) c.work = { ramp: { name: "ramp-photo.jpg", size: 96_000, at: enteredAt - 40 * HOUR, stored: false }, startedAt: enteredAt - 40 * HOUR, notifiedAt: enteredAt - 40 * HOUR };

    s.tweak?.(c, now);

    for (let n = (s.stage - 1) as number, end = enteredAt; n >= 1; n--) {
      const took = n === 5 ? 80 * HOUR : 4 * HOUR;
      c.stageLog[n as StageNo] = { enteredAt: end - took, completedAt: end, breached: false };
      end -= took;
    }
    c.events = [{ at: c.createdAt, text: `Claim ${ref} opened`, tone: "info" as const }, ...Array.from({ length: s.stage - 1 }, (_, k) => ({ at: c.stageLog[(k + 1) as StageNo]?.completedAt ?? c.createdAt, text: `Stage ${k + 1} complete — ${stageDef((k + 1) as StageNo).short}`, tone: "ok" as const }))].sort((a, z) => z.at - a.at);
    return c;
  });
}
