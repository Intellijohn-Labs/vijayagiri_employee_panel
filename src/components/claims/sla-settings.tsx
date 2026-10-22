"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { STAGES, type StageNo } from "@/lib/claims";
import { DEFAULT_SLA, MAX_ESCALATE_DAYS, MAX_HOURS, MIN_HOURS, sameSla, type SlaConfig } from "@/lib/sla-config";
import { cn } from "@/lib/utils";
import { useSlaConfig } from "@/store/sla-config-store";
import { toast } from "@/store/toast-store";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Checkbox, Input } from "@/components/ui/primitives";

type Unit = "h" | "d";
interface Row {
  dur: string;
  durUnit: Unit;
  warn: string;
  warnUnit: Unit;
  escalate: boolean;
  days: string;
}
type Draft = Record<StageNo, Row>;

const HINT: Partial<Record<StageNo, string>> = {
  5: "Covers placing the Yamaha order. Transit then runs to each order's own ETA (up to 6 days) and warns 1 day before it.",
  6: "From the moment parts reach Central to arriving at the branch.",
  7: "From parts arriving at the branch to repair starting on the ramp.",
  8: "From repair starting to repair complete.",
};

/** Whole days read better as days; anything else stays in hours. */
const asField = (h: number): { v: string; u: Unit } => (h >= 24 && h % 24 === 0 ? { v: String(h / 24), u: "d" } : { v: String(h), u: "h" });

const toDraft = (c: SlaConfig): Draft => {
  const out = {} as Draft;
  for (const st of STAGES) {
    const r = c[st.no];
    const d = asField(r.durationH);
    const w = asField(r.warnH);
    out[st.no] = { dur: d.v, durUnit: d.u, warn: w.v, warnUnit: w.u, escalate: r.escalate, days: String(r.escalateDays) };
  }
  return out;
};

const hours = (v: string, u: Unit) => (v.trim() === "" ? NaN : Number(v) * (u === "d" ? 24 : 1));

interface Parsed {
  config: SlaConfig;
  errors: Partial<Record<StageNo, { dur?: string; warn?: string; days?: string }>>;
}

/** Turns what was typed into rules, with a message against every field that cannot be used. */
function parse(draft: Draft): Parsed {
  const config = {} as SlaConfig;
  const errors: Parsed["errors"] = {};
  for (const st of STAGES) {
    const r = draft[st.no];
    const durationH = hours(r.dur, r.durUnit);
    const warnH = hours(r.warn, r.warnUnit);
    const days = r.days.trim() === "" ? NaN : Number(r.days);
    const e: { dur?: string; warn?: string; days?: string } = {};
    if (!(durationH >= MIN_HOURS)) e.dur = "Minimum 1 hour";
    else if (durationH > MAX_HOURS) e.dur = "Maximum 365 days";
    if (!(warnH >= MIN_HOURS)) e.warn = "Minimum 1 hour";
    else if (durationH >= MIN_HOURS && warnH >= durationH) e.warn = "Must be shorter than the target";
    if (r.escalate && !(Number.isInteger(days) && days >= 0 && days <= MAX_ESCALATE_DAYS)) e.days = "Whole days, 0 or more";
    if (e.dur || e.warn || e.days) errors[st.no] = e;
    config[st.no] = { durationH, warnH, escalate: r.escalate, escalateDays: r.escalate ? days : DEFAULT_SLA[st.no].escalateDays };
  }
  return { config, errors };
}

