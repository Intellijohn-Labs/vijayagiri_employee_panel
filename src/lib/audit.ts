import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sessionEmployee } from "@/lib/session";

export interface AuditEntry {
  action: string;
  entity: "employee" | "branch" | "claim" | "auth";
  entityId?: string;
  /** Showroom code the action relates to */
  branchId?: string | null;
  details?: Record<string, unknown>;
  /** For sign-ins, where nobody has a session yet */
  actor?: { email: string | null; name: string };
}

const clientIp = async () => {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
};

/** Records an action with the signed-in actor, time and IP. Never throws: a failed log must not undo or block the action itself. */
export async function logAudit(entry: AuditEntry) {
  try {
    const me = entry.actor ? null : await sessionEmployee();
    await prisma.auditLog.create({
      data: {
        actorEmail: entry.actor?.email ?? me?.email ?? "unknown",
        actorName: entry.actor?.name ?? me?.name ?? "Unknown",
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        branchId: entry.branchId ?? undefined,
        ip: await clientIp(),
        details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    /* auditing is best-effort */
  }
}
