"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { BASE_BRANCHES, type Branch } from "@/lib/branches";
import { sessionIsAdmin, useAccessibleIds } from "./employee-store";
import { toast } from "./toast-store";
import { getSettings, hoursText, useSettings } from "./settings-store";

const KEY = "vg.branch-edits";

/** What the Admin has changed, per branch id. Anything not listed falls back to the built-in details. */
export type BranchEdits = Record<string, Partial<Omit<Branch, "id">>>;

interface BranchState {
  edits: BranchEdits;
  hydrate: () => void;
  /** Both return false (and tell the user) when the signed-in employee is not an Admin; nothing is changed. */
  save: (id: string, patch: Partial<Omit<Branch, "id">>) => boolean;
  reset: (id: string) => boolean;
}

const persist = (edits: BranchEdits) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(edits));
  } catch {
    /* storage unavailable — the edit holds for this session only */
  }
};

/** Only Admins may modify branch details. This is the last line of defence behind the hidden buttons and the closed drawer. */
const allowed = () => {
  if (sessionIsAdmin()) return true;
  toast.error("Unauthorized: Only Admins can modify branch details.");
  return false;
};

export const useBranchStore = create<BranchState>((set, get) => ({
  edits: {},
  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) set({ edits: JSON.parse(raw) as BranchEdits });
    } catch {
      /* unreadable — use the defaults */
    }
  },
  save: (id, patch) => {
    if (!allowed()) return false;
    const edits = { ...get().edits, [id]: { ...get().edits[id], ...patch } };
    set({ edits });
    persist(edits);
    return true;
  },
  reset: (id) => {
    if (!allowed()) return false;
    const { [id]: _removed, ...rest } = get().edits;
    void _removed;
    set({ edits: rest });
    persist(rest);
    return true;
  },
}));

/**
 * Built-in branches follow the dealership's default hours from Settings; a branch only has its own hours once an Admin
 * has edited them for that branch.
 */
const merge = (edits: BranchEdits, hours: string): Branch[] => BASE_BRANCHES.map((b) => ({ ...b, hours, ...edits[b.id] }));

/** Current branch list for non-React code (stores, toasts). */
export const getBranches = () => merge(useBranchStore.getState().edits, hoursText(getSettings().profile));
export const getBranch = (id?: string | null) => getBranches().find((b) => b.id === id);

/** Every branch, edits applied — for the places that manage them (the Employees access picker). */
export function useAllBranches() {
  const edits = useBranchStore((s) => s.edits);
  const opens = useSettings((s) => s.settings.profile.opens);
  const closes = useSettings((s) => s.settings.profile.closes);
  return useMemo(() => merge(edits, hoursText({ opens, closes })), [edits, opens, closes]);
}

/** The branches the signed-in employee may see (all of them for central admins). */
export function useBranches() {
  const all = useAllBranches();
  const ids = useAccessibleIds();
  return useMemo(() => (ids ? all.filter((b) => ids.includes(b.id)) : all), [all, ids]);
}

/**
 * `branches` is limited to the signed-in employee's showrooms; `byId` can still resolve any branch so a name
 * or label always renders. Components can keep calling `byId(...)` anywhere in their body.
 */
export function useBranchTools() {
  const all = useAllBranches();
  const branches = useBranches();
  return useMemo(() => ({ branches, all, byId: (id?: string | null) => all.find((b) => b.id === id) }), [branches, all]);
}

export const useBranch = (id?: string | null) => useBranchTools().byId(id);

/** First number in a contact line as a dialable +91 number, or "" while it is still a placeholder (contains x). */
export function deriveDial(phone: string): string {
  const first = phone.split("/")[0].trim();
  if (/x/i.test(first)) return "";
  const digits = first.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return "";
}
