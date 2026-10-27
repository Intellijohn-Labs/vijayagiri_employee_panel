"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, RefreshCw, ScrollText, Search } from "lucide-react";
import { getAuditLogs, type AuditRow } from "@/actions/audit";
import { isRootEmail } from "@/lib/employees";
import { useSessionEmployee } from "@/store/employee-store";
import { fmtDateTime } from "@/lib/claims";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Badge, Card, Input, PageHeader } from "@/components/ui/primitives";

const ENTITIES = [
  { value: "all", label: "Everything" },
  { value: "claim", label: "Claims" },
  { value: "employee", label: "Employees" },
  { value: "branch", label: "Branches" },
  { value: "auth", label: "Sign-ins" },
];

const tone = (action: string) => (action.endsWith("delete") ? "danger" : action.includes("failed") || action.includes("locked") || action.includes("deactivate") ? "warn" : action.endsWith("create") ? "ok" : action.startsWith("claim.stage") || action.endsWith("delivered") ? "accent" : "neutral");

/** "claim.stage_change" -> "Claim · stage change" */
const label = (action: string) => {
  const [entity, rest = ""] = action.split(".");
  return `${entity[0].toUpperCase()}${entity.slice(1)} · ${rest.replace(/_/g, " ")}`;
};

const summary = (d: AuditRow["details"]) =>
  d
    ? Object.entries(d)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join(" · ")
    : "";

export default function AuditLogsPage() {
  const me = useSessionEmployee();
  const root = isRootEmail(me?.email);
  const [entity, setEntity] = useState("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const run = useRef(0);

  /** `append` loads the next (older) page; otherwise the list starts again from the newest. */
  const load = useCallback(
    async (append: boolean, before?: number) => {
      const mine = ++run.current;
      setLoading(true);
      const res = await getAuditLogs({ entity, q, before }).catch(() => null);
      if (mine !== run.current) return;
      setLoading(false);
      if (!res) return setError("Could not reach the server. Please try again.");
      if (!res.ok) return setError(res.error);
      setError("");
      setRows((cur) => (append ? [...cur, ...res.rows] : res.rows));
      setMore(res.more);
    },
    [entity, q],
  );

  useEffect(() => {
    if (!root) return;
    const t = setTimeout(() => void load(false), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [root, load, q]);

  if (me && !root) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-sm font-medium text-fg">Audit logs are for the root admin only</h1>
        <p className="mt-1 text-[13px] text-muted">Unauthorized: Root admin access required.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Who did what, and when: sign-ins, employee and branch changes, claim creation, stage moves and deletions."
        actions={
          <Button leading={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void load(false)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, showroom or IP…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search audit log" />
        </div>
        <PillTabs id="audit-entity" label="Filter by area" value={entity} onChange={setEntity} tabs={ENTITIES} size="sm" />
      </div>

      {error && (
        <Card className="mb-4 border-red-500/40 px-4 py-3 text-[13px] text-fg">
          {error}
        </Card>
      )}

      {rows.length === 0 && !loading && !error ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
            <ScrollText className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-fg">No activity recorded</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">{q || entity !== "all" ? "Nothing matches these filters." : "Actions are logged from now on."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-line bg-fg/[0.025] text-[11px] font-medium uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Who</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Details</th>
                  <th className="px-4 py-2.5">Showroom</th>
                  <th className="px-4 py-2.5">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top transition-colors hover:bg-hover/60">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{fmtDateTime(r.at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{r.actorName}</p>
                      <p className="font-mono text-[11px] text-faint">{r.actorEmail}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={tone(r.action)}>{label(r.action)}</Badge>
                    </td>
                    <td className="max-w-[340px] px-4 py-3 text-muted">{summary(r.details) || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{r.branchId ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] text-faint">{r.ip ?? "—"}</td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {more && (
        <div className="mt-5 flex justify-center">
          <Button loading={loading} onClick={() => void load(true, rows[rows.length - 1]?.at)}>
            Show older entries
          </Button>
        </div>
      )}
    </>
  );
}
