"use client";

import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useBranchTools } from "@/store/branch-store";
import { useInsurance } from "@/store/insurance-store";
import { useModelOptions, useVisibleEntries } from "@/store/stock-store";
import { toast } from "@/store/toast-store";
import { EXPIRING_DAYS, INSURERS, POLICY_TYPES, daysUntil, isoDate, suggestEnd, type Policy, type PolicyType } from "@/lib/insurance";
import { branchLabel } from "@/lib/branches";
import { ENGINE_PATTERN, STATUS_SHORT, VIN_PATTERN } from "@/lib/stock-options";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/primitives";

const MAX_PDF = 10 * 1024 * 1024;
const selectCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg outline-none transition-colors hover:border-strong focus-visible:ring-2 focus-visible:ring-blue-500/40";
const REG_PATTERN = /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{0,3}[ -]?\d{1,4}$/;

function Form({ policy, presetBranch, onClose }: { policy: Policy | null; presetBranch?: string; onClose: () => void }) {
  const { branches } = useBranchTools();
  const scope = useApp((s) => s.branchScope);
  const entries = useVisibleEntries();
  const models = useModelOptions();
  const add = useInsurance((s) => s.add);
  const update = useInsurance((s) => s.update);
  const remove = useInsurance((s) => s.remove);
  const restore = useInsurance((s) => s.restore);
  const editing = !!policy;
  const pdfRef = useRef<HTMLInputElement>(null);

  const known = policy && (INSURERS as readonly string[]).includes(policy.partner);
  const [f, setF] = useState(() => ({
    stockId: policy?.stockId ?? "",
    branchId: policy?.branchId ?? presetBranch ?? (branches.some((b) => b.id === scope) ? scope : (branches[0]?.id ?? "")),
    customer: policy?.customer ?? "",
    phone: policy?.phone ?? "",
    modelName: policy?.modelName ?? "",
    chassisNo: policy?.chassisNo ?? "",
    engineNo: policy?.engineNo ?? "",
    regNo: policy?.regNo ?? "",
    partner: policy ? (known ? policy.partner : "Other") : INSURERS[0],
    partnerOther: policy && !known ? policy.partner : "",
    policyNo: policy?.policyNo ?? "",
    type: (policy?.type ?? "Bundled 1+5") as PolicyType,
    start: policy?.start ?? "",
    end: policy?.end ?? "",
    premium: policy?.premium ? String(policy.premium) : "",
  }));
  const [endTouched, setEndTouched] = useState(!!policy?.end);
  const [doc, setDoc] = useState<File | "remove" | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  /** Start date or policy type changed: suggest the matching end date unless the user already typed one. */
  const reschedule = (start: string, type: PolicyType) => {
    setF((p) => ({ ...p, start, type, end: endTouched ? p.end : start ? suggestEnd(start, type) : p.end }));
    setErrors((e) => ({ ...e, start: "", end: "" }));
  };

  const pickVehicle = (id: string) => {
    const u = entries.find((e) => e.id === id);
    setF((p) => (u ? { ...p, stockId: id, branchId: u.branchId, modelName: u.modelName, chassisNo: u.chassisNo, engineNo: u.engineNo } : { ...p, stockId: "" }));
    setErrors((e) => ({ ...e, modelName: "", chassisNo: "", engineNo: "" }));
  };

  const pickPdf = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return void toast.error("The policy document must be a PDF");
    if (file.size > MAX_PDF) return void toast.error("PDF is larger than 10 MB", "Compress it and try again.");
    setDoc(file);
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    const chassis = f.chassisNo.trim().toUpperCase();
    const engine = f.engineNo.trim().toUpperCase();
    const reg = f.regNo.trim().toUpperCase();
    const partner = f.partner === "Other" ? f.partnerOther.trim() : f.partner;
    const policyNo = f.policyNo.trim();
    if (!f.branchId) e.branchId = "Choose a showroom";
    if (f.customer.trim().length < 2) e.customer = "Enter the customer's name";
    if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number";
    if (!f.modelName.trim()) e.modelName = "Enter the vehicle model";
    if (!VIN_PATTERN.test(chassis)) e.chassisNo = "Chassis number must be 17 letters/digits (no I, O or Q)";
    if (engine && !ENGINE_PATTERN.test(engine)) e.engineNo = "Engine number is 6–17 letters/digits";
    if (reg && !REG_PATTERN.test(reg)) e.regNo = "Looks wrong. Example: KL-07-AB-1234";
    if (!partner) e.partnerOther = "Name the insurance company";
    if (policyNo) {
      const dup = useInsurance.getState().policies.some((p) => p.id !== policy?.id && p.policyNo.trim().toLowerCase() === policyNo.toLowerCase());
      if (dup) e.policyNo = "This policy number is already recorded";
      if (!f.start) e.start = "Enter the start date";
      if (!f.end) e.end = "Enter the end date";
      else if (f.start && f.end <= f.start) e.end = "End date must be after the start date";
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const data = {
        branchId: f.branchId,
        customer: f.customer.trim(),
        phone: f.phone.trim(),
        modelName: f.modelName.trim(),
        chassisNo: chassis,
        engineNo: engine,
        regNo: reg,
        partner,
        policyNo,
        type: f.type,
        start: policyNo ? f.start : "",
        end: policyNo ? f.end : "",
        premium: Number(f.premium) > 0 ? Number(f.premium) : null,
        stockId: f.stockId || undefined,
      };
      if (editing) {
        // A renewal that pushes the end date beyond the reminder window clears "Renewal Pending".
        const renewed = !!data.end && daysUntil(data.end) > EXPIRING_DAYS;
        await update(policy.id, { ...data, renewalPending: renewed ? false : policy.renewalPending }, doc);
      } else await add(data, doc instanceof File ? doc : null);
      toast.success(editing ? "Policy updated" : policyNo ? "Policy recorded" : "Added as pending issuance", `${data.customer} · ${data.modelName}`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const del = () => {
    if (!policy || !window.confirm(`Delete the record for ${policy.customer}?`)) return;
    const gone = remove(policy.id);
    onClose();
    if (gone) toast.info("Policy record deleted", `${gone.customer} · ${gone.modelName}`, { action: { label: "Undo", onClick: () => restore(gone) } });
  };

  const docName = doc instanceof File ? doc.name : doc === "remove" ? null : policy?.docName;

  return (
    <form
      id="policy-form"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Link to a vehicle in stock" hint="optional" className="sm:col-span-2">
        <select value={f.stockId} onChange={(e) => pickVehicle(e.target.value)} className={selectCls}>
          <option value="">Enter the vehicle details by hand (e.g. already delivered)</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.modelName} · {e.colour} · …{e.chassisNo.slice(-6)} · {STATUS_SHORT[e.status]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Showroom" required error={errors.branchId} className="sm:col-span-2">
        <select value={f.branchId} onChange={(e) => set("branchId", e.target.value)} className={selectCls}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {branchLabel(b)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Customer name" required error={errors.customer}>
        <Input value={f.customer} invalid={!!errors.customer} onChange={(e) => set("customer", e.target.value)} placeholder="Full name" />
      </Field>
      <Field label="Phone number" required error={errors.phone}>
        <Input value={f.phone} invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98470 12345" inputMode="tel" />
      </Field>

      <Field label="Vehicle model" required error={errors.modelName}>
        <Input value={f.modelName} invalid={!!errors.modelName} onChange={(e) => set("modelName", e.target.value)} placeholder="e.g. MT-15 V2" list="policy-models" />
        <datalist id="policy-models">
          {models.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Registration number" hint="when allotted" error={errors.regNo}>
        <Input value={f.regNo} invalid={!!errors.regNo} onChange={(e) => set("regNo", e.target.value.toUpperCase())} placeholder="KL-07-AB-1234" className="font-mono uppercase" />
      </Field>
      <Field label="Chassis (frame) number" required error={errors.chassisNo}>
        <Input value={f.chassisNo} invalid={!!errors.chassisNo} onChange={(e) => set("chassisNo", e.target.value.toUpperCase())} placeholder="17 characters" maxLength={17} className="font-mono uppercase" />
      </Field>
      <Field label="Engine number" error={errors.engineNo}>
        <Input value={f.engineNo} invalid={!!errors.engineNo} onChange={(e) => set("engineNo", e.target.value.toUpperCase())} placeholder="Optional" className="font-mono uppercase" />
      </Field>

      <Field label="Insurance partner" required>
        <select value={f.partner} onChange={(e) => set("partner", e.target.value)} className={selectCls}>
          {INSURERS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Policy type" required>
        <select value={f.type} onChange={(e) => reschedule(f.start, e.target.value as PolicyType)} className={selectCls}>
          {POLICY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      {f.partner === "Other" && (
        <Field label="Company name" required error={errors.partnerOther} className="sm:col-span-2">
          <Input value={f.partnerOther} invalid={!!errors.partnerOther} onChange={(e) => set("partnerOther", e.target.value)} placeholder="Insurance company" />
        </Field>
      )}

      <Field label="Policy number" hint="leave empty while awaiting issuance" error={errors.policyNo} className="sm:col-span-2">
        <Input value={f.policyNo} invalid={!!errors.policyNo} onChange={(e) => set("policyNo", e.target.value)} placeholder="e.g. 2W-KTM-540021" className="font-mono" />
      </Field>

      <Field label="Valid from" error={errors.start}>
        <Input type="date" value={f.start} invalid={!!errors.start} onChange={(e) => reschedule(e.target.value, f.type)} />
      </Field>
      <Field label="Valid until" error={errors.end} hint={endTouched ? undefined : "suggested"}>
        <Input
          type="date"
          value={f.end}
          invalid={!!errors.end}
          min={f.start || undefined}
          onChange={(e) => {
            setEndTouched(true);
            set("end", e.target.value);
          }}
        />
      </Field>
      <Field label="Premium paid (₹)" hint="optional">
        <Input type="number" min={0} inputMode="numeric" value={f.premium} onChange={(e) => set("premium", e.target.value)} placeholder="6500" />
      </Field>
      <div className="text-[12px] leading-5 text-muted sm:pt-6">Today is {isoDate(new Date())}. Policies within {EXPIRING_DAYS} days of the end date show as expiring.</div>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-fg">Policy PDF</span>
        {docName ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-hover/50 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <FileText className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{docName}</p>
            <Button type="button" onClick={() => pdfRef.current?.click()}>
              Replace
            </Button>
            <Button type="button" variant="danger" leading={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDoc("remove")}>
              Remove
            </Button>
          </div>
        ) : (
          <Button type="button" leading={<Upload className="h-3.5 w-3.5" />} onClick={() => pdfRef.current?.click()}>
            Upload the customer&apos;s policy PDF
          </Button>
        )}
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="policy-pdf-input"
          onChange={(e) => {
            pickPdf(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="mt-1 text-[11.5px] text-muted">Up to 10 MB. Kept in this browser along with the record.</p>
      </div>

      {editing && (
        <div className="sm:col-span-2">
          <button type="button" onClick={del} className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-danger outline-none hover:underline focus-visible:underline">
            <Trash2 className="h-3.5 w-3.5" /> Delete this record
          </button>
        </div>
      )}
      <button type="submit" hidden disabled={busy} />
    </form>
  );
}

/** Slide-over for adding a policy record, or editing one. Cancel discards unsaved changes. */
export function PolicyDrawer({ policy, presetBranch, open, onClose }: { policy: Policy | null; presetBranch?: string; open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={600}
      title={policy ? "Edit policy" : "Add insurance record"}
      description={policy ? `${policy.customer} · ${policy.modelName}` : "Link a policy to a booked or delivered vehicle."}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="policy-form" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]">
            {policy ? "Save Changes" : "Save Policy"}
          </Button>
        </div>
      }
    >
      <Form policy={policy} presetBranch={presetBranch} onClose={onClose} />
    </Drawer>
  );
}
