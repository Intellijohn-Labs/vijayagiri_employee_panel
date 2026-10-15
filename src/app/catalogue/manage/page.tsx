"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Image as ImageIcon, Lock, MonitorPlay, Plus, Search } from "lucide-react";
import { useCatalogue, useCatalogueModels } from "@/store/catalogue-store";
import { useIsAdmin, useSessionEmployee } from "@/store/employee-store";
import { useColourHex, useStock } from "@/store/stock-store";
import { toast } from "@/store/toast-store";
import { catalogueArt } from "@/lib/catalogue-art";
import { modelKey, type ModelOption } from "@/lib/stock-options";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card, Input, PageHeader } from "@/components/ui/primitives";
import { ModelEditor } from "@/components/catalogue/model-editor";

const selectCls = "h-9 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";

export default function CatalogueManagerPage() {
  const me = useSessionEmployee();
  const admin = useIsAdmin();
  const models = useCatalogueModels();
  const mediaLoaded = useCatalogue((s) => s.mediaLoaded);
  const registerOptions = useStock((s) => s.registerOptions);
  const hexOf = useColourHex();

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", series: "", category: "Motorcycle" as ModelOption["category"], price: "" });

  const current = models.find((m) => m.model.id === selected) ?? models[0];
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return models.filter((m) => !t || `${m.model.name} ${m.model.series}`.toLowerCase().includes(t));
  }, [models, q]);

  const choose = (id: string) => {
    if (id === current?.model.id) return;
    if (dirty && !window.confirm("Discard your unsaved changes to this model?")) return;
    setDirty(false);
    setSelected(id);
  };

  const create = () => {
    const name = draft.name.trim().replace(/^yamaha\s+/i, "").replace(/\s+/g, " ");
    const ex = Number(draft.price) || 0;
    if (!name) return void toast.error("Enter the model name");
    if (models.some((m) => modelKey(m.model.name) === modelKey(name))) return void toast.error("That model already exists", "Pick it from the list instead.");
    const id = `custom-${modelKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const model: ModelOption = { id, name, short: name.length > 14 ? `${name.slice(0, 13).trim()}…` : name, series: draft.series.trim() || "Custom Model", category: draft.category, variants: ["Standard"], colours: [], exShowroom: ex, onRoad: Math.round((ex * 1.14) / 500) * 500 };
    // Registering it here makes the model available in Add Stock as well.
    registerOptions({ model, modelId: id, variant: "Standard", colour: "" });
    setDraft({ name: "", series: "", category: "Motorcycle", price: "" });
    setAdding(false);
    setDirty(false);
    setSelected(id);
    toast.success(`${name} added`, "Upload its photos and specs, then save.");
  };

  if (me && !admin) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-sm font-medium text-fg">Catalogue Manager is for Admins only</h1>
        <p className="mt-1 text-[13px] text-muted">You can still show the catalogue to customers from Customer Showcase.</p>
        <Link href="/catalogue/explore" className="mt-4">
          <Button variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]" leading={<MonitorPlay className="h-3.5 w-3.5" />}>
            Open Customer Showcase
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Catalogue Manager"
        description="Upload model photos, specs, colours, pricing and brochures. Everything saved here appears in the Customer Showcase."
        actions={
          <Link href="/catalogue/explore">
            <Button leading={<MonitorPlay className="h-3.5 w-3.5" />}>Open Customer Showcase</Button>
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* models */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search models" />
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100dvh-20rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
            {list.map((m) => {
              const on = m.model.id === current?.model.id;
              const photo = m.media?.photos[0]?.thumb ?? catalogueArt(m.model.id, m.model.colours[0], { category: m.model.category, hex: hexOf(m.model.colours[0] ?? ""), name: m.model.name }).thumb;
              return (
                <li key={m.model.id} className="shrink-0 lg:shrink">
                  <button type="button" onClick={() => choose(m.model.id)} aria-current={on} className={cn("relative flex w-56 items-center gap-3 rounded-xl border p-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 lg:w-full", on ? "border-transparent" : "border-line bg-surface hover:bg-hover")}>
                    {on && <motion.span layoutId="cat-model" transition={spring} className="absolute inset-0 rounded-xl border border-[#003399]/40 bg-tint" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" className="relative h-11 w-14 shrink-0 rounded-md border border-line bg-canvas object-cover" />
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-fg">{m.model.name}</span>
                      <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                        <ImageIcon className="h-3 w-3" />
                        {m.media?.photos.length ?? 0}
                        {m.saved && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> saved
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length === 0 && <p className="mt-3 text-[13px] text-muted">No model matches “{q}”.</p>}

          <Button className="mt-3 w-full" leading={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            Add new model
          </Button>
          <AnimatePresence initial={false}>
            {adding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    create();
                  }}
                  className="mt-3 space-y-2.5 rounded-xl border border-line bg-surface p-3"
                >
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Model name, e.g. XSR 155" aria-label="New model name" autoFocus />
                  <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ModelOption["category"] })} className={selectCls} aria-label="Type">
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Scooter">Scooter</option>
                  </select>
                  <Input value={draft.series} onChange={(e) => setDraft({ ...draft, series: e.target.value })} placeholder="Series, e.g. XSR Neo-Retro" aria-label="Series" />
                  <Input type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Ex-showroom price (₹)" aria-label="Ex-showroom price" />
                  <Button type="submit" variant="primary" className="w-full bg-[#003399] text-white hover:bg-[#0047AB]">
                    Create model
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* editor */}
        <div className="min-w-0">
          {!mediaLoaded || !current ? (
            <div className="space-y-4" aria-busy>
              <div className="h-24 animate-pulse rounded-xl bg-hover" />
              <div className="h-64 animate-pulse rounded-xl bg-hover" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-lg font-bold tracking-tight text-fg">Yamaha {current.model.name}</h2>
                <span className="text-[13px] text-muted">
                  {current.model.series} · {current.model.category}
                </span>
              </div>
              <ModelEditor key={`${current.model.id}:${current.saved}`} entry={current} colours={current.model.colours} onDirty={setDirty} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
