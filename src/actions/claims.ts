"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { UNAUTHORIZED_ROOT, rootSession, sessionEmployee } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { triggerPartsOrderAutomation } from "@/lib/parts-automation";
import { PART_STATUSES, STAGES, nextRef, type Claim, type PartLine } from "@/lib/claims";

export type ClaimResult = { ok: true; claim: Claim } | { ok: false; error: string };

const date = (v: string | null | undefined) => {
  const t = v ? new Date(v) : null;
  return t && !Number.isNaN(t.getTime()) ? t : null;
};

const valid = (c: Claim) => typeof c?.id === "string" && !!c.id && Number.isInteger(c.stage) && c.stage >= 1 && c.stage <= 10 && typeof c.branchId === "string";

/** Columns the table keeps queryable; the rest of the claim travels in `data`. */
const columns = (c: Claim) => ({
  claimNo: c.claimNo || null,
  jobCardNumber: c.jobCardNo || null,
  branchId: c.branchId,
  customerName: c.customerName,
  contactNumber: c.phone,
  vehicleModel: c.model,
  registrationNumber: c.regNo,
  insuranceCompany: c.insurer,
  currentStage: c.stage,
  status: c.closedAt ? "Delivered" : "Open",
  stageEnteredAt: new Date(c.stageEnteredAt),
  closedAt: c.closedAt ? new Date(c.closedAt) : null,
  createdBy: c.createdBy,
  data: c as unknown as Prisma.InputJsonValue,
});

/** Writes the claim's stage log to StageHistory: one row per stage entered, with its SLA deadline and whether it was missed. */
async function syncHistory(tx: Prisma.TransactionClient, c: Claim, actor: string, currentDueAt?: number) {
  const rows: Record<number, { enteredAt: number; completedAt?: number; dueAt?: number; breached: boolean }> = {};
  for (const [n, e] of Object.entries(c.stageLog)) rows[Number(n)] = e;
  if (!c.closedAt) rows[c.stage] = { enteredAt: c.stageEnteredAt, dueAt: currentDueAt, breached: false };

  for (const [n, e] of Object.entries(rows)) {
    const stageNumber = Number(n);
    const remark = !e.completedAt ? c.events.find((x) => x.kind === "remark" && x.at >= e.enteredAt)?.text : undefined;
    const data = {
      stageName: STAGES[stageNumber - 1]?.name ?? `Stage ${stageNumber}`,
      enteredAt: new Date(e.enteredAt),
      completedAt: e.completedAt ? new Date(e.completedAt) : null,
      dueAt: e.dueAt ? new Date(e.dueAt) : null,
      breached: e.breached,
      remarks: remark ?? null,
      updatedBy: actor,
    };
    await tx.stageHistory.upsert({ where: { claimId_stageNumber: { claimId: c.id, stageNumber } }, create: { claimId: c.id, stageNumber, ...data }, update: data });
  }
}

/** Mirrors the Job Card Ver 2.1 form into its own table. */
async function syncJobCard(tx: Prisma.TransactionClient, c: Claim) {
  const j = c.jobCard;
  const data = {
    date: date(j.date) ?? new Date(c.createdAt),
    advisor: j.advisor,
    notes: j.notes,
    bay: j.bay,
    couponNo: j.couponNo,
    amc: j.amc,
    pp: j.pp,
    jobType: j.jobType,
    telReminder: j.telReminder,
    receivedAt: date(j.receivedAt),
    promisedAt: date(j.promisedAt),
    engineNo: j.engineNo,
    engineCc: j.engineCc,
    saleDate: date(j.saleDate),
    fuel: j.fuel,
    toolkit: j.toolkit,
    firstAid: j.firstAid,
    serviceManual: j.serviceManual,
    returnOldParts: j.returnOldParts,
    supervisor: j.supervisor,
    mechanic: j.mechanic,
    estParts: j.estParts,
    estLabour: j.estLabour,
  };
  await tx.jobCard.upsert({ where: { claimId: c.id }, create: { claimId: c.id, ...data }, update: data });
}

const SIGN_IN = "Your session has ended. Please sign in again.";

const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "That job card number is already used by another claim" };
  return { ok: false, error: "Could not reach the database. Please try again." };
};

