"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Check, Printer, X } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { useCatalogue, type CatalogueModel } from "@/store/catalogue-store";
import { intlDigits, useSessionEmployee } from "@/store/employee-store";
import { useColourHex, useStock } from "@/store/stock-store";
import { useSettings } from "@/store/settings-store";
import { availability, financeResult, inr, stockHeadline, totalPrice, type FinancePlan } from "@/lib/catalogue";
import { branchLabel } from "@/lib/branches";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

const field = "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[16px] text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const labelCls = "mb-1.5 block text-sm font-medium text-fg";
const primaryBtn = "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#003399] to-[#0047AB] px-5 text-sm font-bold tracking-wide text-white shadow-[0_8px_24px_-10px_rgba(0,51,153,0.9)] outline-none transition-shadow hover:shadow-[0_10px_28px_-8px_rgba(37,99,235,0.95)] focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";
const ghostBtn = "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50";

/** Centred sheet (bottom sheet on phones) above the model detail. Esc closes only this dialog. */
export function KioskDialog({ open, onClose, title, subtitle, children, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-end justify-center bg-[var(--scrim)] p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: spring }}
            exit={{ y: 24, opacity: 0, transition: { duration: 0.14 } }}
            onClick={(e) => e.stopPropagation()}
            className={cn("flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-overlay shadow-pop sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-fg">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-blue-500/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface Common {
  open: boolean;
  onClose: () => void;
  item: CatalogueModel;
  colour: string | null;
  /** Showroom the customer is browsing at ("all" when browsing every showroom this employee can open) */
  showroom: string;
}

/** Showroom to attach a request or quotation to: the one being browsed, or a choice when browsing all of them. */
function useShowroom(showroom: string) {
  const { branches, byId } = useBranchTools();
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked ?? (byId(showroom) ? showroom : (branches[0]?.id ?? ""));
  return { branches, id, branch: byId(id), setPicked, canChoose: showroom === "all" && branches.length > 1 };
}

function ShowroomSelect({ s }: { s: ReturnType<typeof useShowroom> }) {
  if (!s.canChoose) return null;
  return (
    <label className="block">
      <span className={labelCls}>Showroom</span>
      <select value={s.id} onChange={(e) => s.setPicked(e.target.value)} className={field}>
        {s.branches.map((b) => (
          <option key={b.id} value={b.id}>
            {branchLabel(b)}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ───────── Book a test ride ───────── */

export function TestRideDialog({ open, onClose, item, colour, showroom }: Common) {
  const me = useSessionEmployee();
  const addEnquiry = useCatalogue((s) => s.addEnquiry);
  const s = useShowroom(showroom);
  const notifyTarget = useSettings((st) => st.settings.showcase.notifyTarget).trim();
  const dealer = useSettings((st) => st.settings.profile.legalName);
  const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [f, setF] = useState({ name: "", phone: "", date: today });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setDone(false);
      setF({ name: "", phone: "", date: today });
      setErrors({});
    }, 200);
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter the customer's name";
    if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number";
    if (!f.date || f.date < today) e.date = "Pick today or a later date";
    setErrors(e);
    if (Object.keys(e).length) return;
    addEnquiry({ type: "test-ride", modelId: item.model.id, modelName: item.model.name, colour, branchId: s.id, customer: f.name.trim(), phone: f.phone.trim(), date: f.date, by: me?.name ?? "Staff" });
    setDone(true);
  };

  return (
    <KioskDialog open={open} onClose={close} title="Book a test ride" subtitle={`Yamaha ${item.model.name}${colour ? ` · ${colour}` : ""}`}>
      {done ? (
        <div className="flex flex-col items-center py-6 text-center">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)]">
            <Check className="h-8 w-8" strokeWidth={3} />
          </motion.span>
          <p className="mt-4 text-lg font-bold text-fg">Test ride requested</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {f.name.trim()} · {new Date(`${f.date}T00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            {s.branch ? ` · ${branchLabel(s.branch)}` : ""}. Our team will confirm shortly on {f.phone.trim()}.
          </p>
          {notifyTarget && (
            <button
              type="button"
              onClick={() => {
                const text = `New test ride request – ${dealer}\nCustomer: ${f.name.trim()} (${f.phone.trim()})\nBike: Yamaha ${item.model.name}${colour ? ` · ${colour}` : ""}\nDate: ${f.date}\nShowroom: ${s.branch ? branchLabel(s.branch) : "-"}\nTaken by: ${me?.name ?? "Staff"}`;
                const url = notifyTarget.includes("@") ? `mailto:${notifyTarget}?subject=${encodeURIComponent("Test ride request")}&body=${encodeURIComponent(text)}` : `https://wa.me/${intlDigits(notifyTarget)}?text=${encodeURIComponent(text)}`;
                window.open(url, "_blank", "noopener");
              }}
              className={cn(ghostBtn, "mt-6")}
            >
              {notifyTarget.includes("@") ? "Notify the team by email" : "Notify the team on WhatsApp"}
            </button>
          )}
          <button type="button" onClick={close} className={cn(primaryBtn, notifyTarget ? "mt-3" : "mt-6")}>
            Done
          </button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className={labelCls}>Customer name</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name" autoComplete="off" className={cn(field, errors.name && "!border-red-500")} />
            {errors.name && <span className="mt-1 block text-[12.5px] font-medium text-red-600 dark:text-red-400">{errors.name}</span>}
          </label>
          <label className="block">
            <span className={labelCls}>Mobile number</span>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="98470 12345" autoComplete="off" className={cn(field, errors.phone && "!border-red-500")} />
            {errors.phone && <span className="mt-1 block text-[12.5px] font-medium text-red-600 dark:text-red-400">{errors.phone}</span>}
          </label>
          <label className="block">
            <span className={labelCls}>Preferred date</span>
            <input type="date" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={cn(field, errors.date && "!border-red-500")} />
            {errors.date && <span className="mt-1 block text-[12.5px] font-medium text-red-600 dark:text-red-400">{errors.date}</span>}
          </label>
          <ShowroomSelect s={s} />
          <button type="submit" className={cn(primaryBtn, "w-full")}>
            <CalendarCheck className="h-5 w-5" />
            Request test ride
          </button>
        </form>
      )}
    </KioskDialog>
  );
}

