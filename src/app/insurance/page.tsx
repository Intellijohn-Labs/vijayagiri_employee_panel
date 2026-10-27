"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, SearchX, ShieldCheck } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { useVisiblePolicies } from "@/store/insurance-store";
import { policyStatus, type Policy } from "@/lib/insurance";
import { branchLabel } from "@/lib/branches";
import { stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Select } from "@/components/ui/popover";
import { Card, Input, PageHeader } from "@/components/ui/primitives";
import { PolicyDrawer } from "@/components/insurance/policy-drawer";
import { PolicyRow } from "@/components/insurance/policy-row";

type View = "all" | "active" | "expiring" | "pending";

/** Which tab(s) a policy belongs to. "Active" is every policy still in force, so Expiring Soon is a subset of it. */
const inView = (p: Policy, v: View) => {
  const { status } = policyStatus(p);
  if (v === "all") return true;
  if (v === "active") return status === "active" || status === "expiring" || (status === "renewal" && policyStatus(p).days! >= 0);
  if (v === "expiring") return status === "expiring" || status === "renewal";
  return status === "pending";
};

export default function InsurancePage() {
  const policies = useVisiblePolicies();
  const { branches } = useBranchTools();

  const [view, setView] = useState<View>("all");
  const [showroom, setShowroom] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Policy | null>(null);
  const [open, setOpen] = useState(false);

  const inShowroom = useMemo(() => (showroom === "all" ? policies : policies.filter((p) => p.branchId === showroom)), [policies, showroom]);
  const tabs = useMemo(
    () => [
      { value: "all" as View, label: "All Policies", count: inShowroom.length },
      { value: "active" as View, label: "Active Policies", count: inShowroom.filter((p) => inView(p, "active")).length },
      { value: "expiring" as View, label: "Expiring Soon (30 days)", count: inShowroom.filter((p) => inView(p, "expiring")).length },
      { value: "pending" as View, label: "Pending Issuance", count: inShowroom.filter((p) => inView(p, "pending")).length },
    ],
    [inShowroom],
  );
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return inShowroom
      .filter((p) => inView(p, view) && (!t || `${p.customer} ${p.phone} ${p.modelName} ${p.chassisNo} ${p.engineNo} ${p.regNo} ${p.policyNo} ${p.partner}`.toLowerCase().includes(t)))
      .sort((a, z) => {
        // Most urgent first: lapsed or about to lapse, then the rest by end date.
        const da = policyStatus(a).days ?? 9999;
        const dz = policyStatus(z).days ?? 9999;
        return da - dz || z.createdAt - a.createdAt;
      });
  }, [inShowroom, view, q]);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Insurance Hub"
        description="Every customer's two-wheeler insurance in one place: policies, validity, documents and renewal reminders."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]" leading={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>
              Add Policy
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <PillTabs id="ins-view" label="Filter policies" value={view} onChange={setView} tabs={tabs} />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, phone, chassis, policy…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search policies" />
        </div>
        <div className="w-full sm:w-72 [&>div]:flex [&>div]:w-full">
          <Select<string> value={showroom} onChange={setShowroom} options={[{ value: "all", label: "All Showrooms" }, ...branches.map((b) => ({ value: b.id, label: branchLabel(b) }))]} />
        </div>
      </div>

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">{policies.length ? <SearchX className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</span>
          <p className="text-sm font-medium text-fg">{policies.length ? "No policies match" : "No insurance records yet"}</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">{policies.length ? "Try another filter, showroom or search." : "Add a policy for a booked or delivered vehicle."}</p>
          {!policies.length && (
            <div className="mt-4 flex gap-2">
              <Button variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]" leading={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>
                Add Policy
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((p) => (
              <PolicyRow
                key={p.id}
                policy={p}
                onEdit={() => {
                  setEditing(p);
                  setOpen(true);
                }}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <PolicyDrawer policy={editing} presetBranch={showroom === "all" ? undefined : showroom} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
