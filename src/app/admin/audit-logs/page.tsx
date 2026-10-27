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
  { value: "Claim", label: "Claims" },
  { value: "Employee", label: "Employees" },
  { value: "Branch", label: "Branches" },
  { value: "Auth", label: "Sign-ins" },
];

const tone = (action: string) =>
  action.includes("DELETED") ? "danger" : /FAILED|LOCKED|DEACTIVATED/.test(action) ? "warn" : action.includes("CREATED") ? "ok" : /STAGE|DELIVERED/.test(action) ? "accent" : "neutral";

/** "STAGE_CHANGED" -> "Stage changed" */
const label = (action: string) => {
  const t = action.toLowerCase().replace(/_/g, " ");
  return `${t[0].toUpperCase()}${t.slice(1)}`;
};

const summary = (d: AuditRow["details"]) =>
  d
    ? Object.entries(d)
        .map(([k, v]) => `${k}: ${v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v).map(([f, c]) => `${f} ${c}`).join("; ") || "no changes" : Array.isArray(v) ? v.join(", ") : String(v)}`)
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action or showroom…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search audit log" />
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
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="border-b border-line bg-fg/[0.025] text-[11px] font-medium uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top transition-colors hover:bg-hover/60">
                    <td className="whitespace-nowrap px-5 py-4 tabular-nums text-muted">{fmtDateTime(r.at)}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-fg">{r.actorName}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-faint">{r.actor}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <Badge tone={tone(r.action)}>{label(r.action)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted">{r.entity}</td>
                    <td className="max-w-[380px] px-5 py-4 leading-5 text-muted">
                      {summary(r.details) || "—"}
                      {r.branchId && <span className="mt-0.5 block text-[11.5px] text-faint">Showroom: {r.branchId}</span>}
                    </td>
                  </tr>
                ))}
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted">
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
