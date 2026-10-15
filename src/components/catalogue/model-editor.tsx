"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ExternalLink, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { useCatalogue, type CatalogueModel } from "@/store/catalogue-store";
import { toast } from "@/store/toast-store";
import { SPEC_FIELDS, emi, inr, minDownFor, type CatalogueInfo, type CataloguePhoto } from "@/lib/catalogue";
import { useSettings } from "@/store/settings-store";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/primitives";
import { GalleryEditor } from "./gallery-editor";

const MAX_BROCHURE = 15 * 1024 * 1024;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

const label = "mb-1.5 block text-xs font-medium text-fg";
const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v) || 0));

/** Editor for one model. Everything is staged locally until "Save catalogue" — Discard throws the changes away. */
export function ModelEditor({ entry, colours, onDirty }: { entry: CatalogueModel; colours: string[]; onDirty: (d: boolean) => void }) {
  const save = useCatalogue((s) => s.save);
  const [info, setInfo] = useState<CatalogueInfo>(entry.info);
  const [photos, setPhotos] = useState<CataloguePhoto[]>(entry.media?.photos ?? []);
  const [brochure, setBrochure] = useState(entry.media?.brochure);
  const [feature, setFeature] = useState("");
  const [dirty, setDirtyState] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const pdfRef = useRef<HTMLInputElement>(null);

  const touch = () => {
    setDirtyState(true);
    onDirty(true);
  };
  const edit = (patch: Partial<CatalogueInfo>) => {
    setInfo((i) => ({ ...i, ...patch }));
    touch();
  };

  const onRoad = info.exShowroom + info.rtoInsurance;
  const fin = useSettings((st) => st.settings.finance);
  const sampleDown = minDownFor(onRoad, fin.minDownPct);
  const sampleEmi = emi(Math.max(0, onRoad - sampleDown), fin.interest, fin.tenure);

  const addFeature = () => {
    const f = feature.trim();
    if (!f) return;
    if (info.features.some((x) => x.toLowerCase() === f.toLowerCase())) return void toast.info("Already listed");
    edit({ features: [...info.features, f] });
    setFeature("");
  };

  const pickBrochure = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return void toast.error("Brochure must be a PDF");
    if (file.size > MAX_BROCHURE) return void toast.error("Brochure is larger than 15 MB", "Compress the PDF and try again.");
    setBrochure({ name: file.name, size: file.size, blob: file });
    touch();
  };

  const view = () => {
    if (!brochure) return;
    const url = URL.createObjectURL(brochure.blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const submit = () => {
    if (!info.exShowroom) return void toast.error("Enter the ex-showroom price", "The showcase needs it to work out the on-road price and EMI.");
    if (!save(entry.model.id, info, { id: entry.model.id, photos, brochure })) return;
    setDirtyState(false);
    onDirty(false);
    toast.success(`${entry.model.name} catalogue saved`, "The customer showcase now shows these details.");
  };

  const discard = () => {
    setInfo(entry.info);
    setPhotos(entry.media?.photos ?? []);
    setBrochure(entry.media?.brochure);
    setFeature("");
    setDirtyState(false);
    onDirty(false);
    setResetKey((k) => k + 1);
  };

  return (
    <div className="space-y-5 pb-24" key={resetKey}>
      <Section title="Customer highlight" hint="One line shown under the model name in the showcase.">
        <Input value={info.tagline} onChange={(e) => edit({ tagline: e.target.value })} placeholder="e.g. The dark side of Japan." aria-label="Tagline" maxLength={90} />
      </Section>

      <Section title="Photo gallery" hint="Tag each photo with the colour it shows. Tapping a colour swatch in the showcase switches to that colour's photos.">
        <GalleryEditor
          modelId={entry.model.id}
          colours={colours}
          photos={photos}
          onChange={(p) => {
            setPhotos(p);
            touch();
          }}
        />
      </Section>

      <Section title="Key specifications" hint="Shown as bold cards on the customer's screen. Include the unit, e.g. “155 cc”. Starting values are indicative; check them against the official brochure.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SPEC_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className={label}>{f.label}</span>
              <Input value={info.specs[f.key]} onChange={(e) => edit({ specs: { ...info.specs, [f.key]: e.target.value } })} placeholder={f.placeholder} />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Key features" hint="Short bullet points, e.g. Traction Control, Quick Shifter, Y-Connect Bluetooth.">
        <div className="flex flex-wrap gap-2">
          {info.features.map((f) => (
            <motion.span key={f} layout transition={spring} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-hover py-1 pl-3 pr-1.5 text-[13px] text-fg">
              {f}
              <button type="button" onClick={() => edit({ features: info.features.filter((x) => x !== f) })} aria-label={`Remove ${f}`} className="grid h-5 w-5 place-items-center rounded-full text-muted outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-blue-500/40">
                <X className="h-3 w-3" />
              </button>
            </motion.span>
          ))}
          {info.features.length === 0 && <span className="text-[13px] text-muted">No features listed yet.</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <Input value={feature} onChange={(e) => setFeature(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} placeholder="Add a feature and press Enter" aria-label="New feature" className="max-w-md" />
          <Button type="button" leading={<Plus className="h-3.5 w-3.5" />} onClick={addFeature}>
            Add
          </Button>
        </div>
      </Section>

      <Section title="Pricing & EMI defaults" hint="Starting points for the customer's on-road price and EMI calculator.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className={label}>Ex-showroom price (₹)</span>
            <Input type="number" min={0} inputMode="numeric" value={info.exShowroom || ""} onChange={(e) => edit({ exShowroom: num(e.target.value) })} placeholder="168000" />
          </label>
          <label className="block">
            <span className={label}>RTO + insurance estimate (₹)</span>
            <Input type="number" min={0} inputMode="numeric" value={info.rtoInsurance || ""} onChange={(e) => edit({ rtoInsurance: num(e.target.value) })} placeholder="24000" />
          </label>
          <label className="block">
            <span className={label}>Base insurance, included (₹)</span>
            <Input type="number" min={0} inputMode="numeric" value={info.baseInsurance || ""} onChange={(e) => edit({ baseInsurance: num(e.target.value) })} placeholder="8000" />
            <span className="mt-1 block text-[11.5px] text-muted">1 yr own damage + 5 yr third party, inside the RTO + insurance estimate.</span>
          </label>
          <div>
            <span className={label}>On-road price (₹)</span>
            <p className="flex h-9 items-center rounded-lg border border-line bg-hover px-3 text-[13px] font-semibold tabular-nums text-fg">{inr(onRoad)}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-tint px-3 py-2.5 text-[13px] text-accent-text">
          Starting EMI: <strong className="tabular-nums">{inr(sampleEmi)}</strong> a month with {inr(sampleDown)} down ({fin.minDownPct}%) over {fin.tenure} months at {fin.interest}%. Interest rate, tenure, minimum down payment and financier schemes are set for the whole dealership in Settings → Finance &amp; EMI.
        </p>
      </Section>

      <Section title="Brochure (PDF)" hint="Optional. Customers and staff can open or download it from the showcase.">
        {brochure ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-hover/50 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-fg">{brochure.name}</p>
              <p className="text-xs text-muted">{(brochure.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <Button type="button" leading={<ExternalLink className="h-3.5 w-3.5" />} onClick={view}>
              View
            </Button>
            <Button type="button" onClick={() => pdfRef.current?.click()}>
              Replace
            </Button>
            <Button
              type="button"
              variant="danger"
              leading={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => {
                setBrochure(undefined);
                touch();
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button type="button" leading={<Upload className="h-3.5 w-3.5" />} onClick={() => pdfRef.current?.click()}>
            Upload brochure PDF
          </Button>
        )}
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="catalogue-brochure-input"
          onChange={(e) => {
            pickBrochure(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </Section>

      <motion.div initial={false} animate={{ y: dirty ? 0 : 90, opacity: dirty ? 1 : 0 }} transition={spring} className={cn("fixed bottom-4 left-1/2 z-30 flex w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-overlay px-4 py-3 shadow-pop", !dirty && "pointer-events-none")} aria-hidden={!dirty}>
        <span className="flex-1 text-[13px] font-medium text-fg">Unsaved changes to {entry.model.short}</span>
        <Button type="button" onClick={discard} tabIndex={dirty ? 0 : -1}>
          Discard
        </Button>
        <Button type="button" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]" onClick={submit} tabIndex={dirty ? 0 : -1}>
          Save catalogue
        </Button>
      </motion.div>
    </div>
  );
}
