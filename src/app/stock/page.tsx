"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Boxes, Building2, CheckCircle2, ChevronLeft, ChevronRight, Filter, Layers, PackagePlus, Search, SearchX, Sparkles, Store, Trash2, Trophy, Truck } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useColourHex, useStock, useVisibleEntries, type StockEntry } from "@/store/stock-store";
import { branchPick, branchTitle } from "@/lib/branches";
import { useBranchTools } from "@/store/branch-store";
import { BOOKED, IN_STOCK, STATUS_UI, TRANSIT, type StockStatus } from "@/lib/stock-options";
import { groupByModel } from "@/lib/stock-groups";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/popover";
import { Tabs } from "@/components/ui/tabs";
import { Badge, Card, Input, PageHeader } from "@/components/ui/primitives";
import { StockThumb } from "@/components/stock/stock-thumb";

const PAGE_SIZE = 12;
type View = "table" | "matrix";
type StatusFilter = "all" | StockStatus;

const SEGMENT_TONES = ["bg-[#003399]", "bg-blue-500", "bg-sky-400", "bg-indigo-400", "bg-cyan-500", "bg-slate-400", "bg-blue-300"];

function Metric({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="h-full p-4">
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <span className={cn("grid h-6 w-6 place-items-center rounded-md border", accent ? "border-accent/30 bg-tint text-accent-text" : "border-line bg-canvas text-muted")}>{icon}</span>
          {label}
        </span>
        <p className="tabular mt-3 text-[26px] font-semibold leading-8 tracking-tight text-fg">{value}</p>
        {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
      </Card>
    </motion.div>
  );
}

function BranchCard({ id, entries, active, onToggle, onOpen }: { id: string; entries: StockEntry[]; active: boolean; onToggle: () => void; onOpen: () => void }) {
  const { byId: branchById } = useBranchTools();
  const b = branchById(id)!;
  const hq = b.kind === "hq";
  const total = entries.length;
  // Mix bar and legend come from this showroom's units, grouped by model as they are found.
  const byModel = useMemo(() => groupByModel(entries), [entries]);
  const avail = entries.filter((e) => e.status === IN_STOCK).length;
  const booked = entries.filter((e) => e.status === BOOKED).length;
  const transit = entries.filter((e) => e.status === TRANSIT).length;

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4 }} transition={spring} className="h-full">
      <Card className={cn("group flex h-full cursor-pointer flex-col p-4 transition-all hover:border-blue-500 hover:shadow-xl", active && "border-accent/60 bg-tint shadow-ring")}>
        <div role="button" tabIndex={0} aria-label={`Open model-wise stock for ${branchTitle(b)}`} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }} className="flex flex-1 cursor-pointer flex-col rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <div className="flex items-start gap-3">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", hq ? "border-accent/30 bg-tint text-accent-text" : "border-line bg-canvas text-muted")}>{hq ? <Building2 className="h-4 w-4" /> : <Store className="h-4 w-4" />}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13.5px] font-semibold leading-4 text-fg">{branchTitle(b)}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge>{hq ? "Head Office" : b.city}</Badge>
              {hq && <Badge tone="accent">Main Hub</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="tabular text-[28px] font-semibold leading-8 tracking-tight text-fg">{total}</span>
          <span className="text-xs text-muted">{total === 1 ? "unit" : "units"}</span>
          <span className="ml-auto text-[11px] text-faint">
            {avail} available · {booked} booked · {transit} in transit
          </span>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-fg/[0.06]" role="img" aria-label="Model mix">
          {byModel.map((g, i) => (
            <motion.span key={g.key} initial={{ width: 0 }} animate={{ width: `${(g.units.length / Math.max(total, 1)) * 100}%` }} transition={{ ...spring, delay: 0.1 + i * 0.04 }} className={cn("h-full border-r border-surface last:border-0", SEGMENT_TONES[i % SEGMENT_TONES.length])} title={`${g.short}: ${g.units.length}`} />
          ))}
        </div>
        <p className="mt-2 min-h-[32px] text-[11.5px] leading-4 text-muted">
          {byModel.length === 0 ? (
            <span className="text-faint">No stock recorded here yet</span>
          ) : (
            <>
              {byModel.slice(0, 4).map((g, i) => (
                <span key={g.key}>
                  {i > 0 && " · "}
                  <span className="text-fg">{g.short}</span>: {g.units.length}
                </span>
              ))}
              {byModel.length > 4 && <span className="text-faint"> · +{byModel.length - 4} more</span>}
            </>
          )}
        </p>

        <div className="mt-auto pt-3">
          <Button size="sm" variant={active ? "primary" : "secondary"} className="w-full" leading={<Filter className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-pressed={active}>
            {active ? "Filtering by this branch" : "Filter by this branch"}
          </Button>
        </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function AllStockPage() {
  const hexOf = useColourHex();
  const { branches: BRANCHES, byId: branchById } = useBranchTools();
  const scope = useApp((s) => s.branchScope);
  const hydrated = useStock((s) => s.hydrated);
  // Only the showrooms this employee may see feed every number and table on the page.
  const entries = useVisibleEntries();
  const loadSample = useStock((s) => s.loadSample);
  const clearSample = useStock((s) => s.clearSample);
  const tableRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<View>("table");
  const [q, setQ] = useState("");
  // The branch picked in the top bar is the starting filter; picking one here overrides it.
  const [picked, setPicked] = useState<string | null>(null);
  const branchFilter = picked ?? (branchById(scope) ? scope : "all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const router = useRouter();

  const hasSample = entries.some((e) => e.sample);

  /* ───── network-wide numbers ───── */
  const totals = useMemo(() => {
    const avail = entries.filter((e) => e.status === IN_STOCK);
    const topMap = new Map<string, number>();
    for (const e of avail) topMap.set(e.modelName, (topMap.get(e.modelName) ?? 0) + 1);
    const top = [...topMap.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total: entries.length, avail: avail.length, booked: entries.filter((e) => e.status === BOOKED).length, transit: entries.filter((e) => e.status === TRANSIT).length, top };
  }, [entries]);

  const byBranch = useMemo(() => {
    const m = new Map<string, StockEntry[]>(BRANCHES.map((b) => [b.id, []]));
    for (const e of entries) m.get(e.branchId)?.push(e);
    return m;
  }, [entries, BRANCHES]);

  /* ───── table data ───── */
  const textMatches = useMemo(() => {
    const term = q.trim().toLowerCase();
    return entries.filter((e) => (status === "all" || e.status === status) && (!term || `${e.modelName} ${e.variant} ${e.colour} ${e.chassisNo} ${e.engineNo}`.toLowerCase().includes(term)));
  }, [entries, q, status]);
  const filtered = useMemo(() => textMatches.filter((e) => branchFilter === "all" || e.branchId === branchFilter).sort((a, b) => (a.intakeDate < b.intakeDate ? 1 : a.intakeDate > b.intakeDate ? -1 : b.createdAt - a.createdAt)), [textMatches, branchFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const anyFilter = !!(q || status !== "all" || branchFilter !== "all");
  const reset = () => {
    setQ("");
    setStatus("all");
    setPicked("all");
    setPage(0);
  };
  const focusBranch = (id: string) => {
    setPicked(branchFilter === id ? "all" : id);
    setView("table");
    setPage(0);
    if (branchFilter !== id) setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  /* ───── matrix data ───── */
  const matrix = useMemo(() => {
    // One row per model found in the (search- and status-filtered) inventory; a new model gets a row by existing.
    const rows = groupByModel(textMatches);
    const cell = new Map<string, number>();
    for (const g of rows) for (const u of g.units) cell.set(`${g.key}|${u.branchId}`, (cell.get(`${g.key}|${u.branchId}`) ?? 0) + 1);
    const max = Math.max(1, ...cell.values());
    return { rows, cell, max };
  }, [textMatches]);

  const header = (
    <PageHeader
      title="All Stock"
      description="Yamaha stock across Head Office and all five sub-branches, with a breakdown for each showroom."
      actions={
        <Link href="/stock/add">
          <Button variant="primary" leading={<PackagePlus className="h-3.5 w-3.5" />}>
            + Add New Stock
          </Button>
        </Link>
      }
    />
  );

  if (!hydrated) return header;

  if (entries.length === 0) {
    return (
      <>
        {header}
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-hover text-muted">
            <Boxes className="h-5 w-5" />
          </span>
          <h2 className="text-[15px] font-semibold text-fg">No stock recorded yet</h2>
          <p className="mt-1 max-w-md text-[13px] text-muted">Stock you take in through Add Stock shows up here, with live counts for every showroom. You can also load a set of sample vehicles to explore the page.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/stock/add">
              <Button variant="primary" leading={<PackagePlus className="h-3.5 w-3.5" />}>
                Add stock
              </Button>
            </Link>
            <Button leading={<Sparkles className="h-3.5 w-3.5" />} onClick={loadSample}>
              Load sample stock
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}

      {hasSample && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-tint px-4 py-2.5 text-[13px] text-accent-text">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="flex-1">Sample vehicles are loaded so you can explore this page. They are demo data, not real stock.</span>
          <Button size="sm" leading={<Trash2 className="h-3.5 w-3.5" />} onClick={clearSample}>
            Remove sample data
          </Button>
        </div>
      )}

      {/* network overview */}
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric accent icon={<Layers className="h-3.5 w-3.5" />} label="Total Network Stock" value={<>{totals.total} <span className="text-sm font-normal text-muted">Units</span></>} hint={`Across all ${BRANCHES.length} showrooms`} />
        <Metric icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Available for Sale" value={totals.avail} hint="In showroom yards, ready for booking" />
        <Metric icon={<Truck className="h-3.5 w-3.5" />} label="Booked / In Transit" value={<>{totals.booked + totals.transit}</>} hint={`${totals.booked} booked · ${totals.transit} en route from plant`} />
        <Metric icon={<Trophy className="h-3.5 w-3.5" />} label="Top In-Stock Model" value={totals.top ? <span className="text-[19px]">{totals.top[0]}</span> : "—"} hint={totals.top ? `${totals.top[1]} units available` : "No units available yet"} />
      </motion.div>

      {/* branch breakdown */}
      <h2 className="mb-3 mt-7 text-[14px] font-semibold text-fg">Stock by showroom</h2>
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BRANCHES.map((b) => (
          <BranchCard key={b.id} id={b.id} entries={byBranch.get(b.id) ?? []} active={branchFilter === b.id} onToggle={() => focusBranch(b.id)} onOpen={() => router.push(`/stock/${b.id}`)} />
        ))}
      </motion.div>

      {/* table + matrix */}
      <div ref={tableRef} className="mt-7 scroll-mt-20">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                id="stock-view"
                value={view}
                onChange={(v) => setView(v)}
                items={[
                  { value: "table", label: "Stock Table", count: filtered.length },
                  { value: "matrix", label: "Model Matrix" },
                ]}
              />
              <div className="ml-auto w-full sm:w-72">
                <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search model, chassis / VIN or colour…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search stock" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-64 [&>div]:flex [&>div]:w-full">
                <Select
                  value={branchFilter}
                  onChange={(v) => { setPicked(v); setPage(0); }}
                  leading={<Building2 className="h-3.5 w-3.5 text-faint" />}
                  options={[{ value: "all", label: "All Showrooms" }, ...BRANCHES.map((b) => ({ value: b.id, label: b.kind === "hq" ? `${b.city} HQ & Yard` : `${branchPick(b)} · ${b.name.replace(/\s*\(.*\)/, "")}` }))]}
                />
              </div>
              <div className="w-full sm:w-48 [&>div]:flex [&>div]:w-full">
                <Select<StatusFilter>
                  value={status}
                  onChange={(v) => { setStatus(v); setPage(0); }}
                  leading={<Filter className="h-3.5 w-3.5 text-faint" />}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: IN_STOCK, label: "In Stock" },
                    { value: BOOKED, label: "Booked" },
                    { value: TRANSIT, label: "In Transit" },
                  ]}
                />
              </div>
              {anyFilter && (
                <button onClick={reset} className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted hover:bg-hover hover:text-fg">
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {view === "table" ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wider text-faint">
                      <th className="px-4 py-2.5 font-medium">Vehicle</th>
                      <th className="px-3 py-2.5 font-medium">Colour / Graphics</th>
                      <th className="px-3 py-2.5 font-medium">Current Showroom</th>
                      <th className="px-3 py-2.5 font-medium">Chassis / Frame No.</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium">Intake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e, i) => {
                      const st = STATUS_UI[e.status];
                      return (
                        <motion.tr key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: { ...spring, delay: i * 0.02 } }} className="border-b border-line transition-colors last:border-0 hover:bg-hover">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <StockThumb entry={e} size={44} />
                              <div className="min-w-0 leading-4">
                                <p className="text-[13px] font-medium text-fg">{e.modelName}</p>
                                <p className="mt-0.5 text-[11.5px] text-muted">{e.variant}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-2 text-[13px] text-fg">
                              <span className="h-3 w-3 rounded-full ring-1 ring-inset ring-fg/20" style={{ background: hexOf(e.colour) }} aria-hidden />
                              {e.colour}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={branchById(e.branchId)?.kind === "hq" ? "accent" : "neutral"}>{branchById(e.branchId)?.short}</Badge>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] tracking-wide text-muted">{e.chassisNo}</td>
                          <td className="px-3 py-2.5">
                            <Badge tone={st.tone} dot>
                              {st.label}
                            </Badge>
                          </td>
                          <td className="tabular px-4 py-2.5 text-right text-xs text-muted">{new Date(e.intakeDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
                    <SearchX className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-fg">No vehicles match</p>
                  <p className="mt-1 text-[13px] text-muted">Try a different search, or clear the branch and status filters.</p>
                  <Button className="mt-4" onClick={reset}>
                    Reset filters
                  </Button>
                </div>
              )}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
                  <span className="tabular">
                    {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" iconOnly disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="tabular px-1">
                      {safePage + 1} / {pages}
                    </span>
                    <Button variant="ghost" size="sm" iconOnly disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wider text-faint">
                    <th className="px-4 py-2.5 font-medium">Model</th>
                    {BRANCHES.map((b) => (
                      <th key={b.id} className={cn("px-2 py-2.5 text-center font-medium", branchFilter === b.id && "text-accent-text")}>
                        {b.kind === "hq" ? "HQ" : b.short}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((g) => {
                    const total = g.units.length;
                    return (
                      <tr key={g.key} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="text-[13px] font-medium text-fg">{g.short}</p>
                          <p className="text-[11.5px] text-faint">{g.category}</p>
                        </td>
                        {BRANCHES.map((b) => {
                          const n = matrix.cell.get(`${g.key}|${b.id}`) ?? 0;
                          return (
                            <td key={b.id} className="p-1 text-center">
                              <button
                                disabled={!n}
                                onClick={() => {
                                  setPicked(b.id);
                                  setQ(g.name);
                                  setView("table");
                                  setPage(0);
                                }}
                                title={n ? `Show ${n} ${g.short} at ${b.short}` : undefined}
                                className={cn("tabular h-9 w-full min-w-[44px] rounded-md text-[13px] outline-none transition-colors", n ? "font-semibold text-fg hover:ring-2 hover:ring-accent/50 focus-visible:ring-2 focus-visible:ring-accent" : "text-faint/60")}
                                style={n ? { background: `color-mix(in srgb, rgb(var(--accent)) ${Math.round(10 + (n / matrix.max) * 40)}%, transparent)` } : undefined}
                              >
                                {n || "–"}
                              </button>
                            </td>
                          );
                        })}
                        <td className="tabular px-4 py-2.5 text-right text-[13px] font-semibold text-fg">{total}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-line bg-fg/[0.025]">
                    <td className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted">Total</td>
                    {BRANCHES.map((b) => (
                      <td key={b.id} className="tabular px-2 py-2.5 text-center text-[13px] font-semibold text-fg">
                        {matrix.rows.reduce((n, g) => n + (matrix.cell.get(`${g.key}|${b.id}`) ?? 0), 0)}
                      </td>
                    ))}
                    <td className="tabular px-4 py-2.5 text-right text-[13px] font-semibold text-accent-text">{textMatches.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <p className="mt-2 text-[11.5px] text-faint">
          Status wording: <span className="text-fg">Available</span> = In Stock / Yard Ready · <span className="text-fg">Booked</span> = Pre-Booked · <span className="text-fg">In Transit</span> = on the way from the plant.
        </p>
      </div>

    </>
  );
}
