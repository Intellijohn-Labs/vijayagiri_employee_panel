"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, CircleCheck, MapPin, PackagePlus, Plus, RotateCcw, Sparkles, Store } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useColourHex, useModelOptions, useStock, useVisibleEntries } from "@/store/stock-store";
import { toast } from "@/store/toast-store";
import { branchLabel, branchTitle } from "@/lib/branches";
import { useBranchTools } from "@/store/branch-store";
import { CUSTOM_COLOUR, CUSTOM_VARIANT, ENGINE_PATTERN, NEW_MODEL, STATUS_SHORT, STOCK_STATUSES, VIN_PATTERN, cleanModelName, modelKey, type ModelCategory, type ModelOption, type StockStatus } from "@/lib/stock-options";
import { cn, formatINR, todayISO } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/popover";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui/primitives";
import { PhotoUploader, catalogueFor, type ArtOpts, type Photo } from "@/components/stock/photo-uploader";
import { StockThumb } from "@/components/stock/stock-thumb";

const MAX_QTY = 20;

interface UnitIds {
  vin: string;
  engine: string;
}

const statusTone: Record<StockStatus, "accent" | "info" | "warn"> = {
  "In Stock / Yard Ready": "accent",
  "In Transit (From Factory / Plant)": "info",
  "Pre-Booked": "warn",
};

function StepHeader({ n, title, hint, done }: { n: number; title: string; hint?: string; done?: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors", done ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-muted")}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}</span>
      <div>
        <h2 className="text-[14px] font-semibold leading-5 text-fg">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function BranchOption({ id, selected, onSelect }: { id: string; selected: boolean; onSelect: () => void }) {
  const { byId: branchById } = useBranchTools();
  const b = branchById(id)!;
  const hq = b.kind === "hq";
  const Icon = hq ? Building2 : Store;
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      variants={fadeUp}
      whileTap={{ scale: 0.985 }}
      onClick={onSelect}
      className={cn("relative flex h-full w-full flex-col gap-2 rounded-xl border p-3.5 text-left outline-none transition-[border-color,background-color,box-shadow]", selected ? "border-accent/60 bg-tint shadow-ring" : "border-line bg-surface shadow-card hover:border-strong hover:bg-hover focus-visible:border-accent")}
    >
      <span className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", hq || selected ? "border-accent/30 bg-tint text-accent-text" : "border-line bg-canvas text-muted")}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-4 text-fg">{hq ? branchTitle(b) : branchLabel(b)}</span>
          <span className="mt-1 block text-[11.5px] text-muted">{hq ? "Head Office · Central Yard" : "Sub-Branch"}</span>
        </span>
        <motion.span initial={false} animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }} transition={spring} className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
          <Check className="h-3 w-3" strokeWidth={3} />
        </motion.span>
      </span>
      <span className="flex items-start gap-1.5 text-[11.5px] leading-4 text-faint">
        <MapPin className="mt-px h-3 w-3 shrink-0" />
        <span className="line-clamp-2">{b.address}</span>
      </span>
    </motion.button>
  );
}