/* ───────── Quotation / price slip ───────── */

export function QuotationDialog({ open, onClose, item, colour, showroom, plan, addons, split, baseInsurance }: Common & { plan: FinancePlan; addons: { name: string; price: number }[]; split: boolean; baseInsurance: number }) {
  const me = useSessionEmployee();
  const s = useShowroom(showroom);
  const profile = useSettings((st) => st.settings.profile);
  const [customer, setCustomer] = useState("");
  // One quotation number and date per time the dialog is opened.
  const [stamp, setStamp] = useState(0);
  useEffect(() => {
    if (open) setStamp(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect -- needs the clock, which only exists after mount
  }, [open]);

  const { info, model } = item;
  // When the salesperson changed the price in the calculator, the slip shows that price instead of the ex-showroom + RTO split.
  const standardPrice = plan.price === info.exShowroom + info.rtoInsurance && split;
  const fin = financeResult(plan);
  const date = new Date(stamp);
  const valid = new Date(stamp + 7 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const no = `VAA-Q-${date.toISOString().slice(2, 10).replace(/-/g, "")}-${stamp.toString(36).slice(-4).toUpperCase()}`;

  const row = (label: string, value: string, strong?: boolean) => (
    <tr key={label} className={cn("border-b border-slate-200", strong && "font-bold")}>
      <td className="py-2 pr-4 text-slate-600">{label}</td>
      <td className="py-2 text-right tabular-nums text-slate-900">{value}</td>
    </tr>
  );

  const sheet = (
      <div className="rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#003399] pb-4">
          <div>
            <p className="text-xl font-extrabold tracking-tight text-[#003399]">{profile.legalName}</p>
            <p className="text-xs text-slate-600">Authorized Yamaha Dealer · Ernakulam</p>
            {s.branch && (
              <p className="mt-1.5 max-w-xs text-xs text-slate-600">
                {branchLabel(s.branch)} · {s.branch.address}
                <br />
                {s.branch.phone}
              </p>
            )}
            {(profile.gstin || profile.cin) && (
              <p className="mt-1 text-[11px] text-slate-500">
                {profile.gstin && `GSTIN ${profile.gstin}`}
                {profile.gstin && profile.cin && " · "}
                {profile.cin && `CIN ${profile.cin}`}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right text-xs text-slate-600">
            <p className="text-sm font-bold text-slate-900">QUOTATION</p>
            <p className="font-mono">{no}</p>
            <p>Date: {fmt(date)}</p>
            <p>Valid till: {fmt(valid)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</p>
            <p className="mt-0.5 font-medium">{customer.trim() || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</p>
            <p className="mt-0.5 font-medium">Yamaha {model.name}</p>
            <p className="text-xs text-slate-600">{colour ? `Colour: ${colour}` : model.series}</p>
          </div>
        </div>

        <table className="mt-5 w-full text-sm">
          <tbody>
            {standardPrice && row("Ex-showroom price", inr(info.exShowroom))}
            {standardPrice && row("RTO, registration & insurance (estimate)", inr(info.rtoInsurance))}
            {row(standardPrice ? "On-road price (incl. base insurance)" : "On-road price (as quoted, incl. base insurance)", inr(plan.price), true)}
          </tbody>
        </table>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Insurance</p>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {row("Base: 1 yr comprehensive + 5 yrs third party (included above)", `~${inr(baseInsurance)}`)}
            {addons.length === 0 && row("Add-ons", "None selected")}
            {addons.map((a) => row(a.name, `+${inr(a.price)}`))}
            {addons.length > 0 && row("Add-ons total", inr(plan.insurance))}
            {row("Total insurance cost (base + add-ons)", inr(baseInsurance + plan.insurance))}
            {row("Final on-road price", inr(totalPrice(plan)), true)}
          </tbody>
        </table>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Finance estimate</p>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {row("Down payment", inr(plan.down))}
            {row("Loan amount", inr(fin.loan))}
            {row("Tenure", `${plan.tenure} months`)}
            {row(`Interest rate (${plan.method === "flat" ? "flat" : "reducing balance"}, indicative)`, `${plan.rate}% p.a.`)}
            {row("Total interest payable", inr(fin.interest))}
            {plan.charges > 0 && row("Financier charges (processing + documentation), upfront", inr(plan.charges))}
            {plan.charges > 0 && row("Cash needed at delivery (down payment + charges)", inr(fin.upfront))}
            {row("Total amount paid (incl. down payment)", inr(fin.totalPaid))}
            {row("Estimated monthly EMI", inr(fin.emi), true)}
          </tbody>
        </table>

        <p className="mt-5 text-[11px] leading-4 text-slate-500">This is an indicative quotation, not a tax invoice. Prices, taxes, RTO and insurance charges and finance terms are subject to change at the time of billing. Prepared by {me?.name ?? "Vijayagiri staff"}.{(profile.hotline || profile.email) && ` Questions: ${[profile.hotline, profile.email].filter(Boolean).join(" · ")}.`}</p>
      </div>

  );

  return (
    <KioskDialog open={open} onClose={onClose} title="Quotation / price slip" subtitle="Check the details, then print or save as PDF." wide>
      <ShowroomSelect s={s} />
      <label className={cn("block", s.canChoose && "mt-4")}>
        <span className={labelCls}>Customer name (optional)</span>
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Printed on the slip" className={field} />
      </label>

      <div className="mt-5">{sheet}</div>
      {open && typeof document !== "undefined" && createPortal(<div id="print-root">{sheet}</div>, document.body)}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => window.print()} className={cn(primaryBtn, "flex-1")}>
          <Printer className="h-5 w-5" />
          Print / Save as PDF
        </button>
        <button type="button" onClick={onClose} className={ghostBtn}>
          Close
        </button>
      </div>
    </KioskDialog>
  );
}

/* ───────── Yard availability across branches ───────── */

export function YardDialog({ open, onClose, item, showroom }: Omit<Common, "colour">) {
  const { all } = useBranchTools();
  const entries = useStock((s) => s.entries);
  const hexOf = useColourHex();
  // Counts only, from every showroom, so staff can offer a unit that is parked at another branch.
  const rows = all
    .map((b) => ({ b, a: availability(entries, item.model, [b.id]) }))
    .sort((x, y) => Number(y.b.id === showroom) - Number(x.b.id === showroom) || y.a.inStock - x.a.inStock || y.a.transit - x.a.transit);
  const total = rows.reduce((n, r) => n + r.a.inStock, 0);

  return (
    <KioskDialog open={open} onClose={onClose} title="Yard availability" subtitle={`Yamaha ${item.model.name} across all Vijayagiri branches · ${total} unit${total === 1 ? "" : "s"} ready now`} wide>
      <ul className="space-y-3">
        {rows.map(({ b, a }) => {
          const head = stockHeadline(a);
          const colours = Object.entries(a.byColour).filter(([, c]) => c.inStock + c.transit > 0);
          return (
            <li key={b.id} className={cn("rounded-2xl border p-4", b.id === showroom ? "border-[#003399]/40 bg-tint" : "border-line bg-surface")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[15px] font-bold text-fg">{branchLabel(b)}</p>
                {b.id === showroom && <span className="rounded-full bg-[#003399] px-2 py-0.5 text-[11px] font-semibold text-white">You are here</span>}
                <span className={cn("ml-auto rounded-full px-3 py-1 text-xs font-semibold", head.tone === "ok" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : head.tone === "info" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-fg/[0.06] text-muted")}>
                  {a.inStock > 0 ? `${a.inStock} in yard` : a.transit > 0 ? `${a.transit} in transit` : "None right now"}
                </span>
              </div>
              {colours.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {colours.map(([c, n]) => (
                    <li key={c} className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas py-1 pl-1.5 pr-3 text-xs text-fg">
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: hexOf(c) }} />
                      {c} · {n.inStock > 0 ? `${n.inStock} in yard` : `${n.transit} in transit`}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">
                {b.phone.split(" / ")[0]} · {b.manager}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">Counts come from live stock. Ask the branch to confirm and arrange a transfer before promising a delivery date.</p>
    </KioskDialog>
  );
}
