"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { MessageCircle, Printer, RotateCcw } from "lucide-react";
import { DOWN_MIN, PRICE_MAX, PRICE_MIN, RATE_MAX, RATE_MIN, RATE_METHODS, TENURE_OPTIONS, financeResult, inr, minDownFor, totalPrice, type FinancePlan, type FinanceResult } from "@/lib/catalogue";
import { cn } from "@/lib/utils";
import type { Scheme } from "@/store/settings-store";

const DOWN_PRESETS = [15, 25, 40, 50];

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const label = "text-sm font-medium text-fg";
const pill = "relative h-11 rounded-xl border text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50";
const pillOff = "border-line bg-canvas text-fg hover:bg-hover";

/** Text-style number box: you can type freely (e.g. clear it and retype); the value is pulled back into range when you leave it. */
function NumField({ id, value, min, max, prefix, suffix, decimals, onChange, ariaLabel }: { id: string; value: number; min: number; max: number; prefix?: string; suffix?: string; decimals?: boolean; onChange: (v: number) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="relative block w-full max-w-[11rem]">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{prefix}</span>}
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode={decimals ? "decimal" : "numeric"}
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value));
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const t = e.target.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, "");
          setDraft(t);
          const n = parseFloat(t);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          const n = parseFloat(draft ?? "");
          onChange(clamp(Number.isFinite(n) ? n : value, min, max));
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={cn("h-11 w-full rounded-xl border border-slate-300 bg-white text-right text-[16px] font-bold tabular-nums text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100", prefix ? "pl-7" : "pl-3", suffix ? "pr-9" : "pr-3")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{suffix}</span>}
    </span>
  );
}

function Slider({ id, min, max, step, value, onChange, text }: { id: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; text: string }) {
  const pct = max === min ? 0 : clamp(((value - min) / (max - min)) * 100, 0, 100);
  return <input id={id} type="range" min={min} max={max} step={step} value={clamp(value, min, max)} onChange={(e) => onChange(Number(e.target.value))} className="emi-range h-8 w-full cursor-pointer" style={{ ["--fill" as string]: `${pct}%` }} aria-valuetext={text} />;
}

/** Principal vs interest as an animated donut. */
function Donut({ principalShare }: { principalShare: number }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const pct = Math.round(principalShare * 100);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-sky-400/70" />
          <motion.circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" strokeLinecap="butt" className="stroke-[#003399] dark:stroke-blue-500" initial={false} animate={{ strokeDasharray: `${C * principalShare} ${C}` }} transition={{ type: "spring", stiffness: 160, damping: 24 }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-xl font-extrabold leading-5 tabular-nums text-fg">{pct}%</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-muted">principal</span>
          </span>
        </div>
      </div>
      <ul className="space-y-2 text-[13px]">
        <li className="flex items-center gap-2 text-fg">
          <span className="h-3 w-3 rounded-sm bg-[#003399] dark:bg-blue-500" />
          Principal <strong className="tabular-nums">{pct}%</strong>
        </li>
        <li className="flex items-center gap-2 text-fg">
          <span className="h-3 w-3 rounded-sm bg-sky-400/70" />
          Interest <strong className="tabular-nums">{100 - pct}%</strong>
        </li>
      </ul>
    </div>
  );
}

/** One line of text describing the plan, for WhatsApp. */
export function planSummary(title: string, showroom: string, dealer: string, p: FinancePlan, r: FinanceResult, addons: { name: string; price: number }[] = []) {
  return [
    `*${title}* – finance plan`,
    `On-road price (incl. base insurance): ${inr(p.price)}`,
    ...(addons.length ? ["Insurance add-ons:", ...addons.map((a) => `  • ${a.name}: ${inr(a.price)}`), `Add-ons total: ${inr(p.insurance)}`, `*Final on-road price: ${inr(totalPrice(p))}*`] : []),
    `Down payment: ${inr(p.down)}`,
    `Loan amount: ${inr(r.loan)}`,
    `Interest: ${p.rate}% p.a. (${p.method === "flat" ? "flat rate" : "reducing balance"})`,
    `Tenure: ${p.tenure} months`,
    `*Monthly EMI: ${inr(r.emi)}*`,
    `Total interest: ${inr(r.interest)}`,
    `Total paid (incl. down payment): ${inr(r.totalPaid)}`,
    ...(p.charges > 0 ? [`Financier charges (processing + documentation), upfront: ${inr(p.charges)}`, `Cash needed at delivery: ${inr(r.upfront)}`] : []),
    "",
    `${dealer} – ${showroom}`,
    "Indicative only; final terms depend on the financier's approval.",
  ].join("\n");
}

