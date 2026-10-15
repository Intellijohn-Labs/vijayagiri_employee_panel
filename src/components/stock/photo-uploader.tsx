"use client";

import { useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Loader2, Maximize2, Star, Trash2, UploadCloud } from "lucide-react";
import { catalogueArt } from "@/lib/catalogue-art";
import { ACCEPTED_TYPES, processImage, validateImage } from "@/lib/images";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Lightbox } from "./lightbox";

export interface Photo {
  id: string;
  src: string;
  thumb: string;
  kind: "upload" | "catalogue";
}

export const MAX_PHOTOS = 6;
const newId = () => `ph_${Math.random().toString(36).slice(2, 9)}`;

export type ArtOpts = { category?: "Motorcycle" | "Scooter"; hex?: string; name?: string };

export function catalogueFor(modelId: string, colour?: string, opts?: ArtOpts): Photo {
  const a = catalogueArt(modelId, colour, opts);
  return { id: newId(), src: a.src, thumb: a.thumb, kind: "catalogue" };
}

interface Props {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  /** Selected model, for the catalogue-picture fallback */
  modelId: string;
  colour: string;
  caption: string;
  /** Model details for the catalogue picture when the model is not in the built-in list */
  artOpts?: ArtOpts;
}

/** Drag-and-drop photo upload with a live preview grid, primary-photo selection and a lightbox. */
export function PhotoUploader({ photos, onChange, modelId, colour, caption, artOpts }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);

  const uploads = photos.filter((p) => p.kind === "upload").length;

  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    const issues: string[] = [];
    // A catalogue picture is only a stand-in, so real photos replace it and don't count against the limit.
    const room = MAX_PHOTOS - uploads;
    const ok = files.filter((f) => {
      const m = validateImage(f);
      if (m) issues.push(m);
      return !m;
    });
    if (ok.length > room) issues.push(`Only ${MAX_PHOTOS} photos per vehicle — ${ok.length - room} not added`);
    const take = ok.slice(0, Math.max(0, room));
    setProblems(issues);
    if (!take.length) return;

    setBusy((n) => n + take.length);
    const done: Photo[] = [];
    await Promise.all(
      take.map(async (f) => {
        try {
          const { src, thumb } = await processImage(f);
          done.push({ id: newId(), src, thumb, kind: "upload" });
        } catch {
          issues.push(`${f.name}: couldn't be read as an image`);
        }
      }),
    );
    setBusy((n) => n - take.length);
    setProblems([...issues]);
    if (done.length) onChange([...photos.filter((p) => p.kind === "upload"), ...done]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  const makePrimary = (i: number) => onChange([photos[i], ...photos.filter((_, j) => j !== i)]);
  const remove = (i: number) => onChange(photos.filter((_, j) => j !== i));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-fg">
        <span>Vehicle photos / media</span>
        <span className="font-normal text-faint">
          Optional · {uploads} / {MAX_PHOTOS} uploaded
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload vehicle photos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-6 text-center outline-none transition-colors hover:border-blue-600 focus-visible:border-blue-600 dark:border-slate-700 dark:hover:border-blue-500 dark:focus-visible:border-blue-500",
          dragging && "border-blue-600 bg-tint dark:border-blue-500",
        )}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ""; }} />
        <motion.span animate={dragging ? { scale: 1.12, y: -3 } : { scale: 1, y: 0 }} transition={spring} className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-tint text-[#003399] dark:text-blue-400">
          <UploadCloud className="h-6 w-6" />
        </motion.span>
        <p className="mt-3 text-[13px] font-medium text-fg">Drag &amp; drop vehicle photos here, or click to browse</p>
        <p className="mt-1 text-xs text-muted">Supports JPG, PNG, WEBP up to 5 MB</p>
        <Badge tone="accent" className="mt-3">
          Upload front, side angle, or catalogue shot
        </Badge>
      </div>

      <AnimatePresence initial={false}>
        {problems.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-0.5 overflow-hidden pt-2 text-[11.5px] text-danger">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {(photos.length > 0 || busy > 0) && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence initial={false}>
            {photos.map((p, i) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-canvas shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={`${caption} — photo ${i + 1}`} className="h-full w-full object-cover" />
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {i === 0 && <Badge tone="accent" className="bg-accent text-accent-fg shadow ring-0">Primary Display Image</Badge>}
                  {p.kind === "catalogue" && <Badge className="bg-surface/90 shadow">Catalogue picture</Badge>}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                  <button type="button" onClick={() => setViewing(i)} aria-label="Full-screen preview" title="Full-screen preview" className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-800 outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-sky-400">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  {i > 0 && (
                    <button type="button" onClick={() => makePrimary(i)} aria-label="Make primary image" title="Make primary image" className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-slate-800 outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-sky-400">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => remove(i)} aria-label="Remove photo" title="Remove photo" className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-red-600 outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-sky-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.li>
            ))}
            {Array.from({ length: busy }, (_, i) => (
              <motion.li key={`busy-${i}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line bg-canvas">
                <Loader2 className="h-5 w-5 animate-spin text-faint" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {uploads === 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" disabled={!modelId} leading={<ImageIcon className="h-3.5 w-3.5" />} onClick={() => onChange([catalogueFor(modelId, colour, artOpts)])}>
            Use catalogue picture
          </Button>
          <span className="text-[11.5px] text-faint">{modelId ? "No photos handy? A drawn catalogue picture for this model is used until you upload real ones." : "Pick a model above to use a catalogue picture."}</span>
        </div>
      )}

      <Lightbox images={photos.map((p) => p.src)} index={viewing} caption={caption} onChange={setViewing} onClose={() => setViewing(null)} />
    </div>
  );
}
