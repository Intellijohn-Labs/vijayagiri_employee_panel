"use client";

import { create } from "zustand";
import { BASE_BRANCHES, branchLabel } from "@/lib/branches";
import { getBranch } from "./branch-store";
import { toast } from "./toast-store";

const LS = { sidebar: "vg.sidebar", branch: "vg.branch" } as const;
// Keys written by earlier builds (roles, permission matrix) — cleared so nothing stale lingers.
const LEGACY_KEYS = ["vg.role", "vg.user", "vg.matrix", "vg.matrix.v2"];
const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — state simply won't persist */
  }
};

/** "all" shows every branch; otherwise a single branch id. */
export type BranchScope = string;

interface AppState {
  now: number;
  sidebarCollapsed: boolean;
  mobileNav: boolean;
  branchScope: BranchScope;

  init: () => void;
  tick: () => void;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
  setBranchScope: (id: BranchScope, opts?: { silent?: boolean }) => void;
}

export const useApp = create<AppState>((set, get) => ({
  now: 0,
  sidebarCollapsed: false,
  mobileNav: false,
  branchScope: "all",

  init: () => {
    try {
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable */
    }
    const branch = read<string>(LS.branch);
    set({
      sidebarCollapsed: !!read<boolean>(LS.sidebar),
      branchScope: branch && BASE_BRANCHES.some((b) => b.id === branch) ? branch : "all",
      now: Date.now(),
    });
  },
  tick: () => set({ now: Date.now() }),

  toggleSidebar: () => {
    const v = !get().sidebarCollapsed;
    write(LS.sidebar, v);
    set({ sidebarCollapsed: v });
  },
  setMobileNav: (mobileNav) => set({ mobileNav }),
  setBranchScope: (id, opts) => {
    const b = getBranch(id);
    const next = b ? id : "all";
    if (next === get().branchScope) return;
    write(LS.branch, next);
    set({ branchScope: next });
    if (opts?.silent) return;
    toast.info(next === "all" ? "Showing all branches" : `Switched to ${branchLabel(b!)}`);
  },
}));
