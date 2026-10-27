"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { deleteClaimFile, saveClaimFile } from "@/lib/photo-db";
import { createClaim, deleteClaim, listClaims, saveClaim } from "@/actions/claims";
import { HOUR, SLA, blankClaim, isEscalated, logEntry, missingFor, nextGatepassNo, nextRef, slaFor, stageDef, type Claim, type ClaimEvent, type ClaimFile, type Intake, type StageNo } from "@/lib/claims";
import { fmtHours, stageSla } from "@/lib/sla-config";
import { canAccess, useAccessibleIds, useEmployees, type Employee } from "./employee-store";
import { toast } from "./toast-store";

/** Claims used to live in this browser (with demo records); the key is only here to clear what an earlier version left behind. */
const LEGACY_KEY = "vg.claims";

export type FileSlot = "survey" | "ramp";
export const fileId = (claimId: string, slot: FileSlot) => `${claimId}:${slot}`;

export type CompleteResult = { ok: true } | { ok: false; missing: string[] };

interface ClaimsState {
  hydrated: boolean;
  /** Set when the last read from the database failed, so the screen says so instead of looking empty. */
  loadError: boolean;
  claims: Claim[];
  hydrate: () => void;
  /** Re-reads every claim from PostgreSQL. */
  load: () => Promise<void>;
  /** Permanently deletes a claim with its job card and stage history (root admin only). Returns the error message, or null. */
  remove: (id: string) => Promise<string | null>;
  create: (intake: Intake) => Claim;
  /** Shallow-merge fields into a claim (sections are replaced whole). */
  set: (id: string, patch: Partial<Claim>) => void;
  log: (id: string, text: string, tone?: ClaimEvent["tone"]) => void;
  /** Stage 5, step one: record the Yamaha order. The claim stays in stage 5 while the parts are in transit. */
  placeOrder: (id: string, orderNo: string, etaDays: number) => boolean;
  /** Apply `patch`, then move the claim to the next stage if everything the stage needs is in place. */
  complete: (id: string, patch?: Partial<Claim>) => CompleteResult;
  attachFile: (id: string, slot: FileSlot, file: File) => Promise<void>;
  /** Staff note on a claim; shown on its card and in the activity log. */
  addRemark: (id: string, text: string) => boolean;
  /** Manually raise an overdue claim to Top Management (simulated notification). Once per timer. */
  escalate: (id: string) => boolean;
  /** Stage 10: only the Branch Manager of the claim's branch may do this. */
  setApproval: (id: string, approved: boolean) => boolean;
  /** Stage 10: needs approval; marks the claim Delivered to Customer. */
  issueGatepass: (id: string, collectedBy: string) => boolean;
  /** Raise an alert, once, for every timer that has run out. Returns the claims that just breached. */
  sweep: () => { claim: Claim; topManagement: boolean; label: string }[];
}

const me = (): Employee | null => {
  const { employees, sessionId } = useEmployees.getState();
  return employees.find((e) => e.id === sessionId) ?? null;
};
const myName = () => me()?.name ?? "Staff";

/** The Branch Manager is the "Showroom Manager" role in the employee directory — for the claim's own branch only. */
export const isBranchManagerOf = (e: Employee | null, branchId: string) => !!e && e.status === "Active" && e.role === "Showroom Manager" && canAccess(e, branchId);

const ev = (text: string, tone: ClaimEvent["tone"] = "info", at = Date.now()): ClaimEvent => ({ at, text, tone });

