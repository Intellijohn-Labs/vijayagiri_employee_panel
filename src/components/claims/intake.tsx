"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { branchLabel } from "@/lib/branches";
import { INSURERS } from "@/lib/insurance";
import { YAMAHA_MODELS, type Intake } from "@/lib/claims";
import { photoToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/popover";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { PhotoThumb } from "./vehicle";

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

/** Vehicle check-in / damage photo: drop a file, pick one, or take one on a phone or tablet. Shows a preview with Change and Remove. */
function PhotoField({ value, onChange, readOnly }: { value?: string; onChange: (v: string | undefined) => void; readOnly?: boolean }) {
  const pick = useRef<HTMLInputElement>(null);
  const snap = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const take = async (file?: File) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await photoToDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be added.");
    } finally {
      setBusy(false);
    }
  };
  const input = (ref: React.RefObject<HTMLInputElement | null>, capture?: "environment") => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={capture}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        void take(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-fg">
        <span>Vehicle check-in / damage photo</span>
        <span className="font-normal text-faint">Optional</span>
      </div>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 shadow-card">
          <PhotoThumb src={value} label="Vehicle check-in photo" className="h-20 w-28" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">Photo added</p>
            <p className="text-[12px] text-muted">Shown on the claim card. Click it to view full size.</p>
          </div>
          {!readOnly && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" loading={busy} leading={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => pick.current?.click()}>
                Change
              </Button>
              <Button size="sm" variant="danger" leading={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange(undefined)}>
                Remove
              </Button>
            </div>
          )}
        </div>
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is a shortcut; the Choose and Take buttons inside do the same for keyboards
        <div
          onDragOver={(e) => {
            if (readOnly) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!readOnly) void take(e.dataTransfer.files[0]);
          }}
          className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors", over ? "border-accent bg-tint" : "border-line bg-surface", readOnly && "opacity-60")}
        >
          <ImagePlus className="h-5 w-5 text-faint" />
          <p className="text-[13px] text-muted">{readOnly ? "No photo was added" : "Drag a photo here, or"}</p>
          {!readOnly && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" loading={busy} leading={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => pick.current?.click()}>
                Choose a photo
              </Button>
              <Button size="sm" disabled={busy} leading={<Camera className="h-3.5 w-3.5" />} onClick={() => snap.current?.click()}>
                Take a photo
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[11.5px] text-danger">
          {error}
        </p>
      )}
      {input(pick)}
      {input(snap, "environment")}
    </div>
  );
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
      <PhotoField value={value.vehicleImage} onChange={(v) => set("vehicleImage", v)} readOnly={readOnly} />
    </div>
  );
}

/** The fields of a claim that the intake form edits. */
export const intakeOf = (c: Intake): Intake => ({ branchId: c.branchId, customerName: c.customerName, phone: c.phone, email: c.email, address: c.address, regNo: c.regNo, model: c.model, chassisNo: c.chassisNo, odometer: c.odometer, insurer: c.insurer, policyNo: c.policyNo, accidentDate: c.accidentDate, damage: c.damage, jobCardNo: c.jobCardNo, vehicleImage: c.vehicleImage });
