"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBranchInput, seedRows, type BranchRecord } from "@/lib/branch-api";

export type BranchResult = { ok: true; branch: BranchRecord } | { ok: false; error: string };

/** Pages that show branch details; revalidated after every change. */
const refresh = () => {
  for (const path of ["/branches", "/stock", "/claims", "/settings"]) revalidatePath(path);
};

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
  const parsed = parseBranchInput(formData, false);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const branch = await prisma.branch.create({ data: { ...parsed.data, name: parsed.data.name!, code: parsed.data.code! } });
    refresh();
    return { ok: true, branch };
  } catch (e) {
    return fail(e);
  }
}

/** `id` is the branch code ("perumbavoor"), the id the portal uses everywhere. The code itself is not editable. */
export async function updateBranch(id: string, formData: FormData): Promise<BranchResult> {
  formData.delete("code");
  const parsed = parseBranchInput(formData, true);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const branch = await prisma.branch.update({ where: { code: id }, data: { ...parsed.data, name: parsed.data.name ?? undefined } });
    refresh();
    return { ok: true, branch };
  } catch (e) {
    return fail(e);
  }
}

/** Soft delete: flips `isActive` so claims and stock that point at the branch keep resolving. */
export async function toggleBranchStatus(id: string): Promise<BranchResult> {
  try {
    const current = await prisma.branch.findUnique({ where: { code: id }, select: { isActive: true } });
    if (!current) return { ok: false, error: "Branch not found" };
    const branch = await prisma.branch.update({ where: { code: id }, data: { isActive: !current.isActive } });
    refresh();
    return { ok: true, branch };
  } catch (e) {
    return fail(e);
  }
}
