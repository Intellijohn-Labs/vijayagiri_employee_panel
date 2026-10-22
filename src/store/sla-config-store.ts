"use client";

import { create } from "zustand";
import { DEFAULT_SLA, sanitizeSla, setActiveSla, type SlaConfig } from "@/lib/sla-config";

const KEY = "vg.slaConfig.v1";

/** The SLA thresholds in force. Saved per browser; every timer and status reads them through `lib/sla-config`. */
interface SlaConfigState {
  config: SlaConfig;
  hydrated: boolean;
  hydrate: () => void;
  save: (config: SlaConfig) => void;
  reset: () => void;
}

export const useSlaConfig = create<SlaConfigState>((set, get) => {
  const apply = (config: SlaConfig, persist: boolean) => {
    setActiveSla(config);
    set({ config });
    if (!persist) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(config));
    } catch {
      /* storage unavailable: the thresholds last until reload */
    }
  };
  return {
    config: DEFAULT_SLA,
    hydrated: false,
    hydrate: () => {
      if (get().hydrated) return;
      let saved: SlaConfig | null = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) saved = sanitizeSla(JSON.parse(raw));
      } catch {
        /* unreadable: use the defaults */
      }
      set({ hydrated: true });
      if (saved) apply(saved, false);
    },
    save: (config) => apply(sanitizeSla(config), true),
    reset: () => {
      apply(DEFAULT_SLA, false);
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* nothing to clear */
      }
    },
  };
});
