"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarCheck, Check, ExternalLink, FileText, Fuel, Gauge, MapPin, Receipt, Ruler, Settings2, ShieldCheck, Weight, Zap } from "lucide-react";
import type { CatalogueModel } from "@/store/catalogue-store";
import { useColourHex, useStock } from "@/store/stock-store";
import { TENURE_OPTIONS, availability, colourStatus, financeResult, inr, minDownFor, normalizePlan, stockHeadline, totalPrice, type FinancePlan } from "@/lib/catalogue";
import { useSettings } from "@/store/settings-store";
import { ADDONS, DEFAULT_ADDONS, addonPrice, ccOf, type AddonId } from "@/lib/insurance";
import { galleryFor } from "@/lib/catalogue-gallery";
import { cn } from "@/lib/utils";
import { spring, stagger, fadeUp } from "@/lib/motion";
import { Carousel } from "./carousel";
import { EmiCalculator } from "./emi-calculator";
import { InsurancePackages } from "./insurance-packages";
import { QuotationDialog, TestRideDialog, YardDialog } from "./kiosk-dialogs";

const tone = {
  ok: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  info: "bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  neutral: "bg-fg/[0.06] text-muted ring-fg/10",
};

const SPEC_CARDS = [
  { key: "mileage", label: "Mileage", icon: Fuel },
  { key: "engine", label: "Engine", icon: Settings2 },
  { key: "power", label: "Max power", icon: Zap },
  { key: "torque", label: "Max torque", icon: Gauge },
  { key: "braking", label: "Braking", icon: ShieldCheck },
  { key: "weight", label: "Kerb weight", icon: Weight },
  { key: "seatHeight", label: "Seat height", icon: Ruler },
] as const;

