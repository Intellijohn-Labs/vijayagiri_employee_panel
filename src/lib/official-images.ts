"use client";

import { create } from "zustand";

/** `{ [modelId]: { [colour | "*"]: url[] } }`, read from /images/catalogue/manifest.json. */
type Manifest = Record<string, Record<string, string[]>>;

interface OfficialState {
  /** True once the manifest has been fetched (or failed to), so the first screen never flashes illustrations */
  loaded: boolean;
  manifest: Manifest;
  load: () => void;
}

export const useOfficialImages = create<OfficialState>((set) => ({
  loaded: false,
  manifest: {},
  load: () => {
    fetch("/images/catalogue/manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((json: Record<string, unknown>) => {
        // Entries starting with "_" are notes, not models.
        const manifest: Manifest = {};
        for (const [id, colours] of Object.entries(json)) {
          if (id.startsWith("_") || !colours || typeof colours !== "object") continue;
          manifest[id] = Object.fromEntries(Object.entries(colours as Record<string, unknown>).map(([c, urls]) => [c, Array.isArray(urls) ? urls.filter((u): u is string => typeof u === "string" && !!u) : []]));
        }
        set({ manifest, loaded: true });
      })
      .catch(() => set({ loaded: true }));
  },
}));

/** Official photos for a model in a colour: that colour's, otherwise the ones listed for every colour ("*"). */
export function officialPhotos(modelId: string, colour?: string | null): string[] {
  const m = useOfficialImages.getState().manifest[modelId];
  if (!m) return [];
  const own = colour ? m[colour] : undefined;
  return own?.length ? own : (m["*"] ?? []);
}
