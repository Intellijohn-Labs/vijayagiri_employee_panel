"use client";

import { useBranchTools } from "@/store/branch-store";
import { branchLabel } from "@/lib/branches";
import { INSURERS } from "@/lib/insurance";
import { YAMAHA_MODELS, type Intake } from "@/lib/claims";
import { Select } from "@/components/ui/popover";
import { Field, Input, Textarea } from "@/components/ui/primitives";

export type IntakeErrors = Partial<Record<keyof Intake, string>>;

/** Required intake fields; returns an error per missing or malformed one. */
export function validateIntake(v: Intake): IntakeErrors {
  const e: IntakeErrors = {};
  if (!v.branchId) e.branchId = "Choose the showroom";
  if (!v.customerName.trim()) e.customerName = "Enter the customer's name";
  if (v.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number";
  if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Enter a valid email or leave it blank";
  if (!v.regNo.trim()) e.regNo = "Enter the registration number";
  if (!v.model.trim()) e.model = "Enter the vehicle model";
  if (!v.jobCardNo.trim()) e.jobCardNo = "Enter the job card number";
  if (!v.damage.trim()) e.damage = "Describe the damage";
  return e;
}

/** The customer, vehicle, insurance and damage fields — shared by the New Claim page and the Stage 1 panel. */
export function IntakeFields({ value, onChange, errors = {}, showBranch, readOnly }: { value: Intake; onChange: (v: Intake) => void; errors?: IntakeErrors; showBranch?: boolean; readOnly?: boolean }) {
  const { branches } = useBranchTools();
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => onChange({ ...value, [k]: v });
  const text = (k: keyof Intake, placeholder?: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <Input value={value[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} invalid={!!errors[k]} disabled={readOnly} {...extra} />
  );
  return (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      {showBranch && (
        <Field label="Showroom / workshop" required error={errors.branchId} className="sm:col-span-2">
          <Select<string> value={value.branchId || null} onChange={(v) => set("branchId", v)} placeholder="Choose a showroom" invalid={!!errors.branchId} disabled={readOnly} options={branches.map((b) => ({ value: b.id, label: branchLabel(b) }))} />
        </Field>
      )}
      <Field label="Customer name" required error={errors.customerName}>
        {text("customerName", "As on the RC book", { autoComplete: "off" })}
      </Field>
      <Field label="Mobile number" required error={errors.phone}>
        {text("phone", "98470 00000", { inputMode: "tel", autoComplete: "off" })}
      </Field>
      <Field label="Email" hint="Optional" error={errors.email}>
        {text("email", "name@example.com", { type: "email", autoComplete: "off" })}
      </Field>
      <Field label="Address" hint="Optional">
        {text("address", "Town, district")}
      </Field>
      <Field label="Vehicle registration no." required error={errors.regNo}>
        {text("regNo", "KL-40-AB-1234", { className: "font-mono uppercase", autoCapitalize: "characters" })}
      </Field>
      <Field label="Model" required error={errors.model}>
        {text("model", "e.g. MT-15 V2", { list: "claim-models" })}
        <datalist id="claim-models">
          {YAMAHA_MODELS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Chassis no." hint="Optional">
        {text("chassisNo", "17 characters", { className: "font-mono uppercase" })}
      </Field>
      <Field label="Odometer (km)" hint="Optional">
        {text("odometer", "e.g. 4200", { inputMode: "numeric" })}
      </Field>
      <Field label="Insurer" hint="Optional">
        <Select<string> value={value.insurer || null} onChange={(v) => set("insurer", v)} placeholder="Choose the insurer" disabled={readOnly} options={INSURERS.map((i) => ({ value: i, label: i }))} />
      </Field>
      <Field label="Policy no." hint="Optional">
        {text("policyNo", "Policy number", { className: "font-mono" })}
      </Field>
      <Field label="Job card no." required error={errors.jobCardNo}>
        {text("jobCardNo", "JC-26-0482", { className: "font-mono" })}
      </Field>
      <Field label="Date of accident" hint="Optional">
        {text("accidentDate", undefined, { type: "date" })}
      </Field>
      <Field label="Damage description" required error={errors.damage} className="sm:col-span-2">
        <Textarea value={value.damage} onChange={(e) => set("damage", e.target.value)} placeholder="What was damaged and how" invalid={!!errors.damage} disabled={readOnly} />
      </Field>
    </div>
  );
}

/** The fields of a claim that the intake form edits. */
export const intakeOf = (c: Intake): Intake => ({ branchId: c.branchId, customerName: c.customerName, phone: c.phone, email: c.email, address: c.address, regNo: c.regNo, model: c.model, chassisNo: c.chassisNo, odometer: c.odometer, insurer: c.insurer, policyNo: c.policyNo, accidentDate: c.accidentDate, damage: c.damage, jobCardNo: c.jobCardNo });
