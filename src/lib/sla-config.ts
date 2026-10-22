import type { StageNo } from "./claims";

/** One stage's SLA rule. Durations are kept in hours; the settings screen lets people enter them as hours or days. */
export interface StageSla {
  /** How long the stage may run before it is Overdue */
  durationH: number;
  /** How long before the deadline the amber "Approaching" state starts */
  warnH: number;
  /** Whether an overdue claim is sent to Top Management (Code Red) */
  escalate: boolean;
  /** Days overdue before that escalation (0 = the moment it lapses) */
  escalateDays: number;
}

export type SlaConfig = Record<StageNo, StageSla>;

export const MIN_HOURS = 1;
export const MAX_HOURS = 365 * 24;
export const MAX_ESCALATE_DAYS = 365;

const rule = (durationH: number, warnH: number, escalate = false): StageSla => ({ durationH, warnH, escalate, escalateDays: escalate ? 0 : 1 });

/** The Vijayagiri SOP: stages 5 to 8 are the timed ones in the handbook; the rest get a generous working window. */
export const DEFAULT_SLA: SlaConfig = {
  1: rule(24, 4),
  2: rule(24, 4),
  3: rule(48, 8),
  4: rule(72, 12),
  5: rule(5, 1.25),
  6: rule(12, 3, true),
  7: rule(8, 2),
  8: rule(48, 12),
  9: rule(48, 8),
  10: rule(24, 4),
};

// The rules every SLA calculation reads. The settings store keeps this in step with what the user saved.
let active: SlaConfig = DEFAULT_SLA;
export const stageSla = (no: StageNo): StageSla => active[no];
export const setActiveSla = (config: SlaConfig) => {
  active = config;
};

/** Anything stored or typed in, checked and filled in from the defaults, so a bad value can never reach the timers. */
export function sanitizeSla(raw: unknown): SlaConfig {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, Partial<StageSla> | undefined>;
  const out = {} as SlaConfig;
  for (const key of Object.keys(DEFAULT_SLA)) {
    const no = Number(key) as StageNo;
    const d = DEFAULT_SLA[no];
    const r = src[key] ?? {};
    const durationH = typeof r.durationH === "number" && r.durationH >= MIN_HOURS && r.durationH <= MAX_HOURS ? r.durationH : d.durationH;
    const warnH = typeof r.warnH === "number" && r.warnH >= MIN_HOURS && r.warnH < durationH ? r.warnH : Math.min(d.warnH, durationH / 2);
    const days = typeof r.escalateDays === "number" && Number.isInteger(r.escalateDays) && r.escalateDays >= 0 && r.escalateDays <= MAX_ESCALATE_DAYS ? r.escalateDays : d.escalateDays;
    out[no] = { durationH, warnH, escalate: typeof r.escalate === "boolean" ? r.escalate : d.escalate, escalateDays: days };
  }
  return out;
}

export const sameSla = (a: SlaConfig, b: SlaConfig) => (Object.keys(a) as unknown as StageNo[]).every((n) => a[n].durationH === b[n].durationH && a[n].warnH === b[n].warnH && a[n].escalate === b[n].escalate && a[n].escalateDays === b[n].escalateDays);

/** "5 hours", "1.25 hours", "2 days" */
export function fmtHours(h: number): string {
  if (h >= 24 && h % 24 === 0) return `${h / 24} day${h === 24 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"}`;
}
