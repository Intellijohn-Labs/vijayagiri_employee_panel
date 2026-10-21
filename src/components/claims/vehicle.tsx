"use client";

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

/** Registration number on an Indian-style plate. */
export function PlateBadge({ regNo, className }: { regNo: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-stretch overflow-hidden rounded-[5px] border border-slate-700/80 bg-white font-mono text-[11px] font-bold tracking-wider text-slate-900 shadow-sm", className)}>
      <span className="w-1.5 bg-[#003399]" aria-hidden />
      <span className="px-1.5 py-0.5">{regNo}</span>
    </span>
  );
}
