/* ───────── Vehicle Claims & Workshop — domain model and SLA rules ───────── */

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

/** Fuel level written on the job card at check-in. */
export const FUEL_LEVELS = ["E", "1/4", "1/2", "3/4", "F"] as const;
export const JOB_BAYS = ["BAY1", "BAY2", "BAY3", "BAY4", "BAY5", "BAY6"] as const;
export const JOB_TYPES = ["Accidental", "Paid", "Free"] as const;

/** The digitised Vijayagiri Yamaha Job Card (Ver 2.1), filled in at Stage 2. The job card number itself is `Claim.jobCardNo`. */
export interface JobCard {
  date: string;
  advisor: string;
  notes: string;
  bay: string;
  couponNo: string;
  amc: boolean;
  pp: boolean;
  jobType: (typeof JOB_TYPES)[number];
  telReminder: boolean;
  /** Local date and time as `YYYY-MM-DDTHH:mm`, the format a datetime-local input uses */
  receivedAt: string;
  promisedAt: string;
  engineNo: string;
  engineCc: string;
  saleDate: string;
  fuel: (typeof FUEL_LEVELS)[number];
  toolkit: boolean;
  firstAid: boolean;
  serviceManual: boolean;
  returnOldParts: boolean;
  supervisor: string;
  mechanic: string;
  estParts: number | null;
  estLabour: number | null;
}

export const blankJobCard = (): JobCard => ({
  date: isoToday(),
  advisor: "",
  notes: "",
  bay: "",
  couponNo: "",
  amc: false,
  pp: false,
  jobType: "Accidental",
  telReminder: false,
  receivedAt: "",
  promisedAt: "",
  engineNo: "",
  engineCc: "",
  saleDate: "",
  fuel: "1/2",
  toolkit: false,
  firstAid: false,
  serviceManual: false,
  returnOldParts: false,
  supervisor: "",
  mechanic: "",
  estParts: null,
  estLabour: null,
});

/** A claim's job card with every field present, so claims saved before the full job card existed still open. */
export const jobCardOf = (c: Pick<Claim, "jobCard">): JobCard => ({ ...blankJobCard(), ...c.jobCard });

