"use client";

import { useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/lib/catalogue-gallery";

const slide = {
  enter: (d: number) => ({ x: d >= 0 ? "40%" : "-40%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d >= 0 ? "-40%" : "40%", opacity: 0 }),
};
const SWIPE = 70;

/** Full-width swipeable gallery: drag, tap the arrows, or use the thumbnails. Remount it (change `key`) to jump back to the first image. */
export function Carousel({ images, alt, note }: { images: GalleryImage[]; alt: string; note?: string }) {
  const [[index, dir], setPage] = useState<[number, number]>([0, 0]);
  const n = images.length;
  const i = Math.min(index, n - 1);
  const go = (d: number) => setPage(([p]) => [(p + d + n) % n, d]);
  const jump = (to: number) => setPage(([p]) => [to, to >= p ? 1 : -1]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE || info.velocity.x < -400) go(1);
    else if (info.offset.x > SWIPE || info.velocity.x > 400) go(-1);
  };

  return (
    <div>
      <div className="relative aspect-[4/3] touch-pan-y select-none overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-slate-50 to-slate-200 shadow-card dark:from-slate-800 dark:to-slate-900 md:aspect-[16/11]">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={images[i].src.slice(-40) + i}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag={n > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={onDragEnd}
            className="absolute inset-0 grid cursor-grab place-items-center active:cursor-grabbing"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[i].src} alt={`${alt} — ${images[i].label}`} draggable={false} className="h-full w-full object-contain" />
          </motion.div>
        </AnimatePresence>

        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white outline-none backdrop-blur transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white outline-none backdrop-blur transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
        <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">{note ?? images[i].label}</span>
        {n > 1 && (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium tabular-nums text-white backdrop-blur">
            {i + 1} / {n}
          </span>
        )}
      </div>

      {n > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
          {images.map((im, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Photo ${k + 1}: ${im.label}`} onClick={() => jump(k)} className={cn("h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-canvas outline-none transition-[border-color,opacity] focus-visible:ring-2 focus-visible:ring-blue-500", k === i ? "border-[#003399] dark:border-sky-400" : "border-transparent opacity-70 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.thumb} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
