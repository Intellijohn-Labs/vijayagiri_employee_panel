"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { deletePolicyDoc, loadPolicyDoc, savePolicyDoc } from "@/lib/photo-db";
import { type Policy } from "@/lib/insurance";
import { useAccessibleIds } from "./employee-store";
import { toast } from "./toast-store";

const KEY = "vg.insurance";

type NewPolicy = Omit<Policy, "id" | "createdAt" | "docName" | "docSize" | "renewalPending"> & Partial<Pick<Policy, "renewalPending">>;

interface InsuranceState {
  hydrated: boolean;
  policies: Policy[];
  hydrate: () => void;
  /** `doc` is the PDF to store with it, if any. */
  add: (p: NewPolicy, doc?: File | null) => Promise<Policy>;
  /** `doc`: a File to store, "remove" to drop the stored PDF, or undefined to leave it alone. */
  update: (id: string, patch: Partial<Omit<Policy, "id" | "createdAt">>, doc?: File | "remove") => Promise<void>;
  remove: (id: string) => Policy | undefined;
  restore: (p: Policy) => void;
  /** Mark that a renewal reminder went out. */
  markReminded: (id: string) => void;
}

const write = (policies: Policy[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(policies));
  } catch {
    /* storage unavailable — kept for this session only */
  }
};

const warnDoc = () => toast.warning("PDF not saved for later", "Your browser blocked storage, so the policy PDF will disappear when you close the tab.");

export const useInsurance = create<InsuranceState>((set, get) => {
  const commit = (policies: Policy[]) => {
    set({ policies });
    write(policies);
  };
  return {
    hydrated: false,
    policies: [],
    hydrate: () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) set({ policies: JSON.parse(raw) as Policy[] });
      } catch {
        /* unreadable — start empty */
      }
      set({ hydrated: true });
    },
    add: async (p, doc) => {
      const id = `POL-${Date.now().toString(36)}`;
      const policy: Policy = { renewalPending: false, ...p, id, createdAt: Date.now(), ...(doc ? { docName: doc.name, docSize: doc.size } : {}) };
      commit([policy, ...get().policies]);
      if (doc) await savePolicyDoc({ id, name: doc.name, size: doc.size, blob: doc }).catch(warnDoc);
      return policy;
    },
    update: async (id, patch, doc) => {
      const next: Partial<Policy> = { ...patch };
      if (doc instanceof File) Object.assign(next, { docName: doc.name, docSize: doc.size });
      else if (doc === "remove") Object.assign(next, { docName: undefined, docSize: undefined });
      commit(get().policies.map((x) => (x.id === id ? { ...x, ...next } : x)));
      if (doc instanceof File) await savePolicyDoc({ id, name: doc.name, size: doc.size, blob: doc }).catch(warnDoc);
      else if (doc === "remove") await deletePolicyDoc(id).catch(() => undefined);
    },
    remove: (id) => {
      const gone = get().policies.find((x) => x.id === id);
      if (gone) commit(get().policies.filter((x) => x.id !== id));
      return gone;
    },
    restore: (p) => commit([p, ...get().policies].sort((a, z) => z.createdAt - a.createdAt)),
    markReminded: (id) => commit(get().policies.map((x) => (x.id === id ? { ...x, renewalPending: true } : x))),
  };
});

/** Open a policy's stored PDF in a new tab. */
export async function openPolicyDoc(id: string) {
  const doc = await loadPolicyDoc(id).catch(() => undefined);
  if (!doc) return void toast.error("Couldn't open the PDF", "It isn't stored in this browser. Upload it again.");
  const url = URL.createObjectURL(doc.blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Policies at the showrooms the signed-in employee may see. */
export function useVisiblePolicies(): Policy[] {
  const policies = useInsurance((s) => s.policies);
  const ids = useAccessibleIds();
  return useMemo(() => (ids ? policies.filter((p) => ids.includes(p.branchId)) : policies), [policies, ids]);
}
