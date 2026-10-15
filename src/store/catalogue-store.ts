"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { defaultInfo, type CatalogueInfo, type ModelMedia } from "@/lib/catalogue";
import { loadCatalogueMedia, saveCatalogueMedia } from "@/lib/photo-db";
import type { ModelOption } from "@/lib/stock-options";
import { sessionIsAdmin } from "./employee-store";
import { useModelOptions } from "./stock-store";
import { toast } from "./toast-store";

const INFO_KEY = "vg.catalogue";
const ENQUIRY_KEY = "vg.catalogue-enquiries";

export interface Enquiry {
  id: string;
  type: "test-ride";
  modelId: string;
  modelName: string;
  colour: string | null;
  branchId: string;
  customer: string;
  phone: string;
  /** yyyy-mm-dd */
  date: string;
  by: string;
  createdAt: number;
}

interface CatalogueState {
  hydrated: boolean;
  /** True once photos and brochures have been read from IndexedDB (or it turned out to be unavailable) */
  mediaLoaded: boolean;
  /** Details the Admin has saved, by model id. Anything missing falls back to the indicative defaults. */
  info: Record<string, CatalogueInfo>;
  /** Photos and brochures, by model id (loaded from IndexedDB) */
  media: Record<string, ModelMedia>;
  enquiries: Enquiry[];
  hydrate: () => void;
  /** Admin only. Returns false (and says why) for anyone else. */
  save: (modelId: string, info: CatalogueInfo, media: ModelMedia) => boolean;
  addEnquiry: (e: Omit<Enquiry, "id" | "createdAt">) => void;
}

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — kept for this session only */
  }
};

export const useCatalogue = create<CatalogueState>((set, get) => ({
  hydrated: false,
  mediaLoaded: false,
  info: {},
  media: {},
  enquiries: [],
  hydrate: () => {
    try {
      const i = localStorage.getItem(INFO_KEY);
      const q = localStorage.getItem(ENQUIRY_KEY);
      set({ info: i ? JSON.parse(i) : {}, enquiries: q ? JSON.parse(q) : [] });
    } catch {
      /* unreadable — start from the defaults */
    }
    set({ hydrated: true });
    loadCatalogueMedia().then(
      (list) => set((s) => ({ media: { ...Object.fromEntries(list.map((m) => [m.id, m])), ...s.media }, mediaLoaded: true })),
      () => set({ mediaLoaded: true }), // no IndexedDB — photos only live for this session
    );
  },
  save: (modelId, info, media) => {
    if (!sessionIsAdmin()) {
      toast.error("Unauthorized: Only Admins can change the catalogue.");
      return false;
    }
    const infos = { ...get().info, [modelId]: info };
    set({ info: infos, media: { ...get().media, [modelId]: media } });
    write(INFO_KEY, infos);
    saveCatalogueMedia(media).catch(() => toast.warning("Photos not saved for later", "Your browser blocked storage, so these photos and the brochure will disappear when you close the tab."));
    return true;
  },
  addEnquiry: (e) => {
    const enquiries = [{ ...e, id: `Q-${Date.now().toString(36)}`, createdAt: Date.now() }, ...get().enquiries];
    set({ enquiries });
    write(ENQUIRY_KEY, enquiries);
  },
}));

export interface CatalogueModel {
  model: ModelOption;
  info: CatalogueInfo;
  media: ModelMedia | undefined;
  /** True once the Admin has saved this model's details at least once */
  saved: boolean;
}

/** Every model (built-in and custom) with its catalogue details and media merged in. */
export function useCatalogueModels(): CatalogueModel[] {
  const models = useModelOptions();
  const info = useCatalogue((s) => s.info);
  const media = useCatalogue((s) => s.media);
  return useMemo(() => models.map((model) => ({ model, info: { ...defaultInfo(model), ...info[model.id] }, media: media[model.id], saved: !!info[model.id] })), [models, info, media]);
}
