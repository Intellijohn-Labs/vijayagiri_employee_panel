"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { branchLabel } from "@/lib/branches";
import { INSURERS } from "@/lib/insurance";
import { YAMAHA_MODELS, isIndianMobile, normalizeRegNo, type Intake } from "@/lib/claims";
import { photoToDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/popover";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { PhotoThumb } from "./vehicle";

export type IntakeErrors = Partial<Record<keyof Intake, string>>;

/** The form's fields in the order they appear, so the first invalid one can be found and focused. */
const FIELD_ORDER: (keyof Intake)[] = ["branchId", "customerName", "phone", "altPhone", "model", "regNo", "damage"];

/** Required check-in fields; returns an error per missing or malformed one. */
export function validateIntake(v: Intake): IntakeErrors {
  const e: IntakeErrors = {};
  if (!v.branchId) e.branchId = "Choose the showroom or workshop";
  if (!v.customerName.trim()) e.customerName = "Enter the customer's name";
  else if (v.customerName.trim().length < 2) e.customerName = "The name needs at least 2 characters";
  if (!v.phone.trim()) e.phone = "Enter the primary phone number";
  else if (!isIndianMobile(v.phone)) e.phone = "Enter a valid 10-digit mobile number (starts with 6 to 9)";
  if (v.altPhone?.trim() && v.altPhone.replace(/\D/g, "").length < 10) e.altPhone = "Enter a 10-digit number or leave it blank";
  if (!v.model.trim()) e.model = "Select the vehicle model";
  else if (!YAMAHA_MODELS.includes(v.model)) e.model = "Select a Yamaha model from the list";
  if (!v.regNo.trim()) e.regNo = "Enter the registration number";
  else if (!normalizeRegNo(v.regNo)) e.regNo = "Use the format KL-40-AB-1234";
  if (!v.damage.trim()) e.damage = "Describe the damage";
  else if (v.damage.trim().length < 5) e.damage = "Add a little more detail (at least 5 characters)";
  return e;
}

/** Scrolls to and focuses the first field in `errors`. `root` is the element that holds the IntakeFields. */
export function focusFirstError(root: HTMLElement | null, errors: IntakeErrors) {
  const first = FIELD_ORDER.find((k) => errors[k]);
  const el = first && root?.querySelector<HTMLElement>(`[data-field="${first}"] :is(input, textarea, button)`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus({ preventScroll: true });
}

/** A registration number on an Indian-style plate: blue IND strip, bold capitals. */
function PlateInput({ value, onChange, invalid, disabled }: { value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean }) {
  return (
    <div className={cn("flex h-9 overflow-hidden rounded-md border bg-white shadow-card", invalid ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500/40" : "border-slate-700/70", disabled && "opacity-60")}>
      <span aria-hidden className="grid w-9 shrink-0 place-items-center bg-[#003399] text-[9px] font-bold tracking-wide text-white">
        IND
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="KL-40-AB-1234"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-label="Vehicle registration number"
        className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[14px] font-bold uppercase tracking-widest text-slate-900 outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
      />
    </div>
  );
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

/** The Stage 1 check-in fields: customer, vehicle, insurance, damage and a photo. Shared by the New Claim form and the Stage 1 panel. */
export function IntakeFields({ value, onChange, errors = {}, showBranch, readOnly }: { value: Intake; onChange: (v: Intake) => void; errors?: IntakeErrors; showBranch?: boolean; readOnly?: boolean }) {
  const { branches } = useBranchTools();
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => onChange({ ...value, [k]: v });
  const text = (k: "customerName" | "phone" | "altPhone" | "policyNo", placeholder?: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <Input value={value[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} invalid={!!errors[k]} disabled={readOnly} {...extra} />
  );
  // A model typed on an older claim may not be in the list; keep it selectable.
  const models = YAMAHA_MODELS.includes(value.model) || !value.model ? YAMAHA_MODELS : [value.model, ...YAMAHA_MODELS];
  return (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      {showBranch && (
        <div data-field="branchId" className="contents">
          <Field label="Showroom / workshop" required error={errors.branchId} className="sm:col-span-2">
            <Select<string> value={value.branchId || null} onChange={(v) => set("branchId", v)} placeholder="Choose a showroom" invalid={!!errors.branchId} disabled={readOnly} options={branches.map((b) => ({ value: b.id, label: branchLabel(b) }))} />
          </Field>
        </div>
      )}
      <div data-field="customerName" className="contents">
        <Field label="Customer name" required error={errors.customerName}>
          {text("customerName", "As on the RC book", { autoComplete: "off" })}
        </Field>
      </div>
      <div data-field="phone" className="contents">
        <Field label="Primary phone number" required error={errors.phone}>
          {text("phone", "98470 00000", { inputMode: "tel", autoComplete: "off" })}
        </Field>
      </div>
      <div data-field="altPhone" className="contents">
        <Field label="Alternate number" hint="Optional" error={errors.altPhone}>
          {text("altPhone", "98470 00000", { inputMode: "tel", autoComplete: "off" })}
        </Field>
      </div>
      <div data-field="model" className="contents">
        <Field label="Vehicle model" required error={errors.model}>
          <Select<string> value={value.model || null} onChange={(v) => set("model", v)} placeholder="Choose the model" searchable invalid={!!errors.model} disabled={readOnly} options={models.map((m) => ({ value: m, label: m }))} />
        </Field>
      </div>
      <div data-field="regNo" data-invalid={errors.regNo ? "" : undefined} className="sm:col-span-2">
        <p className="mb-1.5 text-xs font-medium text-fg">
          Registration number<span className="ml-0.5 text-accent-text">*</span>
        </p>
        <div className="sm:max-w-xs">
          <PlateInput value={value.regNo} onChange={(v) => set("regNo", v)} invalid={!!errors.regNo} disabled={readOnly} />
        </div>
        {errors.regNo && (
          <p role="alert" className="mt-1 text-[11.5px] text-danger">
            {errors.regNo}
          </p>
        )}
      </div>
      <Field label="Insurance company" hint="Optional">
        <Select<string> value={value.insurer || null} onChange={(v) => set("insurer", v)} placeholder="Choose the insurer" disabled={readOnly} options={INSURERS.map((i) => ({ value: i, label: i }))} />
      </Field>
      <Field label="Policy number" hint="Optional">
        {text("policyNo", "Policy number", { className: "font-mono" })}
      </Field>
      <div data-field="damage" className="contents">
        <Field label="Accident / damage summary" required error={errors.damage} className="sm:col-span-2">
          <Textarea value={value.damage} onChange={(e) => set("damage", e.target.value)} placeholder="Brief issue: what was damaged and how" invalid={!!errors.damage} disabled={readOnly} rows={3} />
        </Field>
      </div>
      <PhotoField value={value.vehicleImage} onChange={(v) => set("vehicleImage", v)} readOnly={readOnly} />
    </div>
  );
}

/** The fields of a claim that the Stage 1 form edits. */
export const intakeOf = (c: Intake): Intake => ({ branchId: c.branchId, customerName: c.customerName, phone: c.phone, altPhone: c.altPhone ?? "", regNo: c.regNo, model: c.model, insurer: c.insurer, policyNo: c.policyNo, damage: c.damage, vehicleImage: c.vehicleImage });