export const useClaims = create<ClaimsState>((set, get) => {
  /** Saves for one claim run one after another, and after its creation, so the database sees them in the order they were made. */
  const tails = new Map<string, Promise<unknown>>();
  const queue = (id: string, job: () => Promise<unknown>) => {
    const next = (tails.get(id) ?? Promise.resolve()).then(job, job);
    tails.set(id, next);
    return next;
  };
  const failed = (error: string) => {
    toast.error("Couldn't save to the database", error);
    void get().load();
  };
  const persist = (c: Claim) =>
    queue(c.id, async () => {
      const res = await saveClaim(c, myName(), slaFor(c, Date.now())?.dueAt).catch(() => ({ ok: false as const, error: "Could not reach the database. Please try again." }));
      if (!res.ok) failed(res.error);
    });

  const commit = (claims: Claim[]) => {
    const before = get().claims;
    set({ claims });
    // Only claims that already exist are saved here; a new one is saved by `create`.
    for (const c of claims) {
      const old = before.find((x) => x.id === c.id);
      if (old && old !== c) void persist(c);
    }
  };
  const edit = (id: string, fn: (c: Claim) => Claim) => commit(get().claims.map((c) => (c.id === id ? fn(c) : c)));
  const find = (id: string) => get().claims.find((c) => c.id === id);

  return {
    hydrated: false,
    loadError: false,
    claims: [],
    hydrate: () => {
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* storage unavailable */
      }
      void get().load();
      // Pick up claims other people created or moved while this tab was in the background.
      window.addEventListener("focus", () => void get().load());
    },
    load: async () => {
      try {
        set({ claims: await listClaims(), hydrated: true, loadError: false });
      } catch {
        set({ hydrated: true, loadError: true });
      }
    },
    remove: async (id) => {
      const res = await deleteClaim(id).catch(() => null);
      if (!res) return "Could not reach the server. Please try again.";
      if (!res.ok) return res.error;
      set({ claims: get().claims.filter((c) => c.id !== id) });
      void Promise.all((["survey", "ramp"] as const).map((slot) => deleteClaimFile(fileId(id, slot)).catch(() => undefined)));
      return null;
    },
    create: (intake) => {
      const now = Date.now();
      const claims = get().claims;
      const claim = blankClaim(intake, `clm-${now.toString(36)}`, nextRef(claims, intake.branchId), myName(), now);
      set({ claims: [claim, ...claims] });
      void queue(claim.id, async () => {
        const res = await createClaim(claim, myName(), slaFor(claim, now)?.dueAt).catch(() => ({ ok: false as const, error: "Could not reach the database. Please try again." }));
        if (!res.ok) {
          set({ claims: get().claims.filter((c) => c.id !== claim.id) });
          return toast.error("Couldn't create the claim", res.error);
        }
        // The database allocated the final reference; keep the local copy in step.
        set({ claims: get().claims.map((c) => (c.id === claim.id ? { ...c, ref: res.claim.ref, events: res.claim.events } : c)) });
      });
      return claim;
    },
    set: (id, patch) => edit(id, (c) => ({ ...c, ...patch })),
    log: (id, text, tone) => edit(id, (c) => ({ ...c, events: [ev(text, tone), ...c.events] })),

    addRemark: (id, text) => {
      const t = text.trim();
      if (!t || !find(id)) return false;
      edit(id, (c) => ({ ...c, events: [{ ...ev(`${myName()}: ${t}`), kind: "remark" as const }, ...c.events] }));
      return true;
    },

    escalate: (id) => {
      const c = find(id);
      const s = c && slaFor(c, Date.now());
      if (!c || !s || s.health !== "breach") return false;
      const key = `${s.key}:manual`;
      if (c.escalations.includes(key)) {
        toast.info("Already escalated", "Top Management has already been alerted about this timer.");
        return false;
      }
      edit(id, (x) => ({ ...x, escalations: [...x.escalations, key], events: [ev(`Escalated to Top Management by ${myName()} — ${s.label} overdue (simulated notification)`, "danger"), ...x.events] }));
      return true;
    },

    placeOrder: (id, orderNo, etaDays) => {
      const c = find(id);
      if (c?.stage !== 5 || !orderNo.trim()) return false;
      const now = Date.now();
      const eta = Math.min(SLA.maxTransitDays, Math.max(1, Math.round(etaDays)));
      const orderH = stageSla(5).durationH;
      const late = now > c.stageEnteredAt + orderH * HOUR;
      edit(id, (x) => ({
        ...x,
        parts: { ...x.parts, orderNo: orderNo.trim(), orderedAt: now, orderedBy: myName(), etaDays: eta },
        events: [ev(`Yamaha order ${orderNo.trim()} placed by ${myName()} — transit ETA ${eta} day${eta === 1 ? "" : "s"}${late ? ` (${fmtHours(orderH)} order SLA was missed)` : ""}`, late ? "warn" : "ok", now), ...x.events],
      }));
      return true;
    },

    complete: (id, patch) => {
      const c0 = find(id);
      if (!c0) return { ok: false, missing: ["Claim not found"] };
      if (c0.closedAt) return { ok: false, missing: ["This claim is already delivered"] };
      const c: Claim = { ...c0, ...patch };
      const missing = missingFor(c);
      if (missing.length) {
        if (patch) edit(id, (x) => ({ ...x, ...patch }));
        return { ok: false, missing };
      }
      // Stage 10 closes through the gatepass, not here.
      if (c.stage === 10) return { ok: false, missing: ["Issue the gatepass to hand over the vehicle"] };

      const now = Date.now();
      const entry = logEntry(c, now);
      const done = c.stage;
      const next = (done + 1) as StageNo;
      const out: Claim = { ...c, stage: next, stageEnteredAt: now, stageLog: { ...c.stageLog, [done]: entry } };
      const notes: ClaimEvent[] = [];

      if (done === 5) out.parts = { ...c.parts, receivedAt: now };
      if (done === 6) out.transit = { ...c.transit, dispatchedAt: c.transit.dispatchedAt ?? now, reachedAt: now };
      if (done === 7) {
        out.work = { ...c.work, startedAt: now, notifiedAt: now };
        notes.push(ev(`Customer ${c.customerName} notified on WhatsApp with the ramp photo (simulated) — repair started on the ramp`, "info", now));
        toast.info("Customer notified (simulated)", `WhatsApp to ${c.phone}: “Repair has started on your ${c.model}”, ramp photo attached.`);
      }
      if (done === 2) notes.push(ev(`Official claim number ${c.claimNo} assigned`, "info", now));

      out.events = [...notes, ev(`Stage ${done} complete — ${stageDef(done).short}${entry.breached ? " (after the SLA deadline)" : ""} · by ${myName()}`, entry.breached ? "warn" : "ok", now), ...c.events];
      commit(get().claims.map((x) => (x.id === id ? out : x)));
      return { ok: true };
    },

    attachFile: async (id, slot, file) => {
      const desc: ClaimFile = { name: file.name, size: file.size, at: Date.now(), stored: true };
      edit(id, (c) => (slot === "survey" ? { ...c, survey: { ...c.survey, report: desc } } : { ...c, work: { ...c.work, ramp: desc } }));
      await saveClaimFile({ id: fileId(id, slot), name: file.name, size: file.size, blob: file }).catch(() => toast.warning("File not saved for later", "Your browser blocked storage, so it will be lost when you close the tab."));
    },

    setApproval: (id, approved) => {
      const c = find(id);
      if (c?.stage !== 10 || c.closedAt) return false;
      const e = me();
      if (!e || !isBranchManagerOf(e, c.branchId)) {
        toast.error("Unauthorized: Only the Branch Manager of this branch can approve delivery.");
        return false;
      }
      const now = Date.now();
      edit(id, (x) => ({
        ...x,
        handover: { ...x.handover, approved, approvedBy: approved ? e.name : "", approvedAt: approved ? now : null },
        events: [ev(approved ? `Delivery approved by Branch Manager ${e.name}` : `Delivery approval withdrawn by ${e.name}`, approved ? "ok" : "warn", now), ...x.events],
      }));
      return true;
    },

    issueGatepass: (id, collectedBy) => {
      const c = find(id);
      if (c?.stage !== 10 || c.closedAt || !c.handover.approved) return false;
      const now = Date.now();
      const gatepassNo = nextGatepassNo(get().claims);
      edit(id, (x) => ({
        ...x,
        closedAt: now,
        stageLog: { ...x.stageLog, 10: { enteredAt: x.stageEnteredAt, completedAt: now, breached: false } },
        handover: { ...x.handover, gatepassNo, gatepassAt: now, collectedBy: collectedBy.trim() || x.customerName },
        events: [ev(`Gatepass ${gatepassNo} issued — vehicle delivered to ${collectedBy.trim() || x.customerName}`, "ok", now), ...x.events],
      }));
      return true;
    },

    sweep: () => {
      const now = Date.now();
      const fresh: { claim: Claim; topManagement: boolean; label: string }[] = [];
      const next = get().claims.map((c) => {
        const s = slaFor(c, now);
        if (s?.health !== "breach") return c;
        // Claims escalated before thresholds were configurable already carry the stage 6 alert under the plain key.
        const topDone = c.escalations.includes(`${s.key}:top`) || (s.key === "6:central" && c.escalations.includes(s.key));
        const newBreach = !c.escalations.includes(s.key);
        const newTop = isEscalated(s) && !topDone;
        if (!newBreach && !newTop) return c;
        const out: Claim = {
          ...c,
          escalations: [...c.escalations, ...(newBreach ? [s.key] : []), ...(newTop ? [`${s.key}:top`] : [])],
          events: [newTop ? ev(`TOP MANAGEMENT RED ALERT raised — ${s.label} SLA lapsed; Top Management notified (simulated)`, "danger", s.dueAt + s.escalateAfterMs) : ev(`SLA breached — ${s.label}`, "danger", s.dueAt), ...c.events].sort((a, z) => z.at - a.at),
        };
        fresh.push({ claim: out, topManagement: newTop, label: s.label });
        return out;
      });
      if (fresh.length) commit(next);
      return fresh;
    },

  };
});

/** Claims at the showrooms the signed-in employee may see. */
export function useVisibleClaims(): Claim[] {
  const claims = useClaims((s) => s.claims);
  const ids = useAccessibleIds();
  return useMemo(() => (ids ? claims.filter((c) => ids.includes(c.branchId)) : claims), [claims, ids]);
}
