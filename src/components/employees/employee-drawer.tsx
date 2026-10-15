"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Camera, Check, Trash2 } from "lucide-react";
import { useAllBranches } from "@/store/branch-store";
import { EMPLOYEE_ROLES, codeTaken, emailTaken, intlDigits, nextEmployeeCode, useEmployees, useSessionEmployee, type Employee, type EmployeeRole, type EmployeeStatus } from "@/store/employee-store";
import { toast } from "@/store/toast-store";
import { ACCEPTED_TYPES, processAvatar, validateImage } from "@/lib/images";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Select } from "@/components/ui/popover";
import { Avatar, Checkbox, Field, Input } from "@/components/ui/primitives";
import { WhatsAppIcon } from "./employee-card";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const tenDigits = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
};
const pretty = (v: string) => {
  const d = tenDigits(v);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : v.trim();
};

/** Enter/Space on a `div role="button"` row; ignores keys bubbling up from the nested checkbox button so a press never toggles twice. */
const rowKey = (toggle: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  toggle();
};

function Form({ employee, presetBranch, onClose }: { employee: Employee | null; presetBranch?: string; onClose: () => void }) {
  const branches = useAllBranches();
  const employees = useEmployees((s) => s.employees);
  const add = useEmployees((s) => s.add);
  const update = useEmployees((s) => s.update);
  const me = useSessionEmployee();
  const editing = !!employee;
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    whatsapp: employee?.whatsapp ?? "",
    role: (employee?.role ?? "Sales Executive") as EmployeeRole,
    all: employee ? employee.access === "all" : false,
    ids: employee ? (employee.access !== "all" ? employee.access : []) : presetBranch ? [presetBranch] : ([] as string[]),
    code: employee?.code ?? nextEmployeeCode(),
    status: (employee?.status ?? "Active") as EmployeeStatus,
    photo: employee?.photo as string | undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const takePhoto = async (file?: File) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return setErrors((e) => ({ ...e, photo: problem }));
    setPhotoBusy(true);
    try {
      set("photo", await processAvatar(file));
    } catch {
      setErrors((e) => ({ ...e, photo: "That file couldn't be read as an image" }));
    }
    setPhotoBusy(false);
  };
  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    setDragging(false);
    void takePhoto(ev.dataTransfer.files[0]);
  };

  const waDigits = intlDigits(f.whatsapp);
  const toggleBranch = (id: string) => set("ids", f.ids.includes(id) ? f.ids.filter((x) => x !== id) : [...f.ids, id]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter the employee's full name";
    if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid official email address";
    else if (emailTaken(f.email, employee?.id)) e.email = "This email already belongs to another employee";
    if (tenDigits(f.phone).length !== 10) e.phone = "Enter a 10-digit mobile number";
    if (f.whatsapp.trim() && tenDigits(f.whatsapp).length !== 10) e.whatsapp = "Enter a 10-digit WhatsApp number";
    if (!f.all && f.ids.length === 0) e.access = "Choose at least one showroom, or All Showrooms";
    if (!f.code.trim()) e.code = "Enter an employee ID";
    else if (codeTaken(f.code, employee?.id)) e.code = "This employee ID is already in use";
    // Never lock the directory out of its last administrator, or lock yourself out.
    const wouldBeActiveAdmin = f.role === "Admin" && f.status === "Active";
    const otherActiveAdmins = employees.filter((x) => x.id !== employee?.id && x.role === "Admin" && x.status === "Active").length;
    if (editing && employee.id === me?.id && f.status === "Inactive") e.status = "You can't deactivate your own account";
    else if (editing && !wouldBeActiveAdmin && otherActiveAdmins === 0 && employee.role === "Admin" && employee.status === "Active") e.role = "At least one Active Admin must remain";
    setErrors(e);
    if (Object.keys(e).length) return;

    const data = {
      name: f.name.trim(),
      email: f.email.trim(),
      phone: pretty(f.phone),
      whatsapp: f.whatsapp.trim() ? pretty(f.whatsapp) : pretty(f.phone),
      role: f.role,
      access: f.all ? ("all" as const) : branches.map((b) => b.id).filter((id) => f.ids.includes(id)),
      status: f.status,
      photo: f.photo,
      code: f.code.trim().toUpperCase(),
    };
    if (editing) update(employee.id, data);
    else add(data);
    toast.success(editing ? "Employee details updated" : "Employee added", editing ? `${data.name}'s card has been updated.` : `${data.name} can now activate their account with ${data.email} from the sign-in screen.`);
    onClose();
  };

  return (
    <form
      id="employee-form"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
      className="grid gap-4 px-5 py-5 sm:grid-cols-2"
    >
      {/* photo */}
      <div className="flex items-center gap-4 sm:col-span-2">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload employee photo"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(ev) => {
            ev.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn("group relative grid h-[104px] w-[104px] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", dragging ? "border-blue-600 bg-tint" : "border-slate-300 hover:border-blue-600 dark:border-slate-700 dark:hover:border-blue-500")}
        >
          {f.photo ? <Avatar name={f.name} src={f.photo} size={100} /> : <Avatar name={f.name || "?"} size={100} className="opacity-60" />}
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="h-5 w-5" />
          </span>
          {photoBusy && <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs text-white">…</span>}
        </div>
        <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={(ev) => { void takePhoto(ev.target.files?.[0]); ev.target.value = ""; }} />
        <div className="min-w-0 text-[12.5px] leading-5 text-muted">
          <p className="font-medium text-fg">Employee photo</p>
          <p>Drag &amp; drop or click the circle. JPG, PNG or WEBP up to 5 MB.</p>
          {f.photo && (
            <button type="button" onClick={() => set("photo", undefined)} className="mt-1 inline-flex items-center gap-1 text-xs text-danger hover:underline">
              <Trash2 className="h-3 w-3" /> Remove photo
            </button>
          )}
          {errors.photo && <p className="text-danger">{errors.photo}</p>}
        </div>
      </div>

      <Field label="Full name" required error={errors.name}>
        <Input data-autofocus value={f.name} invalid={!!errors.name} onChange={(ev) => set("name", ev.target.value)} placeholder="e.g. Anil Gowda" />
      </Field>
      <Field label="Official email address" required error={errors.email} hint="Used to sign in">
        <Input type="email" value={f.email} invalid={!!errors.email} onChange={(ev) => set("email", ev.target.value)} placeholder="name@vijayagiri.in" autoComplete="off" />
      </Field>

      <Field label="Phone number" required error={errors.phone}>
        <Input value={f.phone} invalid={!!errors.phone} onChange={(ev) => set("phone", ev.target.value)} inputMode="tel" placeholder="98470 10001" />
      </Field>
      <div>
        <Field label="WhatsApp number" error={errors.whatsapp} hint="Optional">
          <Input value={f.whatsapp} invalid={!!errors.whatsapp} onChange={(ev) => set("whatsapp", ev.target.value)} inputMode="tel" placeholder="98470 10001" />
        </Field>
        <div className="mt-1.5 flex items-center gap-3 text-[11.5px]">
          <button type="button" onClick={() => set("whatsapp", f.phone)} className="text-accent-text hover:underline">
            Same as phone
          </button>
          {tenDigits(f.whatsapp).length === 10 && (
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[#16a34a] hover:underline">
              <WhatsAppIcon className="h-3.5 w-3.5" /> Open chat
            </a>
          )}
        </div>
      </div>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-fg">
          Accessible showrooms<span className="ml-0.5 text-accent-text">*</span>
        </span>
        <div className={cn("rounded-lg border bg-surface p-1.5", errors.access ? "border-danger" : "border-line")}>
          <div role="button" tabIndex={0} aria-pressed={f.all} onClick={() => set("all", !f.all)} onKeyDown={rowKey(() => set("all", !f.all))} className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40", f.all ? "bg-tint font-medium text-accent-text" : "text-fg hover:bg-hover")}>
            <Checkbox checked={f.all} onChange={() => set("all", !f.all)} label="All showrooms" />
            All Showrooms <span className="text-xs font-normal text-muted">(Central Admin Access)</span>
          </div>
          <div className={cn("mt-1 grid gap-0.5 sm:grid-cols-2", f.all && "pointer-events-none opacity-45")}>
            {branches.map((b) => (
              <div key={b.id} role="button" tabIndex={f.all ? -1 : 0} aria-pressed={f.all || f.ids.includes(b.id)} aria-disabled={f.all} onClick={() => !f.all && toggleBranch(b.id)} onKeyDown={rowKey(() => !f.all && toggleBranch(b.id))} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/40">
                <Checkbox checked={f.all || f.ids.includes(b.id)} onChange={() => toggleBranch(b.id)} label={b.name} />
                <span className="truncate">{b.kind === "hq" ? b.name : `${b.name.replace(/\s*\(.*\)/, "")} - ${b.city}`}</span>
              </div>
            ))}
          </div>
        </div>
        {errors.access && <p className="mt-1 text-[11.5px] text-danger">{errors.access}</p>}
      </div>

      <Field label="Role" error={errors.role}>
        <div className="[&>div]:flex [&>div]:w-full">
          <Select<EmployeeRole> value={f.role} onChange={(v) => set("role", v)} options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: r }))} />
        </div>
      </Field>
      <Field label="Employee ID / code" required error={errors.code} hint={editing ? undefined : "Auto-generated"}>
        <Input value={f.code} invalid={!!errors.code} onChange={(ev) => set("code", ev.target.value.toUpperCase())} placeholder="VAA-EMP-005" className="font-mono uppercase tracking-wider" />
      </Field>

      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-fg">Status</span>
        <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2">
          {(["Active", "Inactive"] as EmployeeStatus[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={f.status === s} onClick={() => set("status", s)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40", f.status === s ? "border-blue-600/60 bg-tint font-medium text-fg shadow-ring" : "border-line bg-surface text-muted hover:border-strong hover:text-fg")}>
              <span className={cn("h-2.5 w-2.5 rounded-full", s === "Active" ? "bg-emerald-500 shadow-[0_0_8px_1px_rgba(16,185,129,0.6)]" : "bg-slate-400")} />
              {s}
              {f.status === s && <Check className="ml-auto h-3.5 w-3.5 text-accent-text" />}
            </button>
          ))}
        </div>
        {errors.status && <p className="mt-1 text-[11.5px] text-danger">{errors.status}</p>}
        {f.status === "Inactive" && !errors.status && <p className="mt-1 text-[11.5px] text-muted">Inactive employees can&apos;t sign in.</p>}
      </div>
    </form>
  );
}

/** Slide-over for adding a new employee (employee = null) or editing one. Cancel discards unsaved changes. */
export function EmployeeDrawer({ employee, presetBranch, open, onClose }: { employee: Employee | null; /** Showroom ticked by default when adding (not editing) */ presetBranch?: string; open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={employee ? "Edit employee" : "Add employee"}
      description={employee ? employee.name : "New staff can sign in with the official email you register here."}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]">
            {employee ? "Save Changes" : "Add Employee"}
          </Button>
        </div>
      }
    >
      <Form employee={employee} presetBranch={presetBranch} onClose={onClose} />
    </Drawer>
  );
}
