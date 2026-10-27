"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { UNAUTHORIZED_ROOT, rootSession, sessionIsAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { parseBranchInput, seedRows, type BranchRecord } from "@/lib/branch-api";

export type BranchResult = { ok: true; branch: BranchRecord } | { ok: false; error: string };

/** Pages that show branch details; revalidated after every change. */
const refresh = () => {
  for (const path of ["/branches", "/stock", "/claims", "/settings"]) revalidatePath(path);
};

const NOT_ADMIN = "Unauthorized: Only Admins can modify branch details.";

const fail = (e: unknown): BranchResult => {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { ok: false, error: "That branch code is already in use" };
    if (e.code === "P2025") return { ok: false, error: "Branch not found" };
  }
  return { ok: false, error: "Could not save the branch. Please try again." };
};

/** Every branch (inactive ones too), sorted by name. An empty table is seeded with the built-in showrooms first. */
export async function getBranches(): Promise<BranchRecord[]> {
  if ((await prisma.branch.count()) === 0) await prisma.branch.createMany({ data: seedRows(), skipDuplicates: true });
  return prisma.branch.findMany({ orderBy: { name: "asc" } });
}

export async function createBranch(formData: FormData): Promise<BranchResult> {
  if (!(await sessionIsAdmin())) return { ok: false, error: NOT_ADMIN };
  const parsed = parseBranchInput(formData, false);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const branch = await prisma.branch.create({ data: { ...parsed.data, name: parsed.data.name!, code: parsed.data.code! } });
    await logAudit({ action: "BRANCH_CREATED", entity: "Branch", entityId: branch.code, branchId: branch.code, details: { name: branch.name } });
    refresh();
    return { ok: true, branch };
  } catch (e) {
    return fail(e);
  }
}

/** `id` is the branch code ("perumbavoor"), the id the portal uses everywhere. The code itself is not editable. */
export async function updateBranch(id: string, formData: FormData): Promise<BranchResult> {
  if (!(await sessionIsAdmin())) return { ok: false, error: NOT_ADMIN };
  formData.delete("code");
  const parsed = parseBranchInput(formData, true);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const old = (await prisma.branch.findUnique({ where: { code: id } })) as Record<string, unknown> | null;
    const branch = await prisma.branch.update({ where: { code: id }, data: { ...parsed.data, name: parsed.data.name ?? undefined } });
    // Old → new for each field the edit actually changed.
    const changes = Object.fromEntries(Object.entries(parsed.data).filter(([k, v]) => old && String(old[k] ?? "") !== String(v ?? "")).map(([k, v]) => [k, `${String(old?.[k] ?? "—")} → ${String(v ?? "—")}`]));
    await logAudit({ action: "BRANCH_UPDATED", entity: "Branch", entityId: id, branchId: id, details: { name: branch.name, changes } });
    refresh();
    return { ok: true, branch };
  } catch (e) {
    return fail(e);
  }
}

/** Soft delete: flips `isActive` so claims and stock that point at the branch keep resolving. */
export async function toggleBranchStatus(id: string): Promise<BranchResult> {
  if (!(await sessionIsAdmin())) return { ok: false, error: NOT_ADMIN };
  try {
    const current = await prisma.branch.findUnique({ where: { code: id }, select: { isActive: true } });
    if (!current) return { ok: false, error: "Branch not found" };
    const branch = await prisma.branch.update({ where: { code: id }, data: { isActive: !current.isActive } });
    await logAudit({ action: branch.isActive ? "BRANCH_ACTIVATED" : "BRANCH_DEACTIVATED", entity: "Branch", entityId: id, branchId: id, details: { name: branch.name } });
    refresh();
    return { ok: true, branch };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Permanently deletes a showroom (root admin only). Staff who had it lose that access (and their primary showroom, if it was this one).
 * A showroom that still has claims can't be deleted, so no claim is ever left pointing at a branch that no longer exists.
 */
export async function deleteBranch(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await rootSession())) return { ok: false, error: UNAUTHORIZED_ROOT };
  try {
    const branch = await prisma.branch.findUnique({ where: { code: id } });
    if (!branch) return { ok: false, error: "Branch not found" };
    const claims = await prisma.claim.count({ where: { branchId: id } });
    if (claims > 0) return { ok: false, error: `${branch.name} still has ${claims} claim${claims === 1 ? "" : "s"}. Delete or finish those first.` };
    await prisma.$transaction(async (tx) => {
      const staff = await tx.employee.findMany({ where: { OR: [{ branchId: branch.id }, { branchCodes: { has: id } }] }, select: { id: true, branchCodes: true } });
      for (const e of staff) {
        const codes = e.branchCodes.filter((c) => c !== id);
        await tx.employee.update({ where: { id: e.id }, data: { branchCodes: codes, branchId: null } });
      }
      await tx.branch.delete({ where: { id: branch.id } });
    });
    await logAudit({ action: "BRANCH_DELETED", entity: "Branch", entityId: id, branchId: id, details: { name: branch.name } });
    refresh();
    revalidatePath("/employees");
    return { ok: true };
  } catch (e) {
    return fail(e) as { ok: false; error: string };
  }
}