/** A timestamp as the `YYYY-MM-DDTHH:mm` a datetime-local input wants, in the viewer's time zone. */
export const toLocalInput = (ts: number) => {
  const d = new Date(ts);
  return `${isoDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const PART_STATUSES = ["Pending Order", "PO Generated", "Dispatched"] as const;
export type PartStatus = (typeof PART_STATUSES)[number];
export const PART_VENDORS = ["Primary Yamaha OEM Depot", "Local Distributor"] as const;

export interface PartLine {
  id: string;
  code: string;
  description: string;
  qty: number;
  unitPrice: number | null;
  /** Empty means the order's default vendor */
  vendor: string;
  status: PartStatus;
}

/** A row is complete when it names the part and has a quantity and a price. */
export const partComplete = (l: PartLine) => !!l.description.trim() && l.qty >= 1 && (l.unitPrice ?? 0) > 0;
export const partsTotal = (lines: PartLine[]) => lines.reduce((t, l) => t + (l.qty >= 1 ? l.qty : 0) * (l.unitPrice ?? 0), 0);

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

  customerName: string;
  phone: string;
  /** Second contact number, optional */
  altPhone?: string;
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

  jobCard: JobCard;
  estimate: { lines: EstimateLine[]; intimationDate: string; intimationMode: (typeof INTIMATION_MODES)[number]; intimationRef: string; notes: string };
  survey: { surveyor: string; phone: string; visit: (typeof VISIT_STATUSES)[number]; visitDate: string; notes: string; report: ClaimFile | null; approval: (typeof APPROVALS)[number] };
  parts: {
    orderNo: string;
    orderedAt: number | null;
    orderedBy: string;
    etaDays: number;
    receivedAt: number | null;
    /** The spare parts on the order. Absent on claims saved before the parts table existed. */
    lines?: PartLine[];
    /** Order-level vendor; the free-text name when "Other" was chosen */
    vendor?: string;
    /** False when the repair needs no spare parts. Missing means true. */
    needed?: boolean;
    /** Send the order to the vendor through the n8n automation. Missing means true. */
    notify?: boolean;
  };
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
      if (c.customerName.trim().length < 2) m.push("Customer name (at least 2 characters)");
      if (!isIndianMobile(c.phone)) m.push("A valid 10-digit mobile number");
      if (!normalizeRegNo(c.regNo)) m.push("A valid registration number (like KL-40-AB-1234)");
      if (!c.model.trim()) m.push("Vehicle model");
      if (c.damage.trim().length < 5) m.push("Damage summary (at least 5 characters)");
      break;
    case 2: {
      const j = jobCardOf(c);
      if (!c.jobCardNo.trim()) m.push("Job card number");
      if (!c.claimNo.trim()) m.push("Official claim number");
      if (!j.bay) m.push("Bay assignment");
      if (!j.receivedAt) m.push("Vehicle receiving date and time");
      if (!j.promisedAt) m.push("Promised delivery date and time");
      else if (j.receivedAt && j.promisedAt <= j.receivedAt) m.push("Promised delivery after the receiving time");
      if (!c.chassisNo.trim()) m.push("Frame / chassis number");
      if (!c.odometer.trim()) m.push("Odometer reading");
      if (!j.supervisor.trim()) m.push("Supervisor name");
      break;
    }
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
    case 5: {
      const p = c.parts;
      if (p.needed === false) break;
      const lines = p.lines ?? [];
      // Claims ordered before the parts table existed have no lines to check.
      if (!(p.lines === undefined && p.orderedAt !== null)) {
        if (!lines.some(partComplete)) m.push("At least one spare part with a quantity and unit price");
        else if (!lines.every(partComplete)) m.push("Complete or remove the unfinished part rows");
        if (!p.vendor?.trim()) m.push("Vendor");
      }
      if (!p.orderNo.trim() || p.orderedAt === null) m.push("Yamaha order placed with an order number");
      break;
    }
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
/** Next job card number in the dealer's format, e.g. JC/10353/2026-27/0482. */
export const nextJobCardNo = (claims: Claim[], now = new Date()) => {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `JC/10353/${y}-${String(y + 1).slice(2)}/${pad(Math.max(480, ...claims.map((c) => seqOf(c.jobCardNo))) + 1)}`;
};
export const nextGatepassNo = (claims: Claim[], now = new Date()) => `GP-${String(now.getFullYear()).slice(2)}-${pad(Math.max(0, ...claims.map((c) => seqOf(c.handover.gatepassNo))) + 1)}`;

const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
export const isoToday = () => isoDate(new Date());

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

/** A 10-digit Indian mobile number (starts 6 to 9), with an optional +91, 91 or 0 in front and any spacing. */
export function isIndianMobile(phone: string): boolean {
  let d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

const REG_NO = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/;
/** A registration number in the standard KL-40-AB-1234 form, or null when it doesn't look like one. Spaces and hyphens are optional on input. */
export function normalizeRegNo(reg: string): string | null {
  const m = REG_NO.exec(reg.toUpperCase().replace(/[\s-]/g, ""));
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3]}-${m[4]}` : null;
}

export const YAMAHA_MODELS = ["MT-15 V2", "YZF R15 V4 / R15M", "FZS-FI V4", "FZ-X", "Aerox 155", "RayZR 125 Fi Hybrid", "Fascino 125 Fi Hybrid", "YZF R3"];

/* ───────── Blank claim ───────── */

export const defaultChecklist = (): ChecklistItem[] => {
  const mk = (group: ChecklistItem["group"], labels: string[]): ChecklistItem[] => labels.map((label, i) => ({ id: `${group[0].toLowerCase()}${i + 1}`, group, label, done: false }));
  return [
    ...mk("Mechanical", ["Engine & transmission inspection", "Front fork and suspension alignment", "Brake system and ABS check", "Wiring harness and electricals"]),
    ...mk("Body repair", ["Damaged panels and fairings replaced", "Fuel tank and seat refit", "Frame and swingarm straightness check", "Mirrors, levers and footrests"]),
    ...mk("Painting", ["Surface preparation and primer", "Colour match and base coat", "Clear coat and polish", "Decals and graphics refit"]),
  ];
};

/** What the quick Stage 1 check-in asks for. The rest of the record is filled in at Stage 2 and later. */
export type Intake = Pick<Claim, "branchId" | "customerName" | "phone" | "altPhone" | "regNo" | "model" | "insurer" | "policyNo" | "damage" | "vehicleImage">;
type IntakeExtras = Partial<Pick<Claim, "email" | "address" | "chassisNo" | "odometer" | "accidentDate" | "jobCardNo">>;

/** A new claim at stage 1 with every later stage empty. */
export function blankClaim(i: Intake & IntakeExtras, id: string, ref: string, by: string, now: number): Claim {
  return {
    email: "",
    address: "",
    chassisNo: "",
    odometer: "",
    accidentDate: isoToday(),
    jobCardNo: "",
    ...i,
    id,
    ref,
    claimNo: "",
    stage: 1,
    stageEnteredAt: now,
    createdAt: now,
    createdBy: by,
    jobCard: blankJobCard(),
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