/** Every claim, newest first. Nothing is generated: an empty table gives an empty list. */
export async function listClaims(): Promise<Claim[]> {
  if (!(await sessionEmployee())) throw new Error("Not signed in");
  const rows = await prisma.claim.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ ...(r.data as unknown as Claim), id: r.id, ref: r.ref }));
}

/** Creates a claim at stage 1. The reference (CLM-PBR-0012) is allocated here so two people can't get the same one. */
export async function createClaim(claim: Claim, actor: string, dueAt?: number): Promise<ClaimResult> {
  if (!(await sessionEmployee())) return { ok: false, error: SIGN_IN };
  if (!valid(claim)) return { ok: false, error: "Invalid claim" };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const siblings = await prisma.claim.findMany({ where: { branchId: claim.branchId }, select: { ref: true } });
      const ref = nextRef(siblings.map((s) => ({ ref: s.ref, branchId: claim.branchId })) as Claim[], claim.branchId);
      const saved: Claim = { ...claim, ref, events: claim.events.map((e) => (e.text.startsWith("Claim ") && e.text.endsWith(" opened") ? { ...e, text: `Claim ${ref} opened` } : e)) };
      await prisma.$transaction(async (tx) => {
        await tx.claim.create({ data: { id: saved.id, ref, ...columns(saved) } });
        await syncJobCard(tx, saved);
        await syncHistory(tx, saved, actor, dueAt);
      });
      await logAudit({ action: "CLAIM_CREATED", entity: "Claim", entityId: saved.id, branchId: saved.branchId, details: { ref, customer: saved.customerName, regNo: saved.regNo } });
      revalidatePath("/claims");
      return { ok: true, claim: saved };
    } catch (e) {
      // Someone else took this reference a moment ago: pick the next one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target).includes("ref")) continue;
      return fail(e);
    }
  }
  return { ok: false, error: "Could not allocate a claim reference. Please try again." };
}

/** Saves the claim as the portal has it and records any stage it has entered or completed. */
export async function saveClaim(claim: Claim, actor: string, dueAt?: number): Promise<ClaimResult> {
  if (!(await sessionEmployee())) return { ok: false, error: SIGN_IN };
  if (!valid(claim)) return { ok: false, error: "Invalid claim" };
  try {
    const before = await prisma.claim.findUnique({ where: { id: claim.id }, select: { currentStage: true, closedAt: true, ref: true } });
    await prisma.$transaction(async (tx) => {
      await tx.claim.update({ where: { id: claim.id }, data: columns(claim) });
      await syncJobCard(tx, claim);
      await syncHistory(tx, claim, actor, dueAt);
    });
    if (before && before.currentStage !== claim.stage) await logAudit({ action: "STAGE_CHANGED", entity: "Claim", entityId: claim.id, branchId: claim.branchId, details: { ref: before.ref, from: before.currentStage, to: claim.stage, stage: STAGES[claim.stage - 1]?.name } });
    if (before && !before.closedAt && claim.closedAt) await logAudit({ action: "CLAIM_DELIVERED", entity: "Claim", entityId: claim.id, branchId: claim.branchId, details: { ref: before.ref, customer: claim.customerName } });
    revalidatePath("/claims");
    return { ok: true, claim };
  } catch (e) {
    return fail(e);
  }
}

/** Permanently deletes a claim with its job card and stage history (both cascade). Root admin only. */
export async function deleteClaim(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await rootSession())) return { ok: false, error: UNAUTHORIZED_ROOT };
  try {
    const claim = await prisma.claim.findUnique({ where: { id }, select: { ref: true, branchId: true, customerName: true, currentStage: true } });
    if (!claim) return { ok: false, error: "Claim not found" };
    await prisma.claim.delete({ where: { id } });
    await logAudit({ action: "CLAIM_DELETED", entity: "Claim", entityId: id, branchId: claim.branchId, details: { ref: claim.ref, customer: claim.customerName, stage: claim.currentStage } });
    revalidatePath("/claims");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete the claim. Please try again." };
  }
}