function UnitToggle({ value, onChange, label }: { value: Unit; onChange: (u: Unit) => void; label: string }) {
  return (
    <fieldset aria-label={`${label} unit`} className="m-0 inline-flex h-9 min-w-0 shrink-0 overflow-hidden rounded-md border border-line bg-surface p-0 text-[12px] font-medium shadow-card">
      {(["h", "d"] as const).map((u) => (
        <button key={u} type="button" aria-pressed={value === u} onClick={() => onChange(u)} className={cn("w-9 cursor-pointer outline-none transition-colors focus-visible:shadow-ring", value === u ? "bg-accent text-accent-fg" : "text-muted hover:bg-hover hover:text-fg")}>
          {u === "h" ? "Hrs" : "Days"}
        </button>
      ))}
    </fieldset>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-[11.5px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** "Configure SLA Thresholds" for the Claims toolbar: a slide-over to set each stage's deadline, warning buffer and Top Management escalation. */
export function SlaSettings() {
  const config = useSlaConfig((s) => s.config);
  const save = useSlaConfig((s) => s.save);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(config));

  const { config: parsed, errors } = parse(draft);
  const valid = Object.keys(errors).length === 0;
  const changed = valid && !sameSla(parsed, config);
  const atDefaults = sameSla(parse(draft).config, DEFAULT_SLA) && valid;
  const patch = (no: StageNo, p: Partial<Row>) => setDraft((d) => ({ ...d, [no]: { ...d[no], ...p } }));

  return (
    <>
      <Button
        leading={<SlidersHorizontal className="h-3.5 w-3.5" />}
        onClick={() => {
          setDraft(toDraft(config));
          setOpen(true);
        }}
      >
        Configure SLA Thresholds
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        width={760}
        title="Configure SLA Thresholds"
        description="Set the deadline, warning and escalation rule for each of the 10 stages."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" leading={<RotateCcw className="h-3.5 w-3.5" />} disabled={atDefaults} onClick={() => setDraft(toDraft(DEFAULT_SLA))}>
              Reset to Vijayagiri Defaults
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!changed}
                onClick={() => {
                  save(parsed);
                  setOpen(false);
                  toast.success("SLA thresholds updated successfully", "Every claim's status, the Code Red count and the stage badges now use the new thresholds.");
                }}
              >
                Save thresholds
              </Button>
            </div>
          </div>
        }
      >
        <ol className="divide-y divide-line">
          {STAGES.map((st) => {
            const r = draft[st.no];
            const e = errors[st.no] ?? {};
            return (
              <li key={st.no} className="px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg">{st.no}</span>
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold leading-5 text-fg">{st.name}</h3>
                    {HINT[st.no] && <p className="text-[12px] text-muted">{HINT[st.no]}</p>}
                  </div>
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Field label={st.no === 5 ? "Order within" : "Max target duration"} error={e.dur}>
                    <div className="flex gap-1.5">
                      <Input type="number" inputMode="decimal" min={1} step="any" value={r.dur} invalid={!!e.dur} aria-label={`Stage ${st.no} max target duration`} onChange={(ev) => patch(st.no, { dur: ev.target.value })} />
                      <UnitToggle label={`Stage ${st.no} target`} value={r.durUnit} onChange={(u) => patch(st.no, { durUnit: u })} />
                    </div>
                  </Field>
                  <Field label="Warning buffer" error={e.warn}>
                    <div className="flex gap-1.5">
                      <Input type="number" inputMode="decimal" min={1} step="any" value={r.warn} invalid={!!e.warn} aria-label={`Stage ${st.no} warning buffer`} onChange={(ev) => patch(st.no, { warn: ev.target.value })} />
                      <UnitToggle label={`Stage ${st.no} warning`} value={r.warnUnit} onChange={(u) => patch(st.no, { warnUnit: u })} />
                    </div>
                  </Field>
                  <Field label="Escalate to Top Mgmt" error={e.days}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={r.escalate} onChange={(v) => patch(st.no, { escalate: v })} label={r.escalate ? "Yes, after" : "No"} />
                      {r.escalate && (
                        <>
                          <Input type="number" inputMode="numeric" min={0} step={1} value={r.days} invalid={!!e.days} aria-label={`Stage ${st.no} escalation threshold in days`} className="w-16" onChange={(ev) => patch(st.no, { days: ev.target.value })} />
                          <span className="text-[12px] text-muted">days late</span>
                        </>
                      )}
                    </div>
                  </Field>
                </div>
              </li>
            );
          })}
        </ol>
      </Drawer>
    </>
  );
}