export default function AddStockPage() {
  const { branches: BRANCHES, byId: branchById } = useBranchTools();
  const scope = useApp((s) => s.branchScope);
  // Duplicate frame / engine numbers are checked against every showroom; the "recently added" list shows only the ones this employee may see.
  const allEntries = useStock((s) => s.entries);
  const entries = useVisibleEntries();
  const addUnits = useStock((s) => s.add);

  // A single branch chosen in the top bar is a sensible starting point; "All Branches" leaves it open.
  const [picked, setBranchId] = useState<string | null>(null);
  const branchId = picked ?? (branchById(scope) ? scope : null);
  const models = useModelOptions();
  const hexOf = useColourHex();
  const registerOptions = useStock((s) => s.registerOptions);
  const [modelId, setModelId] = useState("");
  const [newModel, setNewModel] = useState<{ name: string; category: ModelCategory; series: string }>({ name: "", category: "Motorcycle", series: "" });
  const [variant, setVariant] = useState("");
  const [variantCustom, setVariantCustom] = useState(false);
  const [colour, setColour] = useState("");
  const [colourCustom, setColourCustom] = useState(false);
  const [colourPick, setColourPick] = useState("#1f4fa3");
  const [qty, setQty] = useState("1");
  const [units, setUnits] = useState<UnitIds[]>([{ vin: "", engine: "" }]);
  const [status, setStatus] = useState<StockStatus>(STOCK_STATUSES[0]);
  const [exShowroom, setExShowroom] = useState("");
  const [onRoad, setOnRoad] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [intakeDate, setIntakeDate] = useState(todayISO);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const branch = branchById(branchId);
  const isNew = modelId === NEW_MODEL;
  const model = models.find((m) => m.id === modelId);
  // A model typed into "Add New / Other Model" that already exists is merged into it, never duplicated.
  const typedKey = modelKey(newModel.name);
  const existingMatch = isNew && typedKey ? models.find((m) => modelKey(m.name) === typedKey) : undefined;
  const variantIsCustom = isNew || variantCustom;
  const colourIsCustom = isNew || colourCustom;
  const artFor = (over?: { category?: ModelCategory; name?: string; hex?: string }): ArtOpts => ({ category: over?.category ?? model?.category ?? newModel.category, name: over?.name ?? model?.name ?? (newModel.name.trim() || undefined), hex: over?.hex ?? (colourIsCustom ? colourPick : hexOf(colour)) });
  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));

  // A catalogue picture is just a stand-in, so it follows the model and colour as they change.
  const syncCatalogue = (mid: string, col: string, opts?: ArtOpts) => setPhotos((p) => (p.length === 1 && p[0].kind === "catalogue" ? [catalogueFor(mid, col, opts)] : p));

  const pickModel = (id: string) => {
    setModelId(id);
    // Variants and colours belong to one model, so they reset.
    setVariant("");
    setColour("");
    setVariantCustom(false);
    setColourCustom(false);
    setErrors((e) => ({ ...e, modelId: "", newName: "", variant: "", colour: "" }));
    if (id === NEW_MODEL) {
      setExShowroom("");
      setOnRoad("");
      syncCatalogue(id, "", { category: newModel.category, name: newModel.name.trim() || undefined });
      return;
    }
    const m = models.find((x) => x.id === id)!;
    // Reference prices follow the model.
    setExShowroom(m.exShowroom ? String(m.exShowroom) : "");
    setOnRoad(m.onRoad ? String(m.onRoad) : "");
    syncCatalogue(id, "", { category: m.category, name: m.name });
  };

  const changeQty = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setQty(digits);
    clear("qty");
    const n = Math.min(MAX_QTY, Math.max(1, Number(digits) || 1));
    setUnits((u) => Array.from({ length: n }, (_, i) => u[i] ?? { vin: "", engine: "" }));
  };
  const patchUnit = (i: number, patch: Partial<UnitIds>) => {
    setUnits((u) => u.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setErrors((e) => ({ ...e, [`vin${i}`]: "", [`engine${i}`]: "" }));
  };

  const reset = () => {
    setModelId("");
    setNewModel({ name: "", category: "Motorcycle", series: "" });
    setVariant("");
    setColour("");
    setVariantCustom(false);
    setColourCustom(false);
    setQty("1");
    setUnits([{ vin: "", engine: "" }]);
    setStatus(STOCK_STATUSES[0]);
    setExShowroom("");
    setOnRoad("");
    setPhotos([]);
    setIntakeDate(todayISO());
    setErrors({});
  };

  const submit = () => {
    if (busy || !branch || (!model && !isNew)) return;
    const e: Record<string, string> = {};
    const n = Number(qty);
    if (isNew && cleanModelName(newModel.name).length < 2) e.newName = "Enter the model name";
    if (!variant.trim()) e.variant = variantIsCustom ? "Enter the variant or edition" : "Choose a variant";
    if (!colour.trim()) e.colour = colourIsCustom ? "Enter the colour name" : "Choose a colour";
    if (!Number.isInteger(n) || n < 1 || n > MAX_QTY) e.qty = `Enter a whole number from 1 to ${MAX_QTY}`;
    if (!intakeDate) e.intakeDate = "Pick the intake date";
    const ex = exShowroom ? Number(exShowroom) : null;
    const road = onRoad ? Number(onRoad) : null;
    if (ex !== null && road !== null && road < ex) e.onRoad = "On-road price can't be below ex-showroom";

    const known = new Set(allEntries.flatMap((x) => [x.chassisNo, `E:${x.engineNo}`]));
    const seen = new Set<string>();
    units.slice(0, n).forEach((u, i) => {
      const vin = u.vin.trim().toUpperCase();
      const eng = u.engine.trim().toUpperCase();
      if (!VIN_PATTERN.test(vin)) e[`vin${i}`] = "17 characters, letters and digits only (no I, O or Q)";
      else if (known.has(vin)) e[`vin${i}`] = "This frame number is already in stock";
      else if (seen.has(vin)) e[`vin${i}`] = "Duplicate of another unit in this entry";
      if (!ENGINE_PATTERN.test(eng)) e[`engine${i}`] = "6–17 characters, letters and digits only";
      else if (known.has(`E:${eng}`)) e[`engine${i}`] = "This engine number is already in stock";
      else if (seen.has(`E:${eng}`)) e[`engine${i}`] = "Duplicate of another unit in this entry";
      seen.add(vin);
      seen.add(`E:${eng}`);
    });
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    setBusy(true);
    setTimeout(() => {
      const v = variant.trim();
      const c = colour.trim();
      const ex2 = ex ?? 0;
      const road2 = road ?? 0;
      // Resolve the model this stock belongs to: the chosen one, an existing one the typed name matches, or a brand new one.
      let target: ModelOption | undefined = isNew ? existingMatch : model;
      let created: ModelOption | undefined;
      if (!target) {
        const name = cleanModelName(newModel.name);
        created = target = {
          id: `custom-${modelKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
          name,
          short: name.length > 14 ? `${name.slice(0, 13).trim()}…` : name,
          series: newModel.series.trim() || "Custom Model",
          category: newModel.category,
          variants: [v],
          colours: [c],
          exShowroom: ex2,
          onRoad: road2,
        };
      }
      const usedHex = colourIsCustom ? colourPick : undefined;
      registerOptions({ model: created, modelId: target.id, variant: v, colour: c, colourHex: usedHex });
      addUnits(
        units.slice(0, n).map((u) => ({ branchId: branch.id, modelId: target.id, modelName: target.name, category: target.category, series: target.series, short: target.short, variant: v, colour: c, chassisNo: u.vin.trim().toUpperCase(), engineNo: u.engine.trim().toUpperCase(), status, exShowroom: ex, onRoad: road, intakeDate })),
        photos.length ? { images: photos.map((p) => p.src), thumb: photos[0].thumb, catalogue: photos.every((p) => p.kind === "catalogue") } : null,
      );
      toast.success(`${n} ${n === 1 ? "unit" : "units"} added to ${branch.kind === "hq" ? "Head Office" : branch.short}`, `${created ? `New model “${target.name}” created. ` : ""}${target.name} · ${v} · ${c} — ${STATUS_SHORT[status]}`);
      reset();
      setBusy(false);
    }, 450);
  };

  const recent = useMemo(() => entries.slice(0, 8), [entries]);
  const unitCount = Math.min(MAX_QTY, Math.max(1, Number(qty) || 1));

  return (
    <>
      <PageHeader title="Add Stock" description="Take new Yamaha two-wheelers into a showroom: pick the location, then enter the vehicle details." />

      <div className="max-w-5xl space-y-6">
        {/* Step 1 */}
        <section>
          <StepHeader n={1} title="Select target showroom" hint="Where is this stock being received?" done={!!branch} />
          <motion.div variants={stagger(0.05)} initial="hidden" animate="show" role="radiogroup" aria-label="Target showroom" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BRANCHES.map((b) => (
              <BranchOption
                key={b.id}
                id={b.id}
                selected={branchId === b.id}
                onSelect={() => {
                  setBranchId(b.id);
                }}
              />
            ))}
          </motion.div>
          <AnimatePresence initial={false}>
            {branch && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-accent/25 bg-tint px-4 py-3">
                  {branch.kind === "hq" ? (
                    <Badge tone="accent" className="bg-accent text-accent-fg ring-0">
                      Head Office &amp; Central Yard
                    </Badge>
                  ) : (
                    <Badge tone="accent">Sub-Branch</Badge>
                  )}
                  <span className="text-[13px] font-medium text-fg">{branchLabel(branch)}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-faint" />
                    {branch.address}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Step 2 */}
        <AnimatePresence initial={false}>
          {branch && (
            <motion.section key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: spring }} exit={{ opacity: 0, y: 8 }}>
              <StepHeader n={2} title="Vehicle intake" hint="Yamaha two-wheelers only. Each unit needs its own frame and engine number." />
              <Card className="p-5">
                <form
                  noValidate
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    submit();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Vehicle model" required error={errors.modelId}>
                      <div className="[&>div]:flex [&>div]:w-full">
                        <Select
                          value={modelId || null}
                          onChange={pickModel}
                          placeholder="Select a model"
                          searchable
                          options={[
                            ...models.map((m) => ({ value: m.id, label: m.name, hint: m.id.startsWith("custom-") ? "Custom" : m.category })),
                            { value: NEW_MODEL, label: "+ Add New / Other Model", icon: <Plus className="h-3.5 w-3.5 text-accent-text" /> },
                          ]}
                        />
                      </div>
                    </Field>

                    <Field label="Variant / Edition" required error={errors.variant}>
                      {variantIsCustom ? (
                        <Input value={variant} invalid={!!errors.variant} onChange={(e) => { setVariant(e.target.value); clear("variant"); }} placeholder="e.g. Standard, Deluxe, Moto GP Edition" />
                      ) : (
                        <div className="[&>div]:flex [&>div]:w-full">
                          <Select
                            value={variantCustom ? CUSTOM_VARIANT : variant || null}
                            disabled={!model}
                            placeholder={model ? "Select a variant" : "Pick a model first"}
                            invalid={!!errors.variant}
                            onChange={(v) => {
                              clear("variant");
                              if (v === CUSTOM_VARIANT) {
                                setVariantCustom(true);
                                setVariant("");
                              } else setVariant(v);
                            }}
                            options={[...(model?.variants ?? []).map((v) => ({ value: v, label: v })), { value: CUSTOM_VARIANT, label: "+ Custom variant…", icon: <Plus className="h-3.5 w-3.5 text-accent-text" /> }]}
                          />
                        </div>
                      )}
                      {!isNew && variantCustom && (
                        <button type="button" onClick={() => { setVariantCustom(false); setVariant(""); }} className="mt-1 text-[11.5px] text-accent-text hover:underline">
                          ← Pick from the list instead
                        </button>
                      )}
                    </Field>

                    <Field label="Colour" required error={errors.colour}>
                      {colourIsCustom ? (
                        <div className="flex items-center gap-2">
                          <input type="color" value={colourPick} onChange={(e) => { setColourPick(e.target.value); syncCatalogue(modelId, colour, artFor({ hex: e.target.value })); }} aria-label="Pick the colour swatch" className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-0.5" />
                          <div className="min-w-0 flex-1">
                            <Input value={colour} invalid={!!errors.colour} onChange={(e) => { setColour(e.target.value); clear("colour"); syncCatalogue(modelId, e.target.value, artFor({ hex: colourPick })); }} placeholder="Colour name, e.g. Midnight Teal" />
                          </div>
                        </div>
                      ) : (
                        <div className="[&>div]:flex [&>div]:w-full">
                          <Select
                            value={colourCustom ? CUSTOM_COLOUR : colour || null}
                            disabled={!model}
                            placeholder={model ? "Select a colour" : "Pick a model first"}
                            invalid={!!errors.colour}
                            onChange={(v) => {
                              clear("colour");
                              if (v === CUSTOM_COLOUR) {
                                setColourCustom(true);
                                setColour("");
                              } else {
                                setColour(v);
                                syncCatalogue(modelId, v, artFor({ hex: hexOf(v) }));
                              }
                            }}
                            options={[...(model?.colours ?? []).map((c) => ({ value: c, label: c, icon: <span className="h-3 w-3 rounded-full ring-1 ring-inset ring-fg/20" style={{ background: hexOf(c) }} /> })), { value: CUSTOM_COLOUR, label: "+ Custom colour…", icon: <Plus className="h-3.5 w-3.5 text-accent-text" /> }]}
                          />
                        </div>
                      )}
                      {!isNew && colourCustom && (
                        <button type="button" onClick={() => { setColourCustom(false); setColour(""); }} className="mt-1 text-[11.5px] text-accent-text hover:underline">
                          ← Pick from the list instead
                        </button>
                      )}
                    </Field>

                    {isNew && (
                      <div className="rounded-xl border border-accent/30 bg-tint p-4 sm:col-span-2 lg:col-span-3">
                        <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-accent-text">
                          <Sparkles className="h-4 w-4" /> New model
                          <span className="font-normal text-muted">— a card for it appears in All Stock as soon as you save</span>
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Model name" required error={errors.newName}>
                            <Input data-autofocus value={newModel.name} invalid={!!errors.newName} onChange={(e) => { setNewModel((m) => ({ ...m, name: e.target.value })); clear("newName"); syncCatalogue(modelId, colour, { category: newModel.category, name: e.target.value.trim() || undefined, hex: colourPick }); }} placeholder="e.g. Yamaha XSR 155" />
                          </Field>
                          <Field label="Type">
                            <div className="[&>div]:flex [&>div]:w-full">
                              <Select<ModelCategory> value={newModel.category} onChange={(v) => { setNewModel((m) => ({ ...m, category: v })); syncCatalogue(modelId, colour, { category: v, name: newModel.name.trim() || undefined, hex: colourPick }); }} options={[{ value: "Motorcycle", label: "Motorcycle" }, { value: "Scooter", label: "Scooter (incl. electric)" }]} />
                            </div>
                          </Field>
                          <Field label="Series / segment" hint="Optional">
                            <Input value={newModel.series} onChange={(e) => setNewModel((m) => ({ ...m, series: e.target.value }))} placeholder="e.g. Neo-retro, Adventure, Electric" />
                          </Field>
                        </div>
                        {existingMatch && <p className="mt-3 text-[12px] text-accent-text">“{existingMatch.name}” is already in the catalogue — these units will be added to it, not duplicated.</p>}
                      </div>
                    )}

                    <Field label="Stock quantity (units)" required error={errors.qty} hint={`Max ${MAX_QTY}`}>
                      <Input value={qty} onChange={(e) => changeQty(e.target.value)} invalid={!!errors.qty} inputMode="numeric" placeholder="1" />
                    </Field>
                    <Field label="Intake date" required error={errors.intakeDate}>
                      <Input type="date" value={intakeDate} onChange={(e) => { setIntakeDate(e.target.value); clear("intakeDate"); }} invalid={!!errors.intakeDate} />
                    </Field>
                  </div>

                  {/* status */}
                  <div className="mt-5">
                    <p className="mb-1.5 text-xs font-medium text-fg">Stock status</p>
                    <div role="radiogroup" aria-label="Stock status" className="grid gap-2 sm:grid-cols-3">
                      {STOCK_STATUSES.map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] outline-none transition-colors", status === s ? "border-accent/60 bg-tint font-medium text-accent-text shadow-ring" : "border-line bg-surface text-muted hover:border-strong hover:text-fg focus-visible:border-accent")}>
                          <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", status === s ? "border-accent bg-accent text-accent-fg" : "border-strong")}>{status === s && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}</span>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* per-unit identifiers */}
                  <div className="mt-5">
                    <p className="mb-1.5 flex items-center justify-between text-xs font-medium text-fg">
                      <span>Frame &amp; engine numbers</span>
                      <span className="font-normal text-faint">
                        {unitCount} {unitCount === 1 ? "unit" : "units"}
                      </span>
                    </p>
                    <motion.ul layout className="space-y-3">
                      <AnimatePresence initial={false}>
                        {units.slice(0, unitCount).map((u, i) => (
                          <motion.li key={i} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring} className="grid gap-3 rounded-lg border border-line bg-canvas/50 p-3 sm:grid-cols-[1.4fr_1fr]">
                            <Field label={unitCount > 1 ? `Unit ${i + 1} · Chassis VIN` : "Engine / Frame number (Chassis VIN)"} required error={errors[`vin${i}`]} hint={`${u.vin.length}/17`}>
                              <Input value={u.vin} onChange={(e) => patchUnit(i, { vin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17) })} invalid={!!errors[`vin${i}`]} placeholder="ME1RG1234P1234567" spellCheck={false} autoComplete="off" className="font-mono uppercase tracking-wider" />
                            </Field>
                            <Field label={unitCount > 1 ? `Unit ${i + 1} · Engine number` : "Engine number"} required error={errors[`engine${i}`]}>
                              <Input value={u.engine} onChange={(e) => patchUnit(i, { engine: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17) })} invalid={!!errors[`engine${i}`]} placeholder="G3E1E0012345" spellCheck={false} autoComplete="off" className="font-mono uppercase tracking-wider" />
                            </Field>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  </div>

                  {/* reference prices */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Ex-showroom price (₹)" hint="Optional · reference">
                      <Input value={exShowroom} onChange={(e) => setExShowroom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 182000" />
                    </Field>
                    <Field label="Approx. on-road price (₹)" hint="Optional · reference" error={errors.onRoad}>
                      <Input value={onRoad} onChange={(e) => { setOnRoad(e.target.value.replace(/\D/g, "")); clear("onRoad"); }} invalid={!!errors.onRoad} inputMode="numeric" placeholder="e.g. 207500" />
                    </Field>
                  </div>
                  {model && model.exShowroom > 0 && <p className="mt-1.5 text-[11.5px] text-faint">Prices are pre-filled with an indicative reference for the {model.name} and can be edited. Check them against the current Yamaha price list.</p>}

                  <div className="mt-5">
                    <PhotoUploader photos={photos} onChange={setPhotos} modelId={modelId} colour={colour} artOpts={artFor()} caption={model || newModel.name ? `${model?.name ?? newModel.name}${variant ? ` · ${variant}` : ""}${colour ? ` · ${colour}` : ""}` : "Vehicle"} />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                    <Button type="button" variant="ghost" leading={<RotateCcw className="h-3.5 w-3.5" />} onClick={reset}>
                      Reset form
                    </Button>
                    <Button type="submit" variant="primary" size="lg" loading={busy} leading={<PackagePlus className="h-4 w-4" />}>
                      Add {unitCount} {unitCount === 1 ? "unit" : "units"} to stock
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Recently added */}
        {recent.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: spring }}>
            <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-fg">
              <CircleCheck className="h-4 w-4 text-accent-text" /> Recently added
            </h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-medium uppercase tracking-wider text-faint">
                      <th className="px-4 py-2.5 font-medium">Vehicle</th>
                      <th className="px-3 py-2.5 font-medium">Showroom</th>
                      <th className="px-3 py-2.5 font-medium">Frame / Engine no.</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 text-right font-medium">On-road ref.</th>
                      <th className="px-4 py-2.5 text-right font-medium">Intake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((u) => (
                      <tr key={u.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <StockThumb entry={u} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-fg">{u.modelName}</p>
                              <p className="text-[11.5px] text-muted">
                                {u.variant} · {u.colour}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[13px] text-fg">{branchById(u.branchId)?.short}</td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] leading-4 tracking-wide text-muted">
                          {u.chassisNo}
                          <br />
                          {u.engineNo}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={statusTone[u.status]} dot>
                            {STATUS_SHORT[u.status]}
                          </Badge>
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-[13px] text-muted">{u.onRoad ? formatINR(u.onRoad) : "—"}</td>
                        <td className="tabular px-4 py-2.5 text-right text-xs text-muted">{new Date(u.intakeDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.section>
        )}
      </div>
    </>
  );
}
