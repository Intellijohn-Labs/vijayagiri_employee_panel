"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Plus, Search, SearchX, UserPlus, Users } from "lucide-react";
import { canAccess, useEmployees, useSessionEmployee, type Employee, type EmployeeRole } from "@/store/employee-store";
import { useAllBranches } from "@/store/branch-store";
import { branchLabel } from "@/lib/branches";
import { toast } from "@/store/toast-store";
import { stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/popover";
import { Card, Input, PageHeader } from "@/components/ui/primitives";
import { PillTabs } from "@/components/ui/pill-tabs";
import { EmployeeCard } from "@/components/employees/employee-card";
import { EmployeeDrawer } from "@/components/employees/employee-drawer";

type RoleFilter = "all" | EmployeeRole;
type StatusFilter = "all" | "Active" | "Inactive";

const ROLE_TABS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All Roles" },
  { value: "Admin", label: "Admin" },
  { value: "Showroom Manager", label: "Showroom Manager" },
  { value: "Sales Executive", label: "Sales" },
  { value: "Inventory Officer", label: "Yard / Stock" },
];

export default function EmployeesPage() {
  const me = useSessionEmployee();
  const employees = useEmployees((s) => s.employees);
  const toggleStatus = useEmployees((s) => s.toggle);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showroom, setShowroom] = useState("all");
  const branches = useAllBranches();
  // Keep the form's employee after closing so the drawer doesn't go blank while it slides out.
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  /** Showroom to pre-tick when the drawer opens from an empty showroom's "Assign Employee" button. */
  const [preset, setPreset] = useState<string | undefined>();

  /** Everyone who can see a showroom: people assigned to it plus central admins with all-showroom access. */
  const tabs = useMemo(
    () => [
      { value: "all", label: "All Employees", count: employees.length },
      ...branches.map((b) => ({ value: b.id, label: branchLabel(b), count: employees.filter((e) => canAccess(e, b.id)).length })),
    ],
    [employees, branches],
  );
  const inShowroom = useMemo(() => (showroom === "all" ? employees : employees.filter((e) => canAccess(e, showroom))), [employees, showroom]);
  const showroomName = branches.find((b) => b.id === showroom);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inShowroom.filter((e) => (role === "all" || e.role === role) && (status === "all" || e.status === status) && (!term || `${e.name} ${e.email} ${e.code} ${e.phone} ${e.whatsapp} ${e.role}`.toLowerCase().includes(term)));
  }, [inShowroom, q, role, status]);
  const counts = useMemo(() => ({ active: employees.filter((e) => e.status === "Active").length, inactive: employees.filter((e) => e.status === "Inactive").length }), [employees]);

  /** Deactivating is the "delete": the record stays, but the person can no longer sign in. The server enforces the last-Admin and own-account rules. */
  const toggle = async (e: Employee) => {
    const error = await toggleStatus(e.id);
    if (error) return void toast.error("Couldn't update the employee", error);
    const next = e.status === "Active" ? "Inactive" : "Active";
    toast.success(`${e.name} ${next === "Active" ? "activated" : "deactivated"}`, next === "Active" ? "They can sign in again." : "They can no longer sign in.");
  };

  if (me && me.role !== "Admin") {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-sm font-medium text-fg">Employees is for Admins only</h1>
        <p className="mt-1 text-[13px] text-muted">Ask an Admin if you need someone added or changed.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${counts.active} active${counts.inactive ? ` · ${counts.inactive} inactive` : ""}. Only the emails listed here can sign in to the web app.`}
        actions={
          <Button
            variant="primary"
            className="bg-[#003399] text-white hover:bg-[#0047AB]"
            leading={<Plus className="h-3.5 w-3.5" />}
            onClick={() => {
              setEditing(null);
              setPreset(showroom === "all" ? undefined : showroom);
              setOpen(true);
            }}
          >
            + Add Employee
          </Button>
        }
      />

      <div className="mb-4">
        <PillTabs id="emp-showroom" label="Filter by showroom" value={showroom} onChange={setShowroom} tabs={tabs} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="w-full sm:w-72">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or role…" leading={<Search className="h-3.5 w-3.5" />} aria-label="Search employees" />
        </div>
        <div className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
          <PillTabs id="emp-role" label="Filter by role" value={role} onChange={setRole} tabs={ROLE_TABS} size="sm" />
        </div>
        <div className="w-full sm:w-40 [&>div]:flex [&>div]:w-full">
          <Select<StatusFilter> value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          {showroomName && inShowroom.length === 0 ? (
            <>
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
                <Users className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-fg">No employees currently assigned to {branchLabel(showroomName)}.</p>
              <p className="mt-1 max-w-sm text-[13px] text-muted">Add someone and tick this showroom to give them access.</p>
              <Button
                variant="primary"
                className="mt-4 bg-[#003399] text-white hover:bg-[#0047AB]"
                leading={<UserPlus className="h-3.5 w-3.5" />}
                onClick={() => {
                  setEditing(null);
                  setPreset(showroomName.id);
                  setOpen(true);
                }}
              >
                + Assign Employee
              </Button>
            </>
          ) : (
            <>
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">{employees.length ? <SearchX className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>
              <p className="text-sm font-medium text-fg">{employees.length ? "No employees match" : "No employees yet"}</p>
              <p className="mt-1 max-w-sm text-[13px] text-muted">{employees.length ? "Try a different search or clear the filters." : "Add the first employee to let them sign in."}</p>
            </>
          )}
        </Card>
      ) : (
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((e) => (
              <EmployeeCard
                key={e.id}
                employee={e}
                isYou={e.id === me?.id}
                onEdit={() => {
                  setEditing(e);
                  setOpen(true);
                }}
                onToggle={() => void toggle(e)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <EmployeeDrawer employee={editing} presetBranch={preset} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
