"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Lightbox } from "@/components/ui/overlay";
import type { Claim } from "@/lib/claims";
import { STOCK_MODELS, cleanModelName, modelKey } from "@/lib/stock-options";
import { catalogueArt } from "@/lib/catalogue-art";
import { cn } from "@/lib/utils";

const SCOOTER = /aerox|ray|fascino|scoot|jupiter|neo/i;
const cache = new Map<string, string>();

/** The drawn catalogue picture for a model typed as free text ("R15M", "MT-15 V2"); a generic bike or scooter when it isn't a known model. */
function artFor(model: string): string {
  const hit = cache.get(model);
  if (hit) return hit;
  const key = modelKey(model);
  const known =
    STOCK_MODELS.find((m) => modelKey(m.name) === key || modelKey(m.short) === key) ??
    STOCK_MODELS.find((m) => key.includes(modelKey(m.short)) || modelKey(m.name).includes(key));
  const category = known?.category ?? (SCOOTER.test(model) ? "Scooter" : "Motorcycle");
  const { thumb } = catalogueArt(known?.id ?? "", undefined, { category, name: known ? undefined : cleanModelName(model) });
  cache.set(model, thumb);
  return thumb;
}

/** A compact picture of the bike. The illustration's caption strip is cropped off so only the machine shows. */
export function BikeThumb({ model, className }: { model: string; className?: string }) {
  return (
    <span className={cn("relative block h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-gradient-to-b from-slate-50 to-slate-200 shadow-sm", className)}>
      {/* biome-ignore lint/performance/noImgElement: an inline SVG data URI, which next/image has nothing to optimise */}
      <img src={artFor(model)} alt="" width={64} height={44} draggable={false} className="absolute bottom-0 left-1/2 h-[128%] max-w-none -translate-x-1/2 select-none" />
    </span>
  );
}

/** An uploaded vehicle photo as a thumbnail that opens a larger preview. */
export function PhotoThumb({ src, label, className }: { src: string; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View photo: ${label}`}
        title="View photo"
        className={cn("group relative block h-11 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-line bg-slate-100 shadow-sm outline-none focus-visible:shadow-ring", className)}
      >
        {/* biome-ignore lint/performance/noImgElement: a data URL the user just uploaded, which next/image cannot optimise */}
        <img src={src} alt="" draggable={false} className="h-full w-full select-none object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-3.5 w-3.5 text-white" />
        </span>
      </button>
      <Lightbox open={open} onClose={() => setOpen(false)} src={src} title={label} />
    </>
  );
}

/** The claim's own check-in photo when it has one, else the catalogue picture for its model. */
export function ClaimThumb({ claim, className }: { claim: Pick<Claim, "vehicleImage" | "model" | "regNo">; className?: string }) {
  return claim.vehicleImage ? <PhotoThumb src={claim.vehicleImage} label={`${claim.model} ${claim.regNo}`.trim()} className={className} /> : <BikeThumb model={claim.model} className={className} />;
}

/** Registration number on an Indian-style plate. */
export function PlateBadge({ regNo, className }: { regNo: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-stretch overflow-hidden rounded-[5px] border border-slate-700/80 bg-white font-mono text-[11px] font-bold tracking-wider text-slate-900 shadow-sm", className)}>
      <span className="w-1.5 bg-[#003399]" aria-hidden />
      <span className="px-1.5 py-0.5">{regNo}</span>
    </span>
  );
}