/**
 * Customer-facing EMI estimator. `plan` is the (already range-checked) plan and `onChange` patches it, so the sheet that owns it can
 * reuse the same numbers in the quotation. `defaultPrice` is the model's on-road price, for the "reset" link.
 */
export function EmiCalculator({ plan, defaultPrice, title, showroom, dealer, schemes, minDownPct, addons, onChange, onQuote }: { plan: FinancePlan; defaultPrice: number; title: string; showroom: string; dealer: string; schemes: Scheme[]; minDownPct: number; addons: { name: string; price: number }[]; onChange: (patch: Partial<FinancePlan>) => void; onQuote: () => void }) {
  const result = financeResult(plan);
  const shown = useMotionValue(result.emi);
  const text = useTransform(shown, (v) => inr(v));
  useEffect(() => {
    const c = animate(shown, result.emi, { type: "spring", stiffness: 220, damping: 26 });
    return () => c.stop();
  }, [result.emi, shown]);

  const total = totalPrice(plan);
  const downMin = minDownFor(total, minDownPct);
  const downMax = total - DOWN_MIN;
  const downPct = (v: number) => Math.round((v / total) * 100);
  const preset = (pct: number) => Math.round((total * pct) / 100 / 500) * 500;

  const share = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(planSummary(title, showroom, dealer, plan, result, addons))}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-fg">EMI calculator</h3>
          <p className="mt-0.5 text-[13px] text-muted">Change anything and the EMI updates instantly.</p>
        </div>
        <div className="inline-flex rounded-xl border border-line bg-canvas p-1" role="radiogroup" aria-label="Interest calculation">
          {RATE_METHODS.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={plan.method === m.value} onClick={() => onChange({ method: m.value })} className={cn("relative h-9 rounded-lg px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", plan.method === m.value ? "text-white" : "text-muted hover:text-fg")}>
              {plan.method === m.value && <motion.span layoutId="emi-method" className="absolute inset-0 rounded-lg bg-[#003399]" transition={{ type: "spring", stiffness: 300, damping: 25 }} />}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* vehicle price */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <label htmlFor="emi-price" className={label}>
          On-road price <span className="font-normal text-muted">(incl. base insurance)</span>
        </label>
        <NumField id="emi-price" ariaLabel="On-road vehicle price in rupees" value={plan.price} min={PRICE_MIN} max={PRICE_MAX} prefix="₹" onChange={(v) => onChange({ price: v })} />
      </div>
      {plan.price !== defaultPrice && (
        <button type="button" onClick={() => onChange({ price: defaultPrice })} className="mt-1.5 inline-flex items-center gap-1.5 rounded text-xs font-medium text-[#003399] outline-none hover:underline focus-visible:underline dark:text-sky-300">
          <RotateCcw className="h-3 w-3" />
          Use the model&apos;s on-road price ({inr(defaultPrice)})
        </button>
      )}

      {plan.insurance > 0 && (
        <div className="mt-3 space-y-1 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px]">
          <p className="flex justify-between text-muted">
            <span>+ Insurance add-ons ({addons.length})</span>
            <span className="font-semibold tabular-nums text-fg">{inr(plan.insurance)}</span>
          </p>
          <p className="flex justify-between font-semibold text-fg">
            <span>Final on-road price</span>
            <span className="tabular-nums">{inr(total)}</span>
          </p>
        </div>
      )}

      {/* down payment */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="emi-down" className={label}>
            Down payment <span className="font-normal text-muted">({downPct(plan.down)}%)</span>
          </label>
          <NumField id="emi-down-input" ariaLabel="Down payment in rupees" value={plan.down} min={downMin} max={downMax} prefix="₹" onChange={(v) => onChange({ down: v })} />
        </div>
        <Slider id="emi-down" min={downMin} max={downMax} step={500} value={plan.down} onChange={(v) => onChange({ down: v })} text={inr(plan.down)} />
        <div className="flex justify-between text-xs text-muted">
          <span>{inr(downMin)}{minDownPct > 0 && ` (min ${minDownPct}%)`}</span>
          <span>{inr(downMax)}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Down payment presets">
          {DOWN_PRESETS.map((pct) => {
            const on = Math.abs(plan.down - preset(pct)) < 250;
            const below = preset(pct) < downMin;
            return (
              <button key={pct} type="button" aria-pressed={on} disabled={below} title={below ? `The minimum down payment is ${minDownPct}%` : undefined} onClick={() => onChange({ down: clamp(preset(pct), downMin, downMax) })} className={cn(pill, "h-10 disabled:cursor-not-allowed disabled:opacity-40", on ? "border-transparent bg-[#003399] text-white" : pillOff)}>
                {pct}%
              </button>
            );
          })}
        </div>
      </div>

      {/* interest */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="emi-rate" className={label}>
            Interest rate <span className="font-normal text-muted">(% per annum)</span>
          </label>
          <NumField id="emi-rate-input" ariaLabel="Interest rate, percent per annum" value={plan.rate} min={RATE_MIN} max={RATE_MAX} suffix="%" decimals onChange={(v) => onChange({ rate: v })} />
        </div>
        <Slider id="emi-rate" min={RATE_MIN} max={RATE_MAX} step={0.25} value={plan.rate} onChange={(v) => onChange({ rate: v })} text={`${plan.rate} percent`} />
        <div className="flex justify-between text-xs text-muted">
          <span>{RATE_MIN}%</span>
          <span>{RATE_MAX}%</span>
        </div>
        {schemes.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Financier scheme presets">
            {schemes.map((sc) => {
              const on = Math.abs(plan.rate - sc.rate) < 0.005;
              return (
                <button key={sc.id} type="button" aria-pressed={on} onClick={() => onChange({ rate: sc.rate })} className={cn(pill, "h-auto min-h-12 px-1.5 py-1.5 leading-4", on ? "border-transparent bg-[#003399] text-white" : pillOff)}>
                  <span className="block">{sc.name}</span>
                  <span className={cn("block text-xs font-medium", on ? "text-sky-100" : "text-muted")}>{sc.rate}%</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* tenure */}
      <div className="mt-6">
        <p className={cn(label, "mb-2")}>Loan tenure</p>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Loan tenure">
          {TENURE_OPTIONS.map((t) => {
            const on = plan.tenure === t;
            return (
              <button key={t} type="button" role="radio" aria-checked={on} aria-label={`${t} months, ${t / 12} ${t === 12 ? "year" : "years"}`} onClick={() => onChange({ tenure: t })} className={cn(pill, "h-14 px-0.5", on ? "border-transparent text-white" : pillOff)}>
                {on && <motion.span layoutId="emi-tenure" className="absolute inset-0 rounded-xl bg-[#003399]" transition={{ type: "spring", stiffness: 300, damping: 25 }} />}
                <span className="relative block text-[15px] leading-5">{t}</span>
                <span className={cn("relative block text-[10.5px] font-medium leading-3", on ? "text-sky-100" : "text-muted")}>
                  months<span className="hidden sm:inline"> · {t / 12} {t === 12 ? "yr" : "yrs"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* result */}
      <div className="mt-6 rounded-2xl border border-[#003399]/20 bg-tint p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Estimated monthly EMI</p>
        <p className="mt-1 flex items-baseline gap-2" aria-live="polite">
          <motion.span className="text-5xl font-extrabold tabular-nums tracking-tight text-[#003399] dark:text-sky-300">{text}</motion.span>
          <span className="text-lg font-semibold text-muted">/ mo</span>
        </p>
        <div className="mt-5 border-t border-[#003399]/15 pt-5">
          <Donut principalShare={result.principalShare} />
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { k: "Loan principal", v: result.loan },
            { k: "Total interest payable", v: result.interest },
            { k: "Total amount paid", v: result.totalPaid, note: "principal + interest + down payment" },
          ].map((m) => (
            <div key={m.k} className="rounded-xl bg-surface px-3.5 py-3 shadow-card">
              <dt className="text-[11.5px] font-medium text-muted">{m.k}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-fg">{inr(m.v)}</dd>
              {m.note && <p className="text-[10.5px] leading-3 text-muted">{m.note}</p>}
            </div>
          ))}
        </dl>
        {plan.charges > 0 && (
          <p className="mt-3 rounded-xl bg-surface px-3.5 py-2.5 text-[12.5px] text-muted shadow-card">
            Financier charges (processing fee + documentation) of <strong className="tabular-nums text-fg">{inr(plan.charges)}</strong> are paid upfront. Cash needed at delivery: <strong className="tabular-nums text-fg">{inr(result.upfront)}</strong>.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={share} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(37,211,102,0.9)] outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <MessageCircle className="h-5 w-5" />
          Share Plan on WhatsApp
        </button>
        <button type="button" onClick={onQuote} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#003399] bg-surface px-4 text-sm font-bold text-[#003399] outline-none transition-colors hover:bg-tint focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-sky-300 dark:text-sky-300">
          <Printer className="h-5 w-5" />
          Print / Download Quotation
        </button>
      </div>
      <p className="mt-3 text-[11.5px] leading-4 text-muted">Indicative only. The final EMI depends on the financier&apos;s approval, rate and processing charges.</p>
    </div>
  );
}
