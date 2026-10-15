"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bike, Lock, Building2, ChevronDown, ListTree, MapPin, Phone, Search, SearchX, Store, UserRound } from "lucide-react";
import { useColourHex, useStock, type StockEntry } from "@/store/stock-store";
import { branchTitle } from "@/lib/branches";
import { useBranch } from "@/store/branch-store";
import { canAccess, useSessionEmployee } from "@/store/employee-store";
import { catalogueArt } from "@/lib/catalogue-art";
import { BOOKED, IN_STOCK, STATUS_UI, TRANSIT, type ModelCategory } from "@/lib/stock-options";
import { groupByModel, type ModelGroup } from "@/lib/stock-groups";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { ColourDot, VehicleActions } from "./vehicle-actions";
import { StockThumb } from "./stock-thumb";

type Scope = "all" | ModelCategory;

const statusLine = (units: StockEntry[]) => {
  const n = (s: string) => units.filter((u) => u.status === s).length;
  return [
    { label: "Available", n: n(IN_STOCK), tone: "text-ok" },
    { label: "Booked", n: n(BOOKED), tone: "text-warn" },
    { label: "In Transit", n: n(TRANSIT), tone: "text-info" },
  ].filter((x) => x.n > 0);
};

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent", active ? "border-accent bg-accent text-accent-fg shadow-sm" : "border-line bg-surface text-muted hover:border-strong hover:text-fg")}>
      {children}
    </button>
  );
}