export interface PartsVendorInfo {
  vendor: string;
  requiresParts: boolean;
  /** Send the order to the vendor through the n8n automation */
  notify: boolean;
  orderNo?: string;
  etaDays?: number;
  /** True only when the order is being placed now, which is what records "created" and fires the automation */
  placed?: boolean;
}

export type PartsOrderResult = { ok: true; automation: "started" | "skipped" | "off" } | { ok: false; error: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Stores a claim's spare-parts lines in PartsOrderLine (replacing the previous set), and records the order in the audit log.
 * When the order is being placed and automatic vendor notification is on, it also hands the order to the n8n webhook.
 * The claim's own copy of the order travels with the claim through saveClaim.
 */
export async function savePartsOrder(input: { claimId: string; parts: PartLine[]; vendorInfo: PartsVendorInfo }): Promise<PartsOrderResult> {
  const me = await sessionEmployee();
  if (!me) return { ok: false, error: SIGN_IN };
  const { claimId, vendorInfo } = input;
  if (typeof claimId !== "string" || !claimId || !Array.isArray(input.parts) || input.parts.length > 100) return { ok: false, error: "Invalid parts order" };

  const lines = input.parts.map((l, position) => ({
    position,
    partNo: text(l.code, 60),
    description: text(l.description, 200),
    quantity: Math.round(Number(l.qty)),
    unitPrice: Math.round(Number(l.unitPrice ?? 0) * 100) / 100,
    vendor: text(l.vendor, 120),
    status: PART_STATUSES.includes(l.status) ? l.status : "Pending Order",
  }));
  if (vendorInfo.requiresParts && !lines.length) return { ok: false, error: "Add at least one spare part" };
  if (lines.some((l) => !l.description || !(l.quantity >= 1 && l.quantity <= 9999) || !(l.unitPrice >= 0 && l.unitPrice <= 10_000_000))) return { ok: false, error: "Every part needs a description, a quantity and a valid unit price" };

  const vendor = text(vendorInfo.vendor, 120);
  const orderNo = text(vendorInfo.orderNo, 60);
  try {
    const claim = await prisma.claim.findUnique({ where: { id: claimId }, select: { ref: true, claimNo: true, branchId: true, customerName: true, vehicleModel: true, registrationNumber: true } });
    if (!claim) return { ok: false, error: "Claim not found" };
    await prisma.$transaction([
      prisma.partsOrderLine.deleteMany({ where: { claimId } }),
      prisma.partsOrderLine.createMany({ data: lines.map((l) => ({ claimId, ...l, orderNo })) }),
    ]);
    const totalValue = lines.reduce((t, l) => t + l.quantity * l.unitPrice, 0);
    await logAudit({
      action: vendorInfo.placed ? "PARTS_ORDER_CREATED" : "PARTS_ORDER_UPDATED",
      entity: "Claim",
      entityId: claimId,
      branchId: claim.branchId,
      details: { ref: claim.ref, orderNo: orderNo || undefined, vendor, parts: lines.length, totalValue, automatic: vendorInfo.notify },
    });

    let automation: "started" | "skipped" | "off" = "off";
    if (vendorInfo.placed && vendorInfo.notify) {
      const branch = await prisma.branch.findUnique({ where: { code: claim.branchId }, select: { name: true, address: true, city: true, phone: true } });
      const started = triggerPartsOrderAutomation({
        event: "parts_order.created",
        claim: { id: claimId, ref: claim.ref, claimNo: claim.claimNo, customer: claim.customerName, vehicle: claim.vehicleModel, regNo: claim.registrationNumber },
        order: { orderNo, vendor, etaDays: Number(vendorInfo.etaDays) || 0, totalValue, createdBy: me.name, createdAt: new Date().toISOString() },
        destination: { branch: branch?.name ?? claim.branchId, address: [branch?.address, branch?.city].filter(Boolean).join(", "), phone: branch?.phone ?? "" },
        parts: lines.map((l) => ({ code: l.partNo, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vendor: l.vendor || vendor, lineTotal: l.quantity * l.unitPrice })),
      });
      automation = started ? "started" : "skipped";
    }
    revalidatePath("/claims");
    return { ok: true, automation };
  } catch {
    return { ok: false, error: "Could not save the parts order. Please try again." };
  }
}
