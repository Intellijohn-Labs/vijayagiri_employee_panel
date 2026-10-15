"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, LogOut, MapPin, Moon, Sun } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useBranchTools } from "@/store/branch-store";
import { useCatalogueModels, type CatalogueModel } from "@/store/catalogue-store";
import { useColourHex, useStock } from "@/store/stock-store";
import { useTheme } from "@/store/theme-store";
import { useSettings } from "@/store/settings-store";
import { KIOSK_TABS, availability, inr, kioskTab, stockHeadline, type KioskTab } from "@/lib/catalogue";
import { heroImage } from "@/lib/catalogue-gallery";
import { branchLabel } from "@/lib/branches";
import { watermarkMask } from "@/components/auth/auth-kit";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { ModelSheet } from "./model-sheet";

const LOGO = "url(/images/vijayagiri-logo.png)";
const maskUrl = (custom: string | null) => (custom ? `url("${custom}")` : LOGO);
const ALL = "all";
const tone = {
  ok: "bg-emerald-500 text-white",
  info: "bg-sky-500 text-white",
  neutral: "bg-slate-500/85 text-white",
};

/** Customer-facing showcase: hand the tablet over, or leave it running on a showroom screen. */
export function KioskView() {
  const { branches, byId } = useBranchTools();
  const scope = useApp((s) => s.branchScope);
  const { theme, toggle } = useTheme();
  const items = useCatalogueModels();
  const entries = useStock((s) => s.entries);
  const hexOf = useColourHex();

  // Start at the showroom chosen in the workspace, or the only one this employee can open.
  const [picked, setPicked] = useState<string | null>(null);
  const showroom = picked && (picked === ALL || byId(picked)) ? picked : byId(scope) ? scope : branches.length === 1 ? branches[0].id : ALL;
  const branchIds = useMemo(() => (showroom === ALL ? branches.map((b) => b.id) : [showroom]), [showroom, branches]);
  const showroomName = showroom === ALL ? "all your showrooms" : branchLabel(byId(showroom)!);

  const { showcase: show, profile } = useSettings((st) => st.settings);
  const [tab, setTab] = useState<KioskTab>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // Left alone for the configured time, the showcase goes back to its home screen for the next customer.
  useEffect(() => {
    if (!show.idleMinutes) return;
    let timer: ReturnType<typeof setTimeout>;
    const home = () => {
      setOpenId(null);
      setTab("all");
      window.scrollTo({ top: 0 });
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(home, show.idleMinutes * 60_000);
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [show.idleMinutes]);
  const [lastOpen, setLastOpen] = useState<CatalogueModel | null>(null);

  const inTab = (m: CatalogueModel, t: KioskTab) => t === "all" || kioskTab(m.model) === t;
  const shown = items.filter((m) => inTab(m, tab));
  const opened = openId ? (items.find((m) => m.model.id === openId) ?? lastOpen) : null;
  const readyHere = items.reduce((n, m) => n + availability(entries, m.model, branchIds).inStock, 0);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* header band */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#002a80] via-[#003399] to-[#0047AB] text-white">
        <div aria-hidden className="pointer-events-none absolute -bottom-6 right-[-4%] aspect-[735/306] w-[min(520px,70%)] bg-white opacity-[0.07]" style={watermarkMask} />
        <div aria-hidden className="horizon-grid pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-40" />
        <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-4 px-4 py-5 sm:px-6 lg:px-10">
          <div role="img" aria-label={profile.legalName} className="h-12 w-[7.5rem] shrink-0 bg-white sm:h-14 sm:w-36" style={{ WebkitMaskImage: maskUrl(profile.logoLight), maskImage: maskUrl(profile.logoLight), WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "left center", maskPosition: "left center" }} />

          <div className="order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-200">Yamaha · Revs Your Heart</p>
            <div className="mt-1 min-w-0 [&>div]:flex [&>div]:w-full sm:[&>div]:inline-flex sm:[&>div]:w-auto">
            <Popover
              align="start"
              width={360}
              trigger={({ toggle: t, open }) => (
                <button type="button" onClick={t} aria-expanded={open} aria-label="Choose showroom" className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-xl sm:w-auto bg-white/10 px-3.5 py-2 text-left outline-none ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white">
                  <MapPin className="h-5 w-5 shrink-0 text-sky-200" />
                  <span className="min-w-0 truncate text-base font-semibold sm:text-lg">
                    <span className="font-normal text-sky-100">Browsing at </span>
                    {showroom === ALL ? "All my showrooms" : branchLabel(byId(showroom)!)}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
                </button>
              )}
            >
              {({ close }) => (
                <ul className="p-1.5" role="listbox" aria-label="Showroom">
                  {[...(branches.length > 1 ? [{ id: ALL, label: "All my showrooms" }] : []), ...branches.map((b) => ({ id: b.id, label: branchLabel(b) }))].map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={o.id === showroom}
                        onClick={() => {
                          setPicked(o.id);
                          close();
                        }}
                        className={cn("flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50", o.id === showroom ? "font-semibold text-fg" : "text-muted")}
                      >
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.id === showroom && <Check className="h-4 w-4 text-[#003399] dark:text-sky-300" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Popover>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-2 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/30 md:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              {readyHere} bike{readyHere === 1 ? "" : "s"} ready to ride home
            </span>
            <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 outline-none ring-1 ring-white/20 transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link href="/branches" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold outline-none ring-1 ring-white/20 transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Exit showcase</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        {/* category tabs */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Category">
          {KIOSK_TABS.map((t) => {
            const on = t.id === tab;
            const n = items.filter((m) => inTab(m, t.id)).length;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={cn("relative shrink-0 rounded-2xl border px-5 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", on ? "border-transparent text-white" : "border-line bg-surface text-fg hover:bg-hover")}>
                {on && <motion.span layoutId="kiosk-tab" transition={spring} className="absolute inset-0 rounded-2xl bg-[#003399] shadow-[0_10px_24px_-12px_rgba(0,51,153,0.95)]" />}
                <span className="relative block text-[15px] font-bold leading-5">
                  {t.label} <span className={cn("ml-1 text-xs font-semibold", on ? "text-white/70" : "text-muted")}>{n}</span>
                </span>
                {"sub" in t && <span className={cn("relative block text-xs", on ? "text-sky-100" : "text-muted")}>{t.sub}</span>}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="mt-16 text-center text-lg text-muted">No models in this category yet.</p>
        ) : (
          <motion.ul key={tab} variants={stagger(0.05)} initial="hidden" animate="show" className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((m) => (
                <ModelCard
                  key={m.model.id}
                  item={m}
                  hero={heroImage(m, hexOf)}
                  split={show.priceSplit}
                  headline={stockHeadline(availability(entries, m.model, branchIds))}
                  onOpen={() => {
                    setLastOpen(m);
                    setOpenId(m.model.id);
                  }}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </main>

      <ModelSheet item={opened} showroom={showroom} branchIds={branchIds} showroomName={showroomName} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ModelCard({ item, hero, split, headline, onOpen }: { item: CatalogueModel; hero: string; split: boolean; headline: ReturnType<typeof stockHeadline>; onOpen: () => void }) {
  const { model, info } = item;
  const chips = [info.specs.engine, info.specs.mileage].filter(Boolean);
  return (
    <motion.li layout variants={fadeUp} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }} transition={spring}>
      <motion.button type="button" onClick={onOpen} whileTap={{ scale: 0.98 }} whileHover={{ y: -4 }} aria-label={`Open Yamaha ${model.name}`} className="group block w-full overflow-hidden rounded-3xl border border-line bg-surface text-left shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-blue-500/60">
        <div className="relative aspect-[16/11] overflow-hidden bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" draggable={false} className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105" />
          <span className={cn("absolute bottom-3 left-3 max-w-[85%] truncate rounded-full px-3 py-1 text-xs font-semibold shadow", tone[headline.tone])}>{headline.text}</span>
        </div>
        <div className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#003399] dark:text-sky-300">{model.series}</p>
          <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-fg">Yamaha {model.name}</h2>
          {info.tagline && <p className="mt-1 line-clamp-1 text-sm text-muted">{info.tagline}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-fg/[0.06] px-3 py-1 text-xs font-semibold text-fg">
                {c}
              </span>
            ))}
            <span className="ml-auto text-right">
              <span className="block text-[11px] text-muted">{split ? "Ex-showroom from" : "On-road from"}</span>
              <span className="text-lg font-extrabold tabular-nums text-fg">{info.exShowroom ? inr(split ? info.exShowroom : info.exShowroom + info.rtoInsurance) : "Ask us"}</span>
            </span>
          </div>
        </div>
      </motion.button>
    </motion.li>
  );
}
