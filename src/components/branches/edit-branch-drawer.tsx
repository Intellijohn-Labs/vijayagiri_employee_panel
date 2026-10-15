"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { BASE_BRANCHES, STATUS_OVERRIDES, branchLabel, overrideOf, type Branch } from "@/lib/branches";
import { deriveDial, useBranch, useBranchStore } from "@/store/branch-store";
import { useIsAdmin } from "@/store/employee-store";
import { toast } from "@/store/toast-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Select } from "@/components/ui/popover";
import { Field, Input, Textarea } from "@/components/ui/primitives";

type Kind = Branch["kind"];


const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "hq", label: "Head Office & Central Yard" },
  { value: "branch", label: "Sub-Branch" },
];

function Form({ id, onClose }: { id: string; onClose: () => void }) {
  const current = useBranch(id)!;
  const save = useBranchStore((s) => s.save);
  const reset = useBranchStore((s) => s.reset);
  const edited = useBranchStore((s) => !!s.edits[id]);
  const ownHours = useBranchStore((s) => !!s.edits[id]?.hours);

  const [f, setF] = useState({
    name: current.name,
    city: current.city,
    kind: current.kind,
    address: current.address,
    phone: current.phone,
    manager: current.manager,
    hours: current.hours,
    override: overrideOf(current),
    role: current.role ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter the branch name";
    if (!f.city.trim()) e.city = "Enter a city or area tag";
    if (f.address.trim().length < 10) e.address = "Enter the full address";
    if (!f.phone.trim()) e.phone = "Enter at least one contact number";
    if (!f.manager.trim()) e.manager = "Enter the person in charge";
    if (!f.hours.trim()) e.hours = "Enter the operating hours";
    setErrors(e);
    if (Object.keys(e).length) return;

    const city = f.city.trim();
    const patch: Partial<Omit<Branch, "id">> = {
      name: f.name.trim(),
      city,
      kind: f.kind,
      // The short tag follows the city for sub-branches; the Head Office is always just "Head Office".
      short: f.kind === "hq" ? "Head Office" : city !== current.city || current.kind === "hq" ? city : current.short,
      address: f.address.trim(),
      phone: f.phone.trim(),
      dial: deriveDial(f.phone),
      manager: f.manager.trim(),
      hours: f.hours.trim(),
      status: f.override === "closed" ? ("closed" as const) : ("open" as const),
      statusOverride: f.override,
      role: f.role.trim() || undefined,
    };
    // Hours unchanged and never customised for this branch: leave them following the dealership default in Settings.
    const keepDefaultHours = patch.hours === current.hours && !ownHours;
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (k === "statusOverride" ? patch.statusOverride !== overrideOf(current) : k === "status" ? false : patch[k] !== current[k]) && !(k === "role" && !patch.role && !current.role));
    if (!changed) {
      toast.info("No changes to save");
      onClose();
      return;
    }
    const { hours: _hours, ...rest } = patch;
    void _hours;
    if (!save(id, keepDefaultHours ? rest : patch)) return onClose();
    toast.success("Branch details updated successfully", `${branchLabel({ ...current, ...patch } as Branch)} now shows the new details everywhere.`);
    onClose();
  };

  return (
    <form
      id="edit-branch-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-4 px-5 py-5 sm:grid-cols-2"
    >
      <Field label="Branch name" required error={errors.name}>
        <Input data-autofocus value={f.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Vijay Autos" />
      </Field>
      <Field label="Short city / area tag" required error={errors.city}>
        <Input value={f.city} invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Perumbavoor" />
      </Field>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-fg">Branch type / badge</span>
        <div className="[&>div]:flex [&>div]:w-full">
          <Select<Kind> value={f.kind} onChange={(v) => set("kind", v)} options={KIND_OPTIONS} />
        </div>
      </div>

      <div className="sm:col-span-2">
        <Field label="Full address" required error={errors.address} hint="Door no., building, street, pincode">
          <Textarea value={f.address} invalid={!!errors.address} onChange={(e) => set("address", e.target.value)} rows={3} placeholder="e.g. 16/386, Group Mukkadan, Opp. CRL Main Entrance, Ambalamugal, Ernakulam - 682302" />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Contact phone number(s)" required error={errors.phone} hint="Separate several numbers with /">
          <Input value={f.phone} invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="e.g. 9961774455 / 0484-xxxxxxx" />
        </Field>
      </div>

      <Field label="Branch manager / admin in-charge" required error={errors.manager}>
        <Input value={f.manager} invalid={!!errors.manager} onChange={(e) => set("manager", e.target.value)} placeholder="e.g. Justin Johny / Central Admin" />
      </Field>
      <Field label="Operating hours / timings" required error={errors.hours} hint={ownHours ? undefined : "following the dealership default"}>
        <Input value={f.hours} invalid={!!errors.hours} onChange={(e) => set("hours", e.target.value)} placeholder="e.g. 9:00 AM – 7:00 PM" />
      </Field>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-fg">Operational status</span>
        <div role="radiogroup" aria-label="Operational status" className="grid gap-2 sm:grid-cols-3">
          {STATUS_OVERRIDES.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={f.override === o.value} onClick={() => set("override", o.value)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40", f.override === o.value ? "border-blue-600/60 bg-tint font-medium text-fg shadow-ring" : "border-line bg-surface text-muted hover:border-strong hover:text-fg")}>
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", o.value === "closed" ? "bg-slate-400" : "bg-emerald-500 shadow-[0_0_8px_1px_rgba(16,185,129,0.6)]")} />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <Field label="Role tag / description" hint="Optional">
          <Input value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Central Stock Distribution & Headquarters" />
        </Field>
      </div>

      {edited && (
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => {
              if (reset(id)) toast.success("Original details restored");
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded text-xs text-muted outline-none transition-colors hover:text-fg focus-visible:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore the original details for {BASE_BRANCHES.find((b) => b.id === id)?.short}
          </button>
        </div>
      )}
    </form>
  );
}

/** Slide-over form for editing one branch. Closing it (Cancel, X, Esc, backdrop) discards unsaved edits. */
export function EditBranchDrawer({ branchId, open, onClose }: { branchId: string | null; open: boolean; onClose: () => void }) {
  const b = useBranch(branchId);
  const admin = useIsAdmin();
  if (!b || !admin) return null;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title="Edit branch details"
      description={branchLabel(b)}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-branch-form" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]">
            Save Changes
          </Button>
        </div>
      }
    >
      <Form key={b.id} id={b.id} onClose={onClose} />
    </Drawer>
  );
}
