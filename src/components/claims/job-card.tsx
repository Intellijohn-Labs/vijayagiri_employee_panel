"use client";

import type { ReactNode } from "react";
import { FUEL_LEVELS, JOB_BAYS, JOB_TYPES, type Claim, type JobCard } from "@/lib/claims";
import { cn, formatINR } from "@/lib/utils";
import { PlateBadge } from "./vehicle";

/** What the Stage 2 sheet edits. The job card number, claim number, chassis, odometer and damage live on the claim itself. */
export interface JobCardForm {
  jobCardNo: string;
  claimNo: string;
  chassisNo: string;
  odometer: string;
  damage: string;
  jc: JobCard;
}

/** The Stage 2 fields that must be filled before saving, and the message to show under each when left empty. */
export type JobCardField = "jobCardNo" | "claimNo" | "bay" | "receivedAt" | "promisedAt" | "chassisNo" | "odometer" | "supervisor";
export type JobCardErrors = Partial<Record<JobCardField, string>>;
export const REQUIRED_MESSAGE = "This field is required to save";

const FUEL_LABEL: Record<(typeof FUEL_LEVELS)[number], string> = { E: "E", "1/4": "¼", "1/2": "½", "3/4": "¾", F: "F" };

/* The sheet is a printed form: always dark ink on white, in either theme. */
const line = "w-full min-w-0 border-0 border-b border-neutral-400 bg-transparent px-0.5 py-0.5 text-[13px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-700 disabled:cursor-default disabled:border-transparent [color-scheme:light]";
const invalidLine = "!border-red-500 bg-red-50/50 focus:!border-red-600 focus:ring-2 focus:ring-red-500/20 dark:bg-red-950/20";
const cell = "border-b border-r border-neutral-400 p-2";
const bar = "border-b border-neutral-400 bg-neutral-100 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-700";

function Cell({ label, children, className, error, field }: { label: string; children: ReactNode; className?: string; error?: string; field?: JobCardField }) {
  return (
    <div className={cn(cell, className)} data-field={field} data-invalid={error ? "" : undefined}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      {children}
      {error && <p role="alert" className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

/** Label + input for the compact staff / particulars blocks, with the same red treatment as `Cell`. */
function Labelled({ label, error, field, className, children }: { label: string; error?: string; field?: JobCardField; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)} data-field={field} data-invalid={error ? "" : undefined}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
      {error && <span role="alert" className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

function Tick({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center gap-2 text-[13px] text-neutral-900", disabled ? "cursor-default" : "cursor-pointer")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-700" />
      {label}
    </label>
  );
}

/** Pick one of a few labelled options, shown as tags. */
function Tags<T extends string>({ value, options, onChange, label, disabled }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <fieldset aria-label={label} className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn("rounded border px-2 py-0.5 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50", value === o ? "border-blue-800 bg-blue-800 text-white" : "border-neutral-400 bg-white text-neutral-600", !disabled && value !== o && "hover:border-blue-700 hover:text-blue-800", disabled && "cursor-default")}
        >
          {o}
        </button>
      ))}
    </fieldset>
  );
}

