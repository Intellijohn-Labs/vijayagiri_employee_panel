"use client";

import { useEffect } from "react";
import { useClaims } from "@/store/claims-store";
import { canAccess, useSessionEmployee } from "@/store/employee-store";
import { toast } from "@/store/toast-store";

/**
 * Raises each SLA breach once: stamps it on the claim's activity log and tells the signed-in employee.
 * A Stage 6 lapse is the Top Management red alert. Mounted once, in the app shell.
 */
export function ClaimsWatcher() {
  const hydrated = useClaims((s) => s.hydrated);
  const sweep = useClaims((s) => s.sweep);
  const me = useSessionEmployee();

  useEffect(() => {
    if (!hydrated) return;
    const run = () => {
      const mine = sweep().filter((f) => canAccess(me, f.claim.branchId));
      if (!mine.length) return;
      const tops = mine.filter((f) => f.topManagement);
      if (tops.length) toast.error("TOP MANAGEMENT RED ALERT", `${tops.map((f) => f.claim.claimNo || f.claim.ref).join(", ")} — 12-hour dispatch SLA lapsed.`, { duration: 9000 });
      const rest = mine.length - tops.length;
      if (rest) toast.warning(`${rest} claim${rest === 1 ? "" : "s"} breached an SLA`, "Open Claims & Workshop to see the red alerts.");
    };
    run();
    const t = setInterval(run, 15_000);
    return () => clearInterval(t);
  }, [hydrated, sweep, me]);

  return null;
}
