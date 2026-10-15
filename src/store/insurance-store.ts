"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { deletePolicyDoc, loadPolicyDoc, savePolicyDoc } from "@/lib/photo-db";
import { isoDate, suggestEnd, type Policy } from "@/lib/insurance";
import { useAccessibleIds } from "./employee-store";
import { toast } from "./toast-store";

const KEY = "vg.insurance";

type NewPolicy = Omit<Policy, "id" | "createdAt" | "docName" | "docSize" | "renewalPending" | "sample"> & Partial<Pick<Policy, "renewalPending">>;

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
  loadSample: () => void;
  clearSample: () => void;
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
    loadSample: () => {
      if (get().policies.some((p) => p.sample)) return;
      commit([...get().policies, ...buildSamplePolicies(Date.now())]);
    },
    clearSample: () => commit(get().policies.filter((p) => !p.sample)),
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

/** Demo records spanning every status, dated relative to today. */
function buildSamplePolicies(now: number): Policy[] {
  const day = (n: number) => isoDate(new Date(now + n * 86_400_000));
  const mk = (i: number, p: Partial<Policy> & Pick<Policy, "branchId" | "customer" | "phone" | "modelName" | "partner" | "type">): Policy => ({
    id: `POL-sample-${i}`,
    chassisNo: `ME1RG66${String(10000 + i * 7).padStart(5, "0")}N${200000 + i}`.slice(0, 17),
    engineNo: `G3J${600000 + i * 13}`,
    regNo: "",
    policyNo: "",
    start: "",
    end: "",
    premium: null,
    renewalPending: false,
    sample: true,
    createdAt: now - i,
    ...p,
  });
  const dated = (start: string, type: Policy["type"]) => ({ start, end: suggestEnd(start, type) });
  return [
    mk(1, { branchId: "kothamangalam", customer: "Rahul Menon", phone: "98470 11111", modelName: "MT-15 V2", partner: "HDFC ERGO", type: "Bundled 1+5", policyNo: "2W-KTM-540021", regNo: "KL-17-AB-4521", premium: 8240, ...dated(day(-40), "Bundled 1+5") }),
    mk(2, { branchId: "perumbavoor", customer: "Anjali Nair", phone: "98470 22222", modelName: "Aerox 155", partner: "ICICI Lombard", type: "Comprehensive", policyNo: "ICL-PVR-118842", regNo: "KL-40-C-7788", premium: 5120, ...dated(day(-351), "Comprehensive") }),
    mk(3, { branchId: "hq", customer: "Suresh Pillai", phone: "98470 33333", modelName: "YZF R15 V4 / R15M", partner: "Bajaj Allianz", type: "Zero Depreciation", policyNo: "BAJ-HQ-902211", regNo: "KL-07-DQ-1204", premium: 6890, ...dated(day(-380), "Zero Depreciation") }),
    mk(4, { branchId: "angamaly", customer: "Fathima Rasheed", phone: "98470 44444", modelName: "RayZR 125 Fi Hybrid", partner: "Reliance General", type: "Bundled 1+5" }),
    mk(5, { branchId: "kothamangalam", customer: "Joseph Thomas", phone: "98470 55555", modelName: "FZS-FI V4", partner: "National Insurance", type: "Comprehensive", policyNo: "NIC-KTM-330917", regNo: "KL-17-M-3321", premium: 4780, renewalPending: true, ...dated(day(-359), "Comprehensive") }),
    mk(6, { branchId: "allapra", customer: "Deepak Varma", phone: "98470 66666", modelName: "Fascino 125 Fi Hybrid", partner: "HDFC ERGO", type: "Zero Depreciation", policyNo: "2W-ALP-771203", regNo: "KL-63-F-9090", premium: 5460, ...dated(day(-165), "Zero Depreciation") }),
  ];
}
