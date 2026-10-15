"use client";

import { useState } from "react";
import { useColourHex, useStock, type StockEntry } from "@/store/stock-store";
import { entryMeta } from "@/lib/stock-groups";
import { catalogueArt } from "@/lib/catalogue-art";
import { cn } from "@/lib/utils";
import { Lightbox } from "./lightbox";

/** A vehicle's photos (or, with none uploaded, the drawn catalogue picture for its model and colour). */
export function useEntryImages(entry: StockEntry) {
  const hex = useColourHex();
  const set = useStock((s) => (entry.photoSetId ? s.photoSets[entry.photoSetId] : undefined));
  if (set) return { thumb: set.thumb, images: set.images, own: true };
  const meta = entryMeta(entry);
  const art = catalogueArt(entry.modelId, entry.colour, { category: meta.category, hex: hex(entry.colour), name: meta.name });
  return { thumb: art.thumb, images: [art.src], own: false };
}

/** The vehicle's primary photo as a small rounded thumbnail; click to view all of its photos. */
export function StockThumb({ entry, size = 40, className }: { entry: StockEntry; size?: number; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const caption = `${entry.modelName} · ${entry.variant} · ${entry.colour}`;
  const box = cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-canvas shadow-card", className);
  // No photo was uploaded for this vehicle: show the drawn catalogue picture for its model and colour.
  const { thumb, images } = useEntryImages(entry);
  return (
    <>
      <button type="button" onClick={() => setOpen(0)} aria-label={`View photos of ${caption}`} className={cn(box, "cursor-zoom-in outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent")} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" className="h-full w-full object-cover" />
      </button>
      <Lightbox images={images} index={open} caption={caption} onChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
