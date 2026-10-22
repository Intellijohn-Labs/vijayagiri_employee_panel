"use client";

import { useEffect } from "react";
import { useClaims } from "@/store/claims-store";
import { useSlaConfig } from "@/store/sla-config-store";
import { canAccess, useSessionEmployee } from "@/store/employee-store";
import { toast } from "@/store/toast-store";

/**
 * Raises each SLA breach once: stamps it on the claim's activity log and tells the signed-in employee.
 * A lapse on a stage whose rule escalates (Stage 6 by default) is the Top Management red alert. Mounted once, in the app shell.
 */
export function ClaimsWatcher() {
  const hydrated = useClaims((s) => s.hydrated);
  const sweep = useClaims((s) => s.sweep);
  const me = useSessionEmployee();
  const hydrateSla = useSlaConfig((s) => s.hydrate);

  useEffect(hydrateSla, [hydrateSla]);

  useEffect(() => {
    if (!hydrated) return;
    const run = () => {
      const mine = sweep().filter((f) => canAccess(me, f.claim.branchId));
      if (!mine.length) return;
      const tops = mine.filter((f) => f.topManagement);
      if (tops.length) toast.error("TOP MANAGEMENT RED ALERT", tops.map((f) => `${f.claim.claimNo || f.claim.ref} (${f.label})`).join(", "), { duration: 9000 });
      const rest = mine.length - tops.length;
      if (rest) toast.warning(`${rest} claim${rest === 1 ? "" : "s"} breached an SLA`, "Open Claims & Workshop to see the red alerts.");
    };
    run();
    const t = setInterval(run, 15_000);
    // New SLA thresholds can make claims overdue straight away, so check as soon as they are saved.
    const unsubscribe = useSlaConfig.subscribe(run);
    return () => {
      clearInterval(t);
      unsubscribe();
    };
  }, [hydrated, sweep, me]);

  return null;
}
