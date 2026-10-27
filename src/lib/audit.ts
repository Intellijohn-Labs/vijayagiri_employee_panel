import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sessionEmployee } from "@/lib/session";

export interface AuditEntry {
  action: string;
  entity: "Employee" | "Branch" | "Claim" | "Auth";
  entityId?: string;
  /** Showroom code the action relates to */
  branchId?: string | null;
  details?: Record<string, unknown>;
  /** For sign-ins, where nobody has a session yet */
  actor?: { email: string | null; name: string };
}

/** Records an action with the signed-in actor and time. No IP address is captured. Never throws: a failed log must not undo or block the action itself. */
export async function logAudit(entry: AuditEntry) {
  try {
    const me = entry.actor ? null : await sessionEmployee();
    await prisma.auditLog.create({
      data: {
        actor: entry.actor?.email ?? me?.email ?? "unknown",
        actorName: entry.actor?.name ?? me?.name ?? "Unknown",
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        branchId: entry.branchId ?? undefined,
        details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    /* auditing is best-effort */
  }
}
