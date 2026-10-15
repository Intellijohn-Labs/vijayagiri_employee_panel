"use client";

import { create } from "zustand";
import { COLOUR_HEX, STOCK_MODELS, TRANSIT, type ModelCategory, type ModelOption, type StockStatus } from "@/lib/stock-options";
import { useMemo } from "react";
import { useAccessibleIds } from "./employee-store";
import { getBranch } from "./branch-store";
import { loadPhotoSets, savePhotoSet, type PhotoSet } from "@/lib/photo-db";
import { buildSampleStock } from "@/lib/sample-stock";
import { toast } from "./toast-store";

/** One physical vehicle taken into stock at a showroom. */
export interface StockEntry {
  id: string;
  branchId: string;
  modelId: string;
  modelName: string;
  variant: string;
  colour: string;
  chassisNo: string;
  engineNo: string;
  status: StockStatus;
  exShowroom: number | null;
  onRoad: number | null;
  /** yyyy-mm-dd */
  intakeDate: string;
  /** Photos for this vehicle; every unit added in one entry shares one set. */
  photoSetId: string | null;
  /** Model details saved with the unit, so a model that is not in the built-in list still renders properly */
  category?: ModelCategory;
  series?: string;
  short?: string;
  /** Demo data from "Load sample stock" — removable in one click */
  sample?: boolean;
  createdAt: number;
}

const KEY = "vg.stock";
const MODELS_KEY = "vg.models";
const COLOURS_KEY = "vg.colours";
const EXTRAS_KEY = "vg.model-extras";

/** Variants and colours added on the fly for any model, built-in or custom. */
export type ModelExtras = Record<string, { variants: string[]; colours: string[] }>;

interface StockState {
  /** False until saved entries have been read from the browser */
  hydrated: boolean;
  entries: StockEntry[];
  /** Models the Admin created from the Add Stock form */
  customModels: ModelOption[];
  /** Swatch colours for custom colour names */
  customColours: Record<string, string>;
  extras: ModelExtras;
  photoSets: Record<string, PhotoSet>;
  hydrate: () => void;
  add: (units: Omit<StockEntry, "id" | "createdAt" | "photoSetId" | "sample">[], photos: Omit<PhotoSet, "id"> | null) => void;
  loadSample: () => void;
  clearSample: () => void;
  /** Remember a model, variant or colour created in the intake form so it is offered next time. */
  registerOptions: (o: { model?: ModelOption; modelId: string; variant: string; colour: string; colourHex?: string }) => void;
  setStatus: (id: string, status: StockStatus) => void;
  /** Send a unit to another showroom; it shows as In Transit there until received. */
  transferEntry: (id: string, toBranchId: string) => void;
  /** Hand a unit over to its customer: it leaves live stock (undo available). */
  markDelivered: (id: string) => void;
}

const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — kept for this session only */
  }
};

const persist = (entries: StockEntry[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable — entries stay for this session only */
  }
};

