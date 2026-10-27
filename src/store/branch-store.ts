"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { BASE_BRANCHES, type Branch } from "@/lib/branches";
import type { BranchRecord } from "@/lib/branch-api";
import { createBranch, getBranches as fetchBranches, toggleBranchStatus, updateBranch, type BranchResult } from "@/actions/branches";
import { sessionIsAdmin, useAccessibleIds } from "./employee-store";
import { toast } from "./toast-store";
import { getSettings, hoursText, useSettings } from "./settings-store";

const KEY = "vg.branch-edits";

/** What the Admin has changed, per branch id. Anything not listed falls back to the built-in details. */
export type BranchEdits = Record<string, Partial<Omit<Branch, "id">>>;

/** Branch rows from the database, by code. Empty until loaded (or if the database is unreachable), in which case the built-in list is used as is. */
type Remote = Record<string, BranchRecord>;

/** The fields the database owns; everything else (hours, status override, badge) stays in the browser edits. */
export type BranchForm = Partial<Record<"name" | "code" | "phone" | "email" | "address" | "city" | "state" | "pincode" | "managerName", string>>;

interface BranchState {
  edits: BranchEdits;
  remote: Remote;
  loading: boolean;
  hydrate: () => void;
  /** Re-reads the branches from the database; a failure keeps what is already on screen. */
  load: () => Promise<void>;
  /** Add (`id` omitted) or edit a showroom in the database. Returns the error message, or null on success. */
  saveRemote: (id: string | null, form: BranchForm) => Promise<string | null>;
  /** Activate / deactivate; returns the error message, or null on success. */
  toggleActive: (id: string) => Promise<string | null>;
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

const toFormData = (form: BranchForm) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) if (v !== undefined) fd.set(k, v);
  return fd;
};

export const useBranchStore = create<BranchState>((set, get) => ({
  edits: {},
  remote: {},
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const rows = await fetchBranches();
      set({ remote: Object.fromEntries(rows.map((r) => [r.code, r])) });
    } catch {
      /* database unreachable — keep the built-in / last known list */
    } finally {
      set({ loading: false });
    }
  },
  saveRemote: async (id, form) => {
    if (!allowed()) return "Unauthorized: Only Admins can modify branch details.";
    const res: BranchResult = await (id ? updateBranch(id, toFormData(form)) : createBranch(toFormData(form))).catch(() => ({ ok: false as const, error: "Could not reach the server" }));
    if (!res.ok) return res.error;
    set({ remote: { ...get().remote, [res.branch.code]: res.branch } });
    return null;
  },
  toggleActive: async (id) => {
    if (!allowed()) return "Unauthorized: Only Admins can modify branch details.";
    const res = await toggleBranchStatus(id).catch(() => ({ ok: false as const, error: "Could not reach the server" }));
    if (!res.ok) return res.error;
    set({ remote: { ...get().remote, [res.branch.code]: res.branch } });
    return null;
  },
  hydrate: () => {
    void get().load();
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

/** Columns the database owns, mapped onto the portal's Branch shape. Empty columns fall back to the built-in value. */
const fromRecord = (r: BranchRecord): Partial<Branch> => ({
  ...(r.name && { name: r.name }),
  ...(r.city && { city: r.city }),
  ...(r.address && { address: r.address }),
  ...(r.phone && { phone: r.phone, dial: deriveDial(r.phone) || undefined }),
  ...(r.managerName && { manager: r.managerName }),
  email: r.email ?? undefined,
  state: r.state ?? undefined,
  pincode: r.pincode ?? undefined,
  isActive: r.isActive,
});

/** A branch that only exists in the database (added from the portal): sensible defaults for what the table does not hold. */
const fromNewRecord = (r: BranchRecord, hours: string): Branch => ({
  id: r.code,
  name: r.name,
  short: r.city || r.name,
  kind: "branch",
  city: r.city ?? "",
  address: r.address ?? "",
  phone: r.phone ?? "",
  manager: r.managerName ?? "",
  hours,
  status: "open",
  ...fromRecord(r),
});

/**
 * Built-in branches follow the dealership's default hours from Settings; a branch only has its own hours once an Admin
 * has edited them. Database values win over the built-ins and over older browser edits; branches added in the portal
 * (database only) are appended. Inactive branches stay in the list, flagged, so ids on old claims and stock still resolve.
 */
const merge = (edits: BranchEdits, hours: string, remote: Remote): Branch[] => [
  ...BASE_BRANCHES.map((b) => ({ ...b, hours, ...edits[b.id], ...(remote[b.id] && fromRecord(remote[b.id])) })),
  ...Object.values(remote)
    .filter((r) => !BASE_BRANCHES.some((b) => b.id === r.code))
    .map((r) => ({ ...fromNewRecord(r, hours), ...edits[r.code], ...fromRecord(r) })),
];

/** Current branch list for non-React code (stores, toasts). */
export const getBranches = () => merge(useBranchStore.getState().edits, hoursText(getSettings().profile), useBranchStore.getState().remote);
export const getBranch = (id?: string | null) => getBranches().find((b) => b.id === id);

/** Every branch, edits applied — for the places that manage them (the Employees access picker). */
export function useAllBranches() {
  const edits = useBranchStore((s) => s.edits);
  const remote = useBranchStore((s) => s.remote);
  const opens = useSettings((s) => s.settings.profile.opens);
  const closes = useSettings((s) => s.settings.profile.closes);
  return useMemo(() => merge(edits, hoursText({ opens, closes }), remote), [edits, remote, opens, closes]);
}

/** The branches the signed-in employee may see (all of them for central admins). */
export function useBranches() {
  const all = useAllBranches();
  const ids = useAccessibleIds();
  return useMemo(() => all.filter((b) => b.isActive !== false && (!ids || ids.includes(b.id))), [all, ids]);
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