function YesNo({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <Tags value={value ? "Yes" : "No"} options={["Yes", "No"] as const} onChange={(v) => onChange(v === "Yes")} label={label} disabled={disabled} />;
}

/** Fuel level at check-in: a five-segment gauge, E to F, filled up to the chosen mark. */
function FuelGauge({ value, onChange, disabled }: { value: JobCard["fuel"]; onChange: (v: JobCard["fuel"]) => void; disabled?: boolean }) {
  const at = FUEL_LEVELS.indexOf(value);
  return (
    <fieldset aria-label="Fuel level" className="m-0 border-0 p-0">
      <div className="flex gap-1">
        {FUEL_LEVELS.map((f, i) => (
          <button
            key={f}
            type="button"
            aria-pressed={value === f}
            aria-label={`Fuel ${f}`}
            disabled={disabled}
            onClick={() => onChange(f)}
            className={cn("flex h-8 flex-1 items-end justify-center rounded-sm border pb-0.5 text-[12px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600/50", disabled && "cursor-default", i <= at ? (at === 0 ? "border-red-600 bg-red-500 text-white" : at === 1 ? "border-amber-500 bg-amber-400 text-neutral-900" : "border-blue-800 bg-blue-700 text-white") : "border-neutral-400 bg-white text-neutral-500")}
          >
            {FUEL_LABEL[f]}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">{at === 0 ? "Reserve: refuel soon" : `Tank about ${value === "F" ? "full" : FUEL_LABEL[value]}`}</p>
    </fieldset>
  );
}

/**
 * The Vijayagiri Yamaha Job Card (Ver 2.1) as a paper form: header, meta and schedule strip, then repairs and
 * estimate on the left and the vehicle's particulars, check-in and staff on the right.
 */
export function JobCardSheet({ claim, value, onChange, readOnly, onAutoJobNo, onAutoClaimNo, canAutoClaimNo, errors = {} }: { errors?: JobCardErrors; claim: Claim; value: JobCardForm; onChange: (v: JobCardForm) => void; readOnly?: boolean; onAutoJobNo: () => void; onAutoClaimNo: () => void; canAutoClaimNo: boolean }) {
  const { jc } = value;
  const bad = (k: JobCardField) => (errors[k] ? invalidLine : undefined);
  const setJc = (p: Partial<JobCard>) => onChange({ ...value, jc: { ...jc, ...p } });
  const set = (p: Partial<JobCardForm>) => onChange({ ...value, ...p });
  const money = (k: "estParts" | "estLabour", label: string) => (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-300 px-2.5 py-1.5">
      <label htmlFor={`jc-${k}`} className="text-[12.5px] text-neutral-800">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-neutral-500">₹</span>
        <input id={`jc-${k}`} type="number" inputMode="numeric" min={0} value={jc[k] ?? ""} disabled={readOnly} onChange={(e) => setJc({ [k]: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} placeholder="0" className={cn(line, "w-28 text-right tabular-nums")} />
      </div>
    </div>
  );
  const total = (jc.estParts ?? 0) + (jc.estLabour ?? 0);
  const auto = (onClick: () => void, disabled?: boolean) =>
    !readOnly && (
      <button type="button" onClick={onClick} disabled={disabled} className="shrink-0 text-[11px] font-semibold text-blue-700 underline-offset-2 outline-none hover:underline focus-visible:underline disabled:cursor-not-allowed disabled:opacity-40">
        Auto
      </button>
    );

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-6 text-neutral-900 shadow-sm dark:border-neutral-700 [color-scheme:light]">
      {/* Letterhead */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-neutral-900 pb-3">
        <div>
          <p className="text-[26px] font-extrabold leading-none tracking-[0.22em] text-[#003399]">YAMAHA</p>
          <p className="mt-1 text-[11px] font-semibold italic tracking-wide text-neutral-600">Revs Your Heart</p>
          <h3 className="mt-3 text-[17px] font-extrabold tracking-tight text-neutral-900">
            JOB CARD <span className="font-semibold text-neutral-600">(Ver 2.1)</span>
          </h3>
        </div>
        <address className="max-w-sm text-right text-[11.5px] not-italic leading-5 text-neutral-700">
          <span className="block text-[13px] font-bold tracking-wide text-neutral-900">VIJAYAGIRI AUTO AGENCIES</span>
          Ground Floor, VII/231 - 1,2,3,4,5, Near St. John&apos;s Catholic Church, NH 544, Thottakkattukara
          <span className="block font-semibold">9562611200</span>
        </address>
      </header>

      {/* Meta & schedule strip */}
      <div className="mt-4 grid grid-cols-2 border-l border-t border-neutral-400 md:grid-cols-10">
        <Cell label="Bay No" className="md:col-span-2" field="bay" error={errors.bay}>
          <select value={jc.bay} disabled={readOnly} onChange={(e) => setJc({ bay: e.target.value })} className={cn(line, "py-[3px]", bad("bay"))} aria-label="Bay number">
            <option value="">Select bay</option>
            {JOB_BAYS.map((b) => (
              <option key={b} value={b}>
                {b.replace("BAY", "BAY ")}
              </option>
            ))}
          </select>
        </Cell>
        <Cell label="Coupon No" className="md:col-span-2">
          <input value={jc.couponNo} disabled={readOnly} onChange={(e) => setJc({ couponNo: e.target.value })} className={line} aria-label="Coupon number" />
        </Cell>
        <Cell label="AMC" className="md:col-span-1">
          <Tick checked={jc.amc} onChange={(v) => setJc({ amc: v })} label="Yes" disabled={readOnly} />
        </Cell>
        <Cell label="PP" className="md:col-span-1">
          <Tick checked={jc.pp} onChange={(v) => setJc({ pp: v })} label="Yes" disabled={readOnly} />
        </Cell>
        <Cell label="Job Card No" className="col-span-2 md:col-span-4" field="jobCardNo" error={errors.jobCardNo}>
          <div className="flex items-center gap-2">
            <input value={value.jobCardNo} disabled={readOnly} onChange={(e) => set({ jobCardNo: e.target.value })} placeholder="JC/10353/2026-27/0481" className={cn(line, "font-mono", bad("jobCardNo"))} aria-label="Job card number" />
            {auto(onAutoJobNo)}
          </div>
        </Cell>

        <Cell label="Vehicle Model" className="md:col-span-2">
          <p className="py-0.5 text-[13px] font-medium">{claim.model}</p>
        </Cell>
        <Cell label="Vehicle Reg No" className="md:col-span-2">
          <PlateBadge regNo={claim.regNo} />
        </Cell>
        <Cell label="Odometer Reading (KM)" className="md:col-span-2" field="odometer" error={errors.odometer}>
          <input value={value.odometer} disabled={readOnly} inputMode="numeric" onChange={(e) => set({ odometer: e.target.value.replace(/[^\d]/g, "") })} placeholder="e.g. 4200" className={cn(line, "tabular-nums", bad("odometer"))} aria-label="Odometer reading in kilometres" />
        </Cell>
        <Cell label="Vehicle Receiving Date / Time" className="col-span-2 md:col-span-2" field="receivedAt" error={errors.receivedAt}>
          <input type="datetime-local" value={jc.receivedAt} disabled={readOnly} onChange={(e) => setJc({ receivedAt: e.target.value })} className={cn(line, bad("receivedAt"))} aria-label="Vehicle receiving date and time" />
        </Cell>
        <Cell label="Promised Ready For Delivery" className="col-span-2 md:col-span-2" field="promisedAt" error={errors.promisedAt}>
          <input type="datetime-local" value={jc.promisedAt} min={jc.receivedAt || undefined} disabled={readOnly} onChange={(e) => setJc({ promisedAt: e.target.value })} className={cn(line, bad("promisedAt"))} aria-label="Promised delivery date and time" />
        </Cell>

        <Cell label="Job Type" className="col-span-2 md:col-span-4">
          <Tags value={jc.jobType} options={JOB_TYPES} onChange={(v) => setJc({ jobType: v })} label="Job type" disabled={readOnly} />
        </Cell>
        <Cell label="Telephonic Reminder" className="md:col-span-2">
          <YesNo value={jc.telReminder} onChange={(v) => setJc({ telReminder: v })} label="Telephonic reminder" disabled={readOnly} />
        </Cell>
        <Cell label="Claim No (Insurance)" className="col-span-2 md:col-span-4" field="claimNo" error={errors.claimNo}>
          <div className="flex items-center gap-2">
            <input value={value.claimNo} disabled={readOnly} onChange={(e) => set({ claimNo: e.target.value })} placeholder="VAA/CLM/26-27/0041" className={cn(line, "font-mono", bad("claimNo"))} aria-label="Official claim number" />
            {auto(onAutoClaimNo, !canAutoClaimNo)}
          </div>
        </Cell>

        <Cell label="Customer" className="col-span-2 md:col-span-4">
          <p className="py-0.5 text-[13px] font-medium">{claim.customerName}</p>
        </Cell>
        <Cell label="Phone" className="md:col-span-3">
          <p className="py-0.5 text-[13px]">{claim.phone}</p>
        </Cell>
        <Cell label="Alternate" className="md:col-span-3">
          <p className="py-0.5 text-[13px]">{claim.altPhone || "—"}</p>
        </Cell>
      </div>

      {/* Workshop body */}
      <div className="mt-4 grid border border-neutral-400 md:grid-cols-2">
        <section aria-label="Repairs and estimate" className="border-b border-neutral-400 md:border-b-0 md:border-r">
          <h4 className={bar}>Customer demanded repairs / observations</h4>
          <div className="divide-y divide-neutral-300">
            <div className="flex gap-2.5 px-2.5 py-2">
              <span className="mt-0.5 text-[12px] font-semibold text-neutral-500">1</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Accident damage details</p>
                <textarea value={value.damage} disabled={readOnly} rows={3} onChange={(e) => set({ damage: e.target.value })} className={cn(line, "mt-0.5 resize-none leading-5")} aria-label="Accident damage details" />
              </div>
            </div>
            <div className="flex gap-2.5 px-2.5 py-2">
              <span className="mt-0.5 text-[12px] font-semibold text-neutral-500">2</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Insurance company</p>
                <p className="py-0.5 text-[13px] font-medium">{claim.insurer || "Not recorded"}</p>
                {claim.policyNo && <p className="font-mono text-[11.5px] text-neutral-600">Policy {claim.policyNo}</p>}
              </div>
            </div>
            <div className="flex gap-2.5 px-2.5 py-2">
              <span className="mt-0.5 text-[12px] font-semibold text-neutral-500">3</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Other observations</p>
                <textarea value={jc.notes} disabled={readOnly} rows={2} onChange={(e) => setJc({ notes: e.target.value })} placeholder="Customer requests, items to check…" className={cn(line, "mt-0.5 resize-none leading-5")} aria-label="Other observations" />
              </div>
            </div>
          </div>
          <h4 className={cn(bar, "border-t")}>Estimated amount</h4>
          {money("estParts", "Parts cost")}
          {money("estLabour", "Labour cost")}
          <div className="flex items-center justify-between gap-3 px-2.5 py-2">
            <span className="text-[12.5px] font-bold uppercase tracking-wide text-neutral-900">Total estimate</span>
            <span className="text-[15px] font-bold tabular-nums text-neutral-900">{formatINR(total)}</span>
          </div>
        </section>

        <section aria-label="Vehicle, check-in and staff">
          <h4 className={bar}>Technical particulars</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-neutral-400 px-2.5 py-2">
            <Labelled label="Frame / chassis no" className="col-span-2" field="chassisNo" error={errors.chassisNo}>
              <input value={value.chassisNo} disabled={readOnly} maxLength={17} onChange={(e) => set({ chassisNo: e.target.value.toUpperCase() })} placeholder="17 characters" className={cn(line, "font-mono uppercase tracking-wide", bad("chassisNo"))} />
            </Labelled>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Engine no</span>
              <input value={jc.engineNo} disabled={readOnly} onChange={(e) => setJc({ engineNo: e.target.value.toUpperCase() })} className={cn(line, "font-mono uppercase")} />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Engine CC</span>
              <input value={jc.engineCc} disabled={readOnly} inputMode="numeric" onChange={(e) => setJc({ engineCc: e.target.value.replace(/[^\d]/g, "") })} placeholder="155" className={cn(line, "tabular-nums")} />
            </label>
            <label className="col-span-2 block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Date of sale</span>
              <input type="date" value={jc.saleDate} disabled={readOnly} onChange={(e) => setJc({ saleDate: e.target.value })} className={line} />
            </label>
          </div>

          <h4 className={bar}>Check-in checklist</h4>
          <div className="space-y-3 border-b border-neutral-400 px-2.5 py-2.5">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Fuel level</p>
              <FuelGauge value={jc.fuel} onChange={(v) => setJc({ fuel: v })} disabled={readOnly} />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Items received with the vehicle</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                <Tick checked={jc.toolkit} onChange={(v) => setJc({ toolkit: v })} label="Owner toolkit" disabled={readOnly} />
                <Tick checked={jc.firstAid} onChange={(v) => setJc({ firstAid: v })} label="First aid kit" disabled={readOnly} />
                <Tick checked={jc.serviceManual} onChange={(v) => setJc({ serviceManual: v })} label="Service manual" disabled={readOnly} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] text-neutral-800">Return old parts to customer</p>
              <YesNo value={jc.returnOldParts} onChange={(v) => setJc({ returnOldParts: v })} label="Return old parts to customer" disabled={readOnly} />
            </div>
          </div>

          <h4 className={bar}>Workshop staff</h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-2.5 py-2">
            <Labelled label="Supervisor name" field="supervisor" error={errors.supervisor}>
              <input value={jc.supervisor} disabled={readOnly} onChange={(e) => setJc({ supervisor: e.target.value })} className={cn(line, bad("supervisor"))} />
            </Labelled>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Mechanic name</span>
              <input value={jc.mechanic} disabled={readOnly} onChange={(e) => setJc({ mechanic: e.target.value })} className={line} />
            </label>
            <label className="col-span-2 block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Service advisor</span>
              <input value={jc.advisor} disabled={readOnly} onChange={(e) => setJc({ advisor: e.target.value })} placeholder="Who is handling this claim" className={line} />
            </label>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 text-[11px] text-neutral-500">
        <p className="border-t border-neutral-400 pt-1">Customer signature</p>
        <p className="border-t border-neutral-400 pt-1">Service advisor signature</p>
      </div>
    </div>
  );
}
