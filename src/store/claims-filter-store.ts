"use client";

import { create } from "zustand";

/** Search and showroom filter, shared by every Claims page so they survive moving between stages. In memory only. */
interface FilterState {
  q: string;
  showroom: string;
  setQ: (q: string) => void;
  setShowroom: (id: string) => void;
}

export const useClaimFilters = create<FilterState>((set) => ({
  q: "",
  showroom: "all",
  setQ: (q) => set({ q }),
  setShowroom: (showroom) => set({ showroom }),
}));