export const useStock = create<StockState>((set, get) => ({
  hydrated: false,
  entries: [],
  customModels: [],
  customColours: {},
  extras: {},
  photoSets: {},
  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) set({ entries: JSON.parse(raw) as StockEntry[] });
    } catch {
      /* unreadable or unavailable — start empty */
    }
    try {
      const m = localStorage.getItem(MODELS_KEY);
      const c = localStorage.getItem(COLOURS_KEY);
      const x = localStorage.getItem(EXTRAS_KEY);
      set({ customModels: m ? (JSON.parse(m) as ModelOption[]) : [], customColours: c ? JSON.parse(c) : {}, extras: x ? JSON.parse(x) : {} });
    } catch {
      /* unreadable — start with none */
    }
    set({ hydrated: true });
    loadPhotoSets().then(
      (sets) => set((s) => ({ photoSets: { ...Object.fromEntries(sets.map((p) => [p.id, p])), ...s.photoSets } })),
      () => {
        /* no IndexedDB — photos only live for this session */
      },
    );
  },
  add: (units, photos) => {
    const now = Date.now();
    const photoSetId = photos ? `P-${now.toString(36)}` : null;
    const added = units.map((u, i): StockEntry => ({ ...u, id: `S-${now.toString(36)}-${i}`, photoSetId, createdAt: now }));
    const entries = [...added, ...get().entries];
    set({ entries });
    persist(entries);
    if (photos && photoSetId) {
      const record: PhotoSet = { id: photoSetId, ...photos };
      set((s) => ({ photoSets: { ...s.photoSets, [photoSetId]: record } }));
      savePhotoSet(record).catch(() => toast.warning("Photos not saved for later", "Your browser blocked storage, so these photos will disappear when you close the tab."));
    }
  },
  loadSample: () => {
    if (get().entries.some((e) => e.sample)) return;
    const now = Date.now();
    const sample = buildSampleStock(now).map((u, i): StockEntry => ({ ...u, id: `S-sample-${i}`, photoSetId: null, createdAt: now - i }));
    const entries = [...get().entries, ...sample];
    set({ entries });
    persist(entries);
  },
  clearSample: () => {
    const entries = get().entries.filter((e) => !e.sample);
    set({ entries });
    persist(entries);
  },
  registerOptions: ({ model, modelId, variant, colour, colourHex }) => {
    if (model && !get().customModels.some((m) => m.id === model.id)) {
      const customModels = [...get().customModels, model];
      set({ customModels });
      save(MODELS_KEY, customModels);
    }
    if (colourHex && !COLOUR_HEX[colour] && get().customColours[colour] !== colourHex) {
      const customColours = { ...get().customColours, [colour]: colourHex };
      set({ customColours });
      save(COLOURS_KEY, customColours);
    }
    // Built-in and custom models both remember extra variants / colours (custom models already list their first ones).
    const base = STOCK_MODELS.find((m) => m.id === modelId) ?? get().customModels.find((m) => m.id === modelId);
    const known = (list: string[] = [], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());
    const cur = get().extras[modelId] ?? { variants: [], colours: [] };
    const addVariant = !!variant && !known(base?.variants, variant) && !known(cur.variants, variant);
    const addColour = !!colour && !known(base?.colours, colour) && !known(cur.colours, colour);
    if (addVariant || addColour) {
      const extras = { ...get().extras, [modelId]: { variants: addVariant ? [...cur.variants, variant] : cur.variants, colours: addColour ? [...cur.colours, colour] : cur.colours } };
      set({ extras });
      save(EXTRAS_KEY, extras);
    }
  },
  setStatus: (id, status) => {
    const entries = get().entries.map((e) => (e.id === id ? { ...e, status } : e));
    set({ entries });
    persist(entries);
  },
  transferEntry: (id, toBranchId) => {
    const before = get().entries.find((e) => e.id === id);
    if (!before || before.branchId === toBranchId) return;
    const entries = get().entries.map((e) => (e.id === id ? { ...e, branchId: toBranchId, status: TRANSIT } : e));
    set({ entries });
    persist(entries);
    toast.success(`${before.modelName} sent to ${getBranch(toBranchId)?.short}`, "It shows as In Transit there until it is received.", {
      action: {
        label: "Undo",
        onClick: () => {
          const restored = get().entries.map((e) => (e.id === id ? before : e));
          set({ entries: restored });
          persist(restored);
        },
      },
    });
  },
  markDelivered: (id) => {
    const before = get().entries.find((e) => e.id === id);
    if (!before) return;
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    persist(entries);
    toast.success(`${before.modelName} delivered`, "Removed from live stock.", {
      action: {
        label: "Undo",
        onClick: () => {
          const restored = [before, ...get().entries];
          set({ entries: restored });
          persist(restored);
        },
      },
    });
  },
}));

/** Built-in models plus any the Admin created, with every extra variant and colour merged in. */
export function useModelOptions(): ModelOption[] {
  const custom = useStock((s) => s.customModels);
  const extras = useStock((s) => s.extras);
  return useMemo(
    () =>
      [...STOCK_MODELS, ...custom].map((m) => {
        const x = extras[m.id];
        return x ? { ...m, variants: [...m.variants, ...x.variants.filter((v) => !m.variants.includes(v))], colours: [...m.colours, ...x.colours.filter((c) => !m.colours.includes(c))] } : m;
      }),
    [custom, extras],
  );
}

/** Swatch colour for any colour name: built-in first, then custom ones the Admin picked. */
export function useColourHex() {
  const custom = useStock((s) => s.customColours);
  return useMemo(() => (name: string) => COLOUR_HEX[name] ?? custom[name] ?? "#94a3b8", [custom]);
}

/** Units at the showrooms the signed-in employee may see. */
export function useVisibleEntries(): StockEntry[] {
  const entries = useStock((s) => s.entries);
  const ids = useAccessibleIds();
  return useMemo(() => (ids ? entries.filter((e) => ids.includes(e.branchId)) : entries), [entries, ids]);
}
