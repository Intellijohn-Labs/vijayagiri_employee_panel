"use client";

import { useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftToLine, ImagePlus, Plus, Trash2, UploadCloud } from "lucide-react";
import { useColourHex, useStock } from "@/store/stock-store";
import { toast } from "@/store/toast-store";
import { PHOTO_KINDS, type CataloguePhoto, type PhotoKind } from "@/lib/catalogue";
import { ACCEPTED_TYPES, processImage, validateImage } from "@/lib/images";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS = 30;
const ALL = "__all__";
const selectCls = "h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";

/**
 * Photo gallery for one model. Every photo is tagged with the colour it shows (or "All colours") and a kind, so the
 * customer showcase can swap straight to the right pictures when a colour swatch is tapped.
 */
export function GalleryEditor({ modelId, colours, photos, onChange }: { modelId: string; colours: string[]; photos: CataloguePhoto[]; onChange: (p: CataloguePhoto[]) => void }) {
  const hexOf = useColourHex();
  const registerOptions = useStock((s) => s.registerOptions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [colour, setColour] = useState<string>(ALL);
  const [kind, setKind] = useState<PhotoKind>("hero");
  const [filter, setFilter] = useState<string>(ALL);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#1f4fa3");

  const upload = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    if (photos.length + list.length > MAX_PHOTOS) return void toast.error(`Up to ${MAX_PHOTOS} photos per model`, "Delete a few before adding more.");
    setBusy(true);
    const added: CataloguePhoto[] = [];
    for (const f of list) {
      const problem = validateImage(f, MAX_PHOTO_BYTES);
      if (problem) {
        toast.error("Photo skipped", problem);
        continue;
      }
      try {
        const { src, thumb } = await processImage(f, 1800);
        added.push({ id: `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, src, thumb, colour: colour === ALL ? null : colour, kind });
      } catch {
        toast.error("Couldn't read that photo", `${f.name} may be damaged.`);
      }
    }
    setBusy(false);
    if (added.length) {
      onChange([...photos, ...added]);
      toast.success(`${added.length} photo${added.length === 1 ? "" : "s"} added`, "Save the catalogue to keep them.");
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void upload(e.dataTransfer.files);
  };

  const patch = (id: string, p: Partial<CataloguePhoto>) => onChange(photos.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const makeFirst = (id: string) => onChange([...photos.filter((x) => x.id === id), ...photos.filter((x) => x.id !== id)]);

  const addColour = () => {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return void toast.error("Name the colour first");
    if (colours.some((c) => c.toLowerCase() === name.toLowerCase())) return void toast.info("That colour already exists");
    registerOptions({ modelId, variant: "", colour: name, colourHex: newHex });
    setColour(name);
    setNewName("");
    setAdding(false);
  };

  const shown = filter === ALL ? photos : filter === "__general__" ? photos.filter((p) => !p.colour) : photos.filter((p) => p.colour === filter);
  const count = (c: string | null) => photos.filter((p) => p.colour === c).length;

  return (
    <div>
      {/* where the next upload goes */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-fg">
          <span className="mb-1.5 block">Upload for colour</span>
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded-full border border-line" style={{ background: colour === ALL ? "conic-gradient(#1f4fa3,#c4202e,#1b1d21,#b5bac2,#1f4fa3)" : hexOf(colour) }} />
            <select value={colour} onChange={(e) => setColour(e.target.value)} className={selectCls} aria-label="Colour for the next upload">
              <option value={ALL}>All colours (general)</option>
              {colours.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="text-xs font-medium text-fg">
          <span className="mb-1.5 block">Photo type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)} className={selectCls} aria-label="Photo type for the next upload">
            {PHOTO_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" leading={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding((a) => !a)}>
          New colour
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-hover/50 p-3">
              <input type="color" value={newHex} onChange={(e) => setNewHex(e.target.value)} aria-label="Swatch colour" className="h-9 w-10 cursor-pointer rounded border border-line bg-transparent p-0.5" />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColour())} placeholder="Colour name, e.g. Cyan Storm" aria-label="New colour name" className={cn(selectCls, "min-w-[12rem] flex-1")} />
              <Button type="button" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]" onClick={addColour}>
                Add colour
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn("mt-4 flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors", dragging ? "border-blue-500 bg-blue-500/10" : "border-line-strong bg-hover/40")}
      >
        <UploadCloud className="h-6 w-6 text-muted" />
        <p className="mt-2 text-[13px] font-medium text-fg">Drag high-resolution photos here</p>
        <p className="mt-0.5 text-xs text-muted">JPG, PNG or WEBP · up to 12 MB each · saved at up to 1800 px</p>
        <Button type="button" className="mt-3" loading={busy} leading={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
          Choose photos
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          hidden
          data-testid="catalogue-photo-input"
          onChange={(e) => {
            void upload(e.target.files ?? []);
            e.target.value = "";
          }}
        />
      </div>

      {/* filter by colour tag */}
      {photos.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Show photos for">
          {[{ v: ALL, label: "All photos", n: photos.length }, { v: "__general__", label: "General", n: count(null) }, ...colours.map((c) => ({ v: c, label: c, n: count(c) }))]
            .filter((t) => t.v === ALL || t.n > 0 || t.v === filter)
            .map((t) => (
              <button key={t.v} type="button" role="tab" aria-selected={filter === t.v} onClick={() => setFilter(t.v)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40", filter === t.v ? "border-transparent bg-[#003399] text-white" : "border-line bg-surface text-muted hover:bg-hover hover:text-fg")}>
                {t.v !== ALL && t.v !== "__general__" && <span className="h-2.5 w-2.5 rounded-full border border-white/40" style={{ background: hexOf(t.v) }} />}
                {t.label} <span className="opacity-70">{t.n}</span>
              </button>
            ))}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="mt-4 text-center text-[13px] text-muted">No photos yet. Until you upload some, the showcase shows a drawn illustration in each colour.</p>
      ) : (
        <motion.ul layout className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((p) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }} transition={spring} className="group overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                <div className="relative aspect-[4/3] bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb || p.src} alt={`${p.colour ?? "General"} ${p.kind} photo`} className="h-full w-full object-cover" />
                  {photos[0]?.id === p.id && <span className="absolute left-2 top-2 rounded-full bg-[#003399] px-2 py-0.5 text-[10.5px] font-semibold text-white">Primary</span>}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    {photos[0]?.id !== p.id && (
                      <button type="button" onClick={() => makeFirst(p.id)} aria-label="Make this the primary photo" title="Make primary" className="grid h-8 w-8 place-items-center rounded-md bg-black/60 text-white outline-none backdrop-blur hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white">
                        <ArrowLeftToLine className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => onChange(photos.filter((x) => x.id !== p.id))} aria-label="Delete photo" title="Delete" className="grid h-8 w-8 place-items-center rounded-md bg-black/60 text-white outline-none backdrop-blur hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-white">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 p-2">
                  <select value={p.colour ?? ALL} onChange={(e) => patch(p.id, { colour: e.target.value === ALL ? null : e.target.value })} aria-label="Colour shown in this photo" className={cn(selectCls, "h-8 min-w-0 flex-1 text-xs")}>
                    <option value={ALL}>All colours</option>
                    {colours.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select value={p.kind} onChange={(e) => patch(p.id, { kind: e.target.value as PhotoKind })} aria-label="Photo type" className={cn(selectCls, "h-8 w-[5.5rem] text-xs")}>
                    {PHOTO_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label.split(" ")[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
