"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Clock, MapPin, Pencil, Phone, RotateCcw } from "lucide-react";
import { deriveDial, useAllBranches, useBranchStore } from "@/store/branch-store";
import { clock12, hoursText, isOpenNow, parseHours, useSettings } from "@/store/settings-store";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/toast-store";
import { BASE_BRANCHES, STATUS_OVERRIDES, branchTitle, overrideOf, type Branch, type StatusOverride } from "@/lib/branches";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Textarea } from "@/components/ui/primitives";
import { selectCls } from "./controls";

const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** One showroom: a summary row with an Edit button that opens its form in place. Saving writes to the branches store, so Branches and every badge update at once. */
function ShowroomCard({ branch }: { branch: Branch }) {
  const profile = useSettings((s) => s.settings.profile);
  const now = useApp((s) => s.now);
  const save = useBranchStore((s) => s.save);
  const reset = useBranchStore((s) => s.reset);
  const edited = useBranchStore((s) => !!s.edits[branch.id]);
  const ownHours = useBranchStore((s) => !!s.edits[branch.id]?.hours);
  const [open, setOpen] = useState(false);

  const initial = () => {
    const range = parseHours(branch.hours) ?? parseHours(hoursText(profile));
    return {
      name: branch.name,
      city: branch.city,
      address: branch.address,
      phone: branch.phone,
      whatsapp: branch.whatsapp ?? "",
      opens: range ? hhmm(range[0]) : profile.opens,
      closes: range ? hhmm(range[1]) : profile.closes,
      days: branch.days ?? "Mon – Sat",
      override: overrideOf(branch) as StatusOverride,
    };
  };
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const isOpen = isOpenNow(branch, now || Date.now(), profile);
  const forced = overrideOf(branch);

  const submit = () => {
    const e: Record<string, string> = {};
    const city = f.city.trim();
    if (!f.name.trim()) e.name = "Enter the showroom name";
    if (!city) e.city = "Enter the city or location";
    if (!f.address.trim()) e.address = "Enter the address";
    if (!f.phone.trim()) e.phone = "Enter a phone number";
    if (f.whatsapp.trim() && f.whatsapp.replace(/\D/g, "").length < 10) e.whatsapp = "Enter a 10-digit WhatsApp number";
    if (!f.opens || !f.closes || f.opens === f.closes) e.hours = "Set different opening and closing times";
    if (!f.days.trim()) e.days = "Enter the working days";
    setErrors(e);
    if (Object.keys(e).length) return;

    const hours = `${clock12(f.opens)} – ${clock12(f.closes)}`;
    const patch: Partial<Omit<Branch, "id">> = {
      name: f.name.trim(),
      city,
      // The short tag follows the city for sub-branches; the Head Office is always just "Head Office".
      short: branch.kind === "hq" ? "Head Office" : city !== branch.city ? city : branch.short,
      address: f.address.trim(),
      phone: f.phone.trim(),
      dial: deriveDial(f.phone),
      whatsapp: f.whatsapp.trim() || undefined,
      days: f.days.trim(),
      status: f.override === "closed" ? "closed" : "open",
      statusOverride: f.override,
      // Hours nobody has changed keep following the dealership default.
      ...(hours === branch.hours && !ownHours ? {} : { hours }),
    };
    if (!save(branch.id, patch)) return;
    toast.success(`${f.name.trim()} updated`, "The new name, address and timings now show across the app.");
    setOpen(false);
  };

  const restore = () => {
    const base = BASE_BRANCHES.find((b) => b.id === branch.id);
    if (!window.confirm(`Restore the built-in details for ${base?.short ?? "this showroom"}?`)) return;
    if (reset(branch.id)) toast.success("Original details restored");
    setOpen(false);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-tint text-accent-text">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-fg">{branchTitle(branch)}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {branch.city}
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {branch.phone.split(" / ")[0]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {branch.hours}
              {branch.days ? ` · ${branch.days}` : ""}
            </span>
          </p>
        </div>
        <Badge tone={isOpen ? "ok" : "neutral"} dot>
          {isOpen ? "Open" : "Closed"}
          {forced !== "auto" && " · forced"}
        </Badge>
        <Button
          type="button"
          size="sm"
          leading={<Pencil className="h-3.5 w-3.5" />}
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              setF(initial());
              setErrors({});
            }
            setOpen((o) => !o);
          }}
        >
          {open ? "Close" : "Edit Showroom"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="overflow-hidden">
            <form
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault();
                submit();
              }}
              className="grid gap-4 border-t border-line bg-hover/30 p-4 sm:grid-cols-2"
            >
              <Field label="Showroom name" required error={errors.name}>
                <Input value={f.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Location / city" required error={errors.city}>
                <Input value={f.city} invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Address" required error={errors.address} className="sm:col-span-2">
                <Textarea rows={2} value={f.address} invalid={!!errors.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field label="Phone number" required error={errors.phone} hint="separate several with /">
                <Input value={f.phone} invalid={!!errors.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
              </Field>
              <Field label="WhatsApp number" error={errors.whatsapp} hint="optional">
                <Input value={f.whatsapp} invalid={!!errors.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" placeholder="98470 12345" />
              </Field>
              <Field label="Opening time">
                <Input type="time" value={f.opens} onChange={(e) => set("opens", e.target.value)} />
              </Field>
              <Field label="Closing time" error={errors.hours}>
                <Input type="time" value={f.closes} invalid={!!errors.hours} onChange={(e) => set("closes", e.target.value)} />
              </Field>
              <Field label="Working days" required error={errors.days}>
                <Input value={f.days} invalid={!!errors.days} onChange={(e) => set("days", e.target.value)} placeholder="Mon – Sat" />
              </Field>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-fg">Status override</span>
                <select value={f.override} onChange={(e) => set("override", e.target.value as StatusOverride)} className={selectCls} aria-label="Status override">
                  {STATUS_OVERRIDES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={cn("flex flex-wrap items-center gap-2 sm:col-span-2", edited ? "justify-between" : "justify-end")}>
                {edited && (
                  <button type="button" onClick={restore} className="inline-flex items-center gap-1.5 rounded text-xs text-muted outline-none hover:text-fg focus-visible:underline">
                    <RotateCcw className="h-3.5 w-3.5" /> Restore built-in details
                  </button>
                )}
                <span className="flex gap-2">
                  <Button type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]">
                    Save Showroom
                  </Button>
                </span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** Every showroom in the network, each editable in place. */
export function ShowroomList() {
  const branches = useAllBranches();
  return (
    <section aria-label="Showrooms">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-fg">Showrooms ({branches.length})</h2>
        <p className="mt-0.5 text-xs text-muted">Edit any showroom here. Each one saves on its own and the changes show up straight away on Branches, the open / closed badges and quotations.</p>
      </div>
      <ul className="space-y-3">
        {branches.map((b) => (
          <li key={b.id}>
            <ShowroomCard branch={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}
