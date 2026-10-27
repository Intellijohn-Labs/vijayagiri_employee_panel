"use server";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { UNAUTHORIZED_ROOT, rootSession } from "@/lib/session";

export interface AuditRow {
  id: string;
  at: number;
  actorEmail: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | null;
  branchId: string | null;
  ip: string | null;
  details: Record<string, unknown> | null;
}

const PAGE = 50;

/** One page of the audit trail, newest first. Root admin only. */
export async function getAuditLogs(opts: { entity?: string; q?: string; before?: number } = {}): Promise<{ ok: true; rows: AuditRow[]; more: boolean } | { ok: false; error: string }> {
  if (!(await rootSession())) return { ok: false, error: UNAUTHORIZED_ROOT };
  const q = opts.q?.trim();
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.entity && opts.entity !== "all" ? { entity: opts.entity } : {}),
    ...(opts.before ? { at: { lt: new Date(opts.before) } } : {}),
    ...(q ? { OR: [{ actorEmail: { contains: q, mode: "insensitive" } }, { actorName: { contains: q, mode: "insensitive" } }, { action: { contains: q, mode: "insensitive" } }, { branchId: { contains: q, mode: "insensitive" } }, { ip: { contains: q } }] } : {}),
  };
  const rows = await prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, take: PAGE + 1 });
  return {
    ok: true,
    more: rows.length > PAGE,
    rows: rows.slice(0, PAGE).map((r) => ({ id: r.id, at: r.at.getTime(), actorEmail: r.actorEmail, actorName: r.actorName, action: r.action, entity: r.entity, entityId: r.entityId, branchId: r.branchId, ip: r.ip, details: (r.details as Record<string, unknown> | null) ?? null })),
  };
}
