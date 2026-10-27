"use client";

import { useState } from "react";
import { useBranchStore, type BranchForm } from "@/store/branch-store";
import { toast } from "@/store/toast-store";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/primitives";

const blank = { name: "", code: "", phone: "", email: "", address: "", city: "", state: "Kerala", pincode: "", managerName: "" };

/** "Vijay Yamaha - Aluva" -> "aluva": the part after the last dash, as a URL-safe code. */
const codeFrom = (name: string) =>
  (name.split(" - ").pop() ?? name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function Form({ onClose, onBusy }: { onClose: () => void; onBusy: (busy: boolean) => void }) {
  const saveRemote = useBranchStore((s) => s.saveRemote);
  const [f, setF] = useState(blank);
  const [codeEdited, setCodeEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof blank, v: string) => {
    setF((p) => ({ ...p, [k]: v, ...(k === "name" && !codeEdited ? { code: codeFrom(v) } : {}) }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter the showroom name";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.code.trim())) e.code = "Lowercase letters, numbers and hyphens only";
    if (!f.city.trim()) e.city = "Enter a city or area";
    if (f.address.trim().length < 10) e.address = "Enter the full address";
    if (!f.phone.trim()) e.phone = "Enter a contact number";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
    if (f.pincode.trim() && !/^\d{6}$/.test(f.pincode.trim())) e.pincode = "Pincode is 6 digits";
    setErrors(e);
    if (Object.keys(e).length) return;

    onBusy(true);
    const error = await saveRemote(null, f as BranchForm);
    onBusy(false);
    if (error) return void toast.error("Couldn't add the showroom", error);
    toast.success("Showroom added", `${f.name.trim()} is now available across the portal.`);
    onClose();
  };

  return (
    <form
      id="add-branch-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="grid gap-4 px-5 py-5 sm:grid-cols-2"
    >
      <Field label="Showroom name" required error={errors.name}>
        <Input data-autofocus value={f.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Vijay Yamaha - Aluva" />
      </Field>
      <Field label="Code" required error={errors.code} hint="Used in links and records; can't be changed later">
        <Input
          value={f.code}
          invalid={!!errors.code}
          onChange={(e) => {
            setCodeEdited(true);
            set("code", e.target.value);
          }}
          placeholder="e.g. aluva"
        />
      </Field>
      <Field label="City / area" required error={errors.city}>
        <Input value={f.city} invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Aluva" />
      </Field>
      <Field label="Manager" error={errors.managerName} hint="Optional">
        <Input value={f.managerName} onChange={(e) => set("managerName", e.target.value)} placeholder="e.g. Branch Manager - Aluva" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Full address" required error={errors.address}>
          <Textarea value={f.address} invalid={!!errors.address} onChange={(e) => set("address", e.target.value)} rows={3} placeholder="Door no., building, street, area" />
        </Field>
      </div>
      <Field label="Phone" required error={errors.phone}>
        <Input value={f.phone} invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="e.g. 9847000000" />
      </Field>
      <Field label="Email" error={errors.email} hint="Optional">
        <Input type="email" value={f.email} invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} placeholder="e.g. aluva@vijayagiri.com" />
      </Field>
      <Field label="State">
        <Input value={f.state} onChange={(e) => set("state", e.target.value)} />
      </Field>
      <Field label="Pincode" error={errors.pincode} hint="Optional">
        <Input value={f.pincode} invalid={!!errors.pincode} onChange={(e) => set("pincode", e.target.value)} inputMode="numeric" maxLength={6} placeholder="e.g. 683101" />
      </Field>
    </form>
  );
}

/** Slide-over form that adds a showroom to the database. Closing it discards the draft. */
export function AddBranchDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title="Add showroom"
      description="New showrooms appear in every branch picker and filter."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-branch-form" variant="primary" loading={busy}>
            Add Showroom
          </Button>
        </div>
      }
    >
      <Form key={String(open)} onClose={onClose} onBusy={setBusy} />
    </Drawer>
  );
}