/** One model at this showroom: total, colour breakdown, status mix, and an expandable VIN / chassis list. */
function ModelCard({ group, colourQuery }: { group: ModelGroup; colourQuery: string }) {
  const { units } = group;
  const hexOf = useColourHex();
  const [open, setOpen] = useState(false);
  const colours = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of units) m.set(u.colour, (m.get(u.colour) ?? 0) + 1);
    return [...m.entries()].sort((a, z) => z[1] - a[1]);
  }, [units]);
  const status = statusLine(units);
  const art = catalogueArt(group.modelId, undefined, { category: group.category, name: group.name });
  const listId = `vin-${group.key.replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <motion.article layout variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[border-color,box-shadow] hover:border-blue-500/50 hover:shadow-md">
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art.thumb} alt="" className="hidden h-14 w-[88px] shrink-0 rounded-lg border border-line bg-canvas object-contain sm:block" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-5 tracking-tight text-fg">Yamaha {group.name}</h3>
          <Badge tone="accent" className="mt-1.5">
            {group.series}
          </Badge>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-center text-accent-fg shadow-sm">
          <span className="tabular block text-[17px] font-semibold leading-5">{units.length}</span>
          <span className="block text-[9.5px] font-medium uppercase leading-3 tracking-wider opacity-85">{units.length === 1 ? "Unit" : "Units"}</span>
        </span>
      </div>

      <div className="px-4">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">Colour breakdown</p>
        <ul className="space-y-1.5">
          {colours.map(([name, n]) => (
            <li key={name} className={cn("flex items-center gap-2.5 rounded-md px-1.5 py-0.5 text-[13px]", colourQuery && name.toLowerCase().includes(colourQuery) && "bg-tint")}>
              <ColourDot name={name} size={12} />
              <span className="flex-1 truncate text-fg">{name}</span>
              <span className="tabular font-semibold text-fg">
                {n} <span className="font-normal text-muted">{n === 1 ? "Unit" : "Units"}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-fg/[0.06]" aria-hidden>
          {colours.map(([name, n]) => (
            <span key={name} className="h-full border-r border-surface last:border-0" style={{ width: `${(n / units.length) * 100}%`, background: hexOf(name) }} />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 text-[12.5px]">
        {status.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-faint">•</span>}
            <span className={cn("tabular font-semibold", s.tone)}>{s.n}</span>
            <span className="text-muted">{s.label}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 border-t border-line px-4 py-2.5">
        <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={listId} leading={<ListTree className="h-3.5 w-3.5" />} trailing={<ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />} onClick={() => setOpen((o) => !o)} className="-ml-2">
          {open ? "Hide VIN / Chassis List" : "View VIN / Chassis List"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={listId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden border-t border-line bg-canvas/50">
            <ul className="divide-y divide-line">
              {units.map((u) => {
                const st = STATUS_UI[u.status];
                return (
                  <li key={u.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <StockThumb entry={u} size={40} />
                      <div className="min-w-0 flex-1 leading-4">
                        <p className="font-mono text-[12px] tracking-wide text-fg">{u.chassisNo}</p>
                        <p className="mt-1 font-mono text-[11px] tracking-wide text-muted">Engine {u.engineNo}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                          <ColourDot name={u.colour} size={9} /> {u.colour} · {u.variant}
                        </p>
                      </div>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </div>
                    <VehicleActions entry={u} compact />
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/** Dedicated model-wise stock view for one showroom. */
export function BranchStockView({ branchId }: { branchId: string }) {
  const b = useBranch(branchId)!;
  const me = useSessionEmployee();
  const hq = b.kind === "hq";
  const hydrated = useStock((s) => s.hydrated);
  const all = useStock((s) => s.entries);
  const mine = useMemo(() => all.filter((e) => e.branchId === branchId), [all, branchId]);

  const [scope, setScope] = useState<Scope>("all");
  const [q, setQ] = useState("");

  // Model cards are built from the live units at this showroom — there is no fixed model list.
  const groups = useMemo(() => groupByModel(mine), [mine]);
  const term = q.trim().toLowerCase();
  const visible = groups.filter((g) => (scope === "all" || g.category === scope) && (!term || `${g.name} ${g.short} ${g.series}`.toLowerCase().includes(term) || g.units.some((u) => u.colour.toLowerCase().includes(term))));

  const countOf = (c: Scope) => groups.filter((g) => c === "all" || g.category === c).reduce((n, g) => n + g.units.length, 0);
  const summary = statusLine(mine);

  if (me && !canAccess(me, branchId)) {
    return (
      <>
        <Link href="/stock" className="mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
          <ArrowLeft className="h-4 w-4" /> Back to All Showrooms
        </Link>
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="text-sm font-medium text-fg">You don&apos;t have access to this showroom</h1>
          <p className="mt-1 max-w-sm text-[13px] text-muted">Your account is set up for specific showrooms. Ask an Admin to add this one in Employees.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <Link href="/stock" className="mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
        <ArrowLeft className="h-4 w-4" /> Back to All Showrooms
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl border", hq ? "border-accent/30 bg-tint text-accent-text" : "border-line bg-canvas text-muted")}>{hq ? <Building2 className="h-5 w-5" /> : <Store className="h-5 w-5" />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-fg">{branchTitle(b)}</h1>
              {hq ? (
                <Badge tone="accent" className="bg-accent text-accent-fg ring-0">
                  Head Office
                </Badge>
              ) : (
                <Badge>Sub-Branch</Badge>
              )}
            </div>
            <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              {b.address}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-faint" /> {b.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-faint" /> {b.manager}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-accent/25 bg-tint px-5 py-3 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-accent-text">Total Active Units</p>
            <p className="tabular text-[32px] font-semibold leading-9 text-fg">{mine.length}</p>
            <p className="mt-0.5 flex justify-end gap-x-1.5 text-[11.5px] text-muted">
              {summary.map((s, i) => (
                <span key={s.label}>
                  {i > 0 && "• "}
                  {s.n} {s.label}
                </span>
              ))}
            </p>
          </div>
        </div>
      </Card>

      {!hydrated ? null : mine.length === 0 ? (
        <Card className="mt-5 flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
            <Bike className="h-5 w-5" />
          </span>
          <h2 className="text-sm font-medium text-fg">No stock at this showroom yet</h2>
          <p className="mt-1 max-w-sm text-[13px] text-muted">Vehicles added with Add Stock, or transferred here from another showroom, appear here grouped by model.</p>
          <Link href="/stock/add" className="mt-4">
            <Button variant="primary">Add stock</Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-4 mt-5 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by vehicle type">
              <Pill active={scope === "all"} onClick={() => setScope("all")}>
                All Models <span className="tabular opacity-70">{countOf("all")}</span>
              </Pill>
              <Pill active={scope === "Motorcycle"} onClick={() => setScope("Motorcycle")}>
                Motorcycles (MT / R15 / FZ) <span className="tabular opacity-70">{countOf("Motorcycle")}</span>
              </Pill>
              <Pill active={scope === "Scooter"} onClick={() => setScope("Scooter")}>
                Scooters (Aerox / RayZR / Fascino) <span className="tabular opacity-70">{countOf("Scooter")}</span>
              </Pill>
            </div>
            <div className="ml-auto w-full sm:w-72">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search model or colour…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search models or colours" />
            </div>
          </div>

          {visible.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
                <SearchX className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-fg">No models match</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setScope("all");
                  setQ("");
                }}
              >
                Clear filters
              </Button>
            </Card>
          ) : (
            <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((g) => (
                  <ModelCard key={g.key} group={g} colourQuery={term} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}
    </>
  );
}