/** Full-screen detail sheet for one model: gallery, colour swatches with live stock, specs, EMI and the sales actions. */
export function ModelSheet({ item, showroom, branchIds, showroomName, onClose }: { item: CatalogueModel | null; showroom: string; branchIds: string[]; showroomName: string; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    // Esc closes the sheet unless a dialog on top of it already took the key.
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div key={item.model.id} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0, transition: spring }} exit={{ opacity: 0, y: 30, transition: { duration: 0.16 } }} className="fixed inset-0 z-[80] overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-label={`Yamaha ${item.model.name}`}>
          <Sheet item={item} showroom={showroom} branchIds={branchIds} showroomName={showroomName} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Sheet({ item, showroom, branchIds, showroomName, onClose }: { item: CatalogueModel; showroom: string; branchIds: string[]; showroomName: string; onClose: () => void }) {
  const { model, info, media } = item;
  const entries = useStock((s) => s.entries);
  const hexOf = useColourHex();
  const stock = useMemo(() => availability(entries, model, branchIds), [entries, model, branchIds]);

  // Every colour the customer might ask about: the model's own, any with photos, any with stock.
  const colours = useMemo(() => {
    const set = new Set<string>(model.colours);
    media?.photos.forEach((p) => p.colour && set.add(p.colour));
    Object.keys(stock.byColour).forEach((c) => set.add(c));
    return [...set];
  }, [model.colours, media, stock.byColour]);

  const [colour, setColour] = useState<string | null>(() => colours.find((c) => (stock.byColour[c]?.inStock ?? 0) > 0) ?? colours[0] ?? null);
  // The finance plan lives here so the calculator, the quotation and the WhatsApp message all use the same numbers.
  const [addonIds, setAddonIds] = useState<AddonId[]>(DEFAULT_ADDONS);
  const cc = ccOf(info.specs.engine);
  const addons = ADDONS.filter((a) => addonIds.includes(a.id)).map((a) => ({ id: a.id, name: a.name, price: addonPrice(a, cc) }));
  const addonsTotal = addons.reduce((n, a) => n + a.price, 0);
  // Starting rate, tenure and minimum down payment come from Settings → Finance & EMI.
  const settings = useSettings((st) => st.settings);
  const { finance: fin, showcase: show, profile } = settings;
  const charges = fin.processingFee + fin.docCharge;
  const [rawPlan, setRawPlan] = useState<FinancePlan>(() => {
    const price = info.exShowroom + info.rtoInsurance;
    const tenure = (TENURE_OPTIONS as readonly number[]).reduce((best, t) => (Math.abs(t - fin.tenure) < Math.abs(best - fin.tenure) ? t : best), 36);
    return { price, insurance: 0, charges, down: minDownFor(price, fin.minDownPct), rate: fin.interest, tenure, method: "reducing" };
  });
  const plan = normalizePlan({ ...rawPlan, insurance: addonsTotal, charges }, fin.minDownPct);
  const finance = financeResult(plan);
  const [dialog, setDialog] = useState<"ride" | "quote" | "yard" | null>(null);

  const gallery = useMemo(() => galleryFor(item, colour, hexOf), [item, colour, hexOf]);
  const head = stockHeadline(stock);
  const onRoad = info.exShowroom + info.rtoInsurance;
  const specs = SPEC_CARDS.filter((s) => info.specs[s.key]?.trim());

  const openBrochure = () => {
    if (!media?.brochure) return;
    const url = URL.createObjectURL(media.brochure.blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const downloadBrochure = () => {
    if (!media?.brochure) return;
    const url = URL.createObjectURL(media.brochure.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = media.brochure.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-4 sm:px-6 lg:px-10">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button type="button" onClick={onClose} className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-5 text-sm font-semibold text-fg shadow-card outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50">
          <ArrowLeft className="h-5 w-5" />
          All bikes
        </button>
        <p className="min-w-0 flex-1 truncate text-right text-[13px] text-muted">Browsing at {showroomName}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* left: gallery */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Carousel key={colour ?? "none"} images={gallery.images} alt={`Yamaha ${model.name}`} note={gallery.illustration ? `${colour ?? "Illustration"} · illustration` : undefined} />
          {gallery.illustration && <p className="mt-2 text-center text-xs text-muted">Photo for this colour is coming soon. This is an illustration.</p>}
        </div>

        {/* right: details */}
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="min-w-0 space-y-6">
          <motion.div variants={fadeUp}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#003399] dark:text-sky-300">
              {model.series} · {model.category}
            </p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">Yamaha {model.name}</h1>
            {info.tagline && <p className="mt-2 text-lg text-muted">{info.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset", tone[head.tone])}>
                <span className={cn("h-2 w-2 rounded-full", head.tone === "ok" ? "bg-emerald-500" : head.tone === "info" ? "bg-sky-500" : "bg-slate-400")} />
                {head.text}
              </span>
            </div>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              {show.priceSplit ? (
                <>
                  <span>
                    <span className="text-3xl font-extrabold tabular-nums text-fg">{inr(info.exShowroom)}</span> <span className="text-sm text-muted">ex-showroom</span>
                  </span>
                  <span className="text-sm text-muted">
                    On-road about <strong className="tabular-nums text-fg">{inr(onRoad)}</strong>
                  </span>
                </>
              ) : (
                <span>
                  <span className="text-3xl font-extrabold tabular-nums text-fg">{inr(onRoad)}</span> <span className="text-sm text-muted">on-road (incl. RTO &amp; base insurance)</span>
                </span>
              )}
            </p>
          </motion.div>

          {/* colours */}
          {colours.length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-bold text-fg">Colour</h2>
                <span className="text-sm font-semibold text-fg">{colour}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
                {colours.map((c) => {
                  const on = c === colour;
                  const ready = (stock.byColour[c]?.inStock ?? 0) > 0;
                  return (
                    <button key={c} type="button" role="radio" aria-checked={on} aria-label={`${c}: ${colourStatus(stock.byColour[c])}`} onClick={() => setColour(c)} className="relative grid h-14 w-14 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
                      {on && <motion.span layoutId="swatch-ring" transition={spring} className="absolute inset-0 rounded-full border-[3px] border-[#003399] dark:border-sky-300" />}
                      <span className="h-10 w-10 rounded-full border border-black/15 shadow-inner" style={{ background: hexOf(c) }} />
                      {ready && <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-canvas"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
                    </button>
                  );
                })}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                {colours.map((c) => (
                  <li key={c} className={cn("flex items-center gap-1.5", c === colour ? "font-semibold text-fg" : "text-muted")}>
                    <span className="h-2.5 w-2.5 rounded-full border border-black/15" style={{ background: hexOf(c) }} />
                    {c}: {colourStatus(stock.byColour[c])}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* specs */}
          {specs.length > 0 && (
            <motion.div variants={fadeUp}>
              <h2 className="text-base font-bold text-fg">Key specifications</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map((s, i) => (
                  <div key={s.key} className={cn("rounded-2xl border border-line bg-surface p-4 shadow-card", i < 2 && "sm:col-span-1")}>
                    <s.icon className="h-5 w-5 text-[#003399] dark:text-sky-300" />
                    <p className="mt-2 text-[11.5px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
                    <p className="mt-0.5 text-lg font-bold leading-6 text-fg">{info.specs[s.key]}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {info.features.length > 0 && (
            <motion.div variants={fadeUp}>
              <h2 className="text-base font-bold text-fg">Highlights</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {info.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 rounded-xl bg-tint px-3.5 py-2.5 text-[14px] font-medium text-fg">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#003399] dark:text-sky-300" strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          <motion.div variants={fadeUp}>
            <InsurancePackages cc={cc} selected={addonIds} onToggle={(id) => setAddonIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} baseInsurance={Math.min(info.baseInsurance, info.rtoInsurance || info.baseInsurance)} addonsTotal={addonsTotal} finalPrice={totalPrice(plan)} emi={finance.emi} />
          </motion.div>

          <motion.div variants={fadeUp}>
            <EmiCalculator plan={plan} defaultPrice={onRoad} addons={addons} title={`Yamaha ${model.name}${colour ? ` · ${colour}` : ""}`} showroom={showroomName} dealer={profile.legalName} schemes={fin.schemes.filter((x) => x.enabled)} minDownPct={fin.minDownPct} onChange={(p) => setRawPlan((r) => ({ ...r, ...p }))} onQuote={() => setDialog("quote")} />
          </motion.div>

          {/* actions for the sales executive */}
          <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setDialog("ride")} className="inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#003399] to-[#0047AB] px-5 text-[15px] font-bold tracking-wide text-white shadow-[0_10px_30px_-10px_rgba(0,51,153,0.9)] outline-none transition-shadow hover:shadow-[0_12px_34px_-8px_rgba(37,99,235,0.95)] focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
              <CalendarCheck className="h-5 w-5" />
              Book a Test Ride
            </button>
            <button type="button" onClick={() => setDialog("quote")} className="inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl border-2 border-[#003399] bg-surface px-5 text-[15px] font-bold text-[#003399] outline-none transition-colors hover:bg-tint focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-sky-300 dark:text-sky-300">
              <Receipt className="h-5 w-5" />
              Generate Quotation
            </button>
            {show.interBranch && (
              <button type="button" onClick={() => setDialog("yard")} className="inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl border border-line bg-surface px-5 py-2 text-center text-[14px] font-semibold text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50 sm:col-span-2">
                <MapPin className="h-5 w-5 shrink-0" />
                Check Yard Availability Across Other Vijayagiri Branches
              </button>
            )}
            {media?.brochure && (
              <div className="flex gap-3 sm:col-span-2">
                <button type="button" onClick={openBrochure} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50">
                  <FileText className="h-4 w-4" />
                  View brochure
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </button>
                <button type="button" onClick={downloadBrochure} className="inline-flex h-12 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-sm font-semibold text-fg outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50">
                  Download PDF
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      <TestRideDialog open={dialog === "ride"} onClose={() => setDialog(null)} item={item} colour={colour} showroom={showroom} />
      <QuotationDialog open={dialog === "quote"} onClose={() => setDialog(null)} item={item} colour={colour} showroom={showroom} plan={plan} addons={addons} split={show.priceSplit} baseInsurance={Math.min(info.baseInsurance, info.rtoInsurance || info.baseInsurance)} />
      <YardDialog open={dialog === "yard"} onClose={() => setDialog(null)} item={item} showroom={showroom} />
    </div>
  );
}
