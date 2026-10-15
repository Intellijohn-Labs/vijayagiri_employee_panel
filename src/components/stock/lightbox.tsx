"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";

/** Full-screen photo viewer with arrow-key and Esc support. `index` null means closed. */
export function Lightbox({ images, index, caption, onChange, onClose }: { images: string[]; index: number | null; caption?: string; onChange: (i: number) => void; onClose: () => void }) {
  const open = index !== null && images.length > 0;
  useEffect(() => {
    if (!open) return;
    // Captured on window so Esc closes only the photo viewer — not a drawer or modal underneath it.
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") onChange(((index ?? 0) + 1) % images.length);
      else if (e.key === "ArrowLeft") onChange(((index ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open, index, images.length, onChange, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-[110] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo preview">
          <div className="absolute right-4 top-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="tabular rounded-full bg-white/10 px-2.5 py-1 text-xs text-white">
              {(index ?? 0) + 1} / {images.length}
            </span>
            <Button variant="ghost" iconOnly aria-label="Close preview" onClick={onClose} className="!text-white hover:!bg-white/15">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.img key={index} src={images[index ?? 0]} alt={caption ?? "Vehicle photo"} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1, transition: spring }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }} onClick={(e) => e.stopPropagation()} className="max-h-[84vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
          </AnimatePresence>
          {images.length > 1 && (
            <>
              <button aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); onChange(((index ?? 0) - 1 + images.length) % images.length); }} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-sky-400">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button aria-label="Next photo" onClick={(e) => { e.stopPropagation(); onChange(((index ?? 0) + 1) % images.length); }} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-sky-400">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          {caption && <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">{caption}</p>}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
