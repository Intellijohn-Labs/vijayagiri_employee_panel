"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Clock, Copy, MapPin, MessageCircle, Navigation, Pencil, Phone, PhoneOff, Plus, Store, UserRound } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useStock } from "@/store/stock-store";
import { STATUS_SHORT } from "@/lib/stock-options";
import { StockThumb } from "@/components/stock/stock-thumb";
import { toast } from "@/store/toast-store";
import { branchLabel } from "@/lib/branches";
import type { Branch } from "@/lib/branches";
import { useBranch, useBranchStore, useBranchTools } from "@/store/branch-store";
import { intlDigits, useIsAdmin } from "@/store/employee-store";
import { isOpenNow, useSettings } from "@/store/settings-store";
import { EditBranchDrawer } from "@/components/branches/edit-branch-drawer";
import { AddBranchDrawer } from "@/components/branches/add-branch-drawer";
import { cn } from "@/lib/utils";
import { fadeUp, spring, stagger } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";

const mapsUrl = (b: Branch) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name}, ${b.address}`)}`;

/** Open (green dot) while the branch's hours say so, otherwise Closed (grey dot). A branch the Admin marked Closed stays Closed. */
function StatusBadge({ branch }: { branch: Pick<Branch, "status" | "hours"> }) {
  const now = useApp((s) => s.now);
  const profile = useSettings((st) => st.settings.profile);
  const open = isOpenNow(branch, now || Date.now(), profile);
  return (
    <Badge tone={open ? "ok" : "neutral"} dot>
      {open ? "Open" : "Closed"}
    </Badge>
  );
}

/** Call is only live once a real number is on file; until then the control is visibly disabled. */
function CallLink({ branch, className }: { branch: Branch; className?: string }) {
  return branch.dial ? (
    <a href={`tel:${branch.dial}`} aria-label={`Call ${branch.name}`} title={`Call ${branch.dial}`} className={cn("grid h-7 w-7 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-hover hover:text-accent-text focus-visible:bg-hover", className)}>
      <Phone className="h-3.5 w-3.5" />
    </a>
  ) : (
    <span aria-label="Phone number not added yet" title="Phone number not added yet" className={cn("grid h-7 w-7 cursor-not-allowed place-items-center rounded-md text-faint/60", className)}>
      <PhoneOff className="h-3.5 w-3.5" />
    </span>
  );
}

function DirectionsLink({ branch }: { branch: Branch }) {
  return (
    <a href={mapsUrl(branch)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${branch.name}`} title="Open directions in Google Maps" className="grid h-7 w-7 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-hover hover:text-accent-text focus-visible:bg-hover">
      <Navigation className="h-3.5 w-3.5" />
    </a>
  );
}

/** Admin-only switch that deactivates a showroom (hidden from pickers and lists) or brings it back. */
function ActiveToggle({ branch }: { branch: Branch }) {
  const toggleActive = useBranchStore((s) => s.toggleActive);
  const [busy, setBusy] = useState(false);
  const active = branch.isActive !== false;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${active ? "Deactivate" : "Activate"} ${branch.name}`}
      title={active ? "Active — click to deactivate" : "Inactive — click to activate"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const error = await toggleActive(branch.id);
        setBusy(false);
        if (error) toast.error("Couldn't update the showroom", error);
        else toast.success(active ? "Showroom deactivated" : "Showroom activated", branch.name);
      }}
      className={cn("relative h-5 w-9 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50", active ? "bg-emerald-500" : "bg-slate-400/60")}
    >
      <span className={cn("absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", active && "translate-x-4")} />
    </button>
  );
}

function BranchCard({ branch, canEdit, onDetails, onEdit }: { branch: Branch; /** Admins only — everyone else gets the view-only card */ canEdit: boolean; onDetails: () => void; onEdit: () => void }) {
  const hq = branch.kind === "hq";
  const Icon = hq ? Building2 : Store;
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={spring} className="h-full">
      <Card className={cn("flex h-full flex-col overflow-hidden transition-[border-color,box-shadow] duration-200 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/10", hq && "border-accent/30", branch.isActive === false && "opacity-60")}>
        {hq && <div className="hairline-top h-px w-full" />}
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", hq ? "border-accent/30 bg-tint text-accent-text" : "border-line bg-canvas text-muted")}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-5 tracking-tight text-fg">{branch.name}</h3>
            <p className="mt-0.5 text-[13px] text-muted">{branch.city}</p>
          </div>
          <StatusBadge branch={branch} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
          {hq ? (
            <Badge tone="accent" className="bg-accent text-accent-fg ring-0">
              Head Office &amp; Central Yard
            </Badge>
          ) : (
            <Badge>Sub-Branch</Badge>
          )}
          <span className="inline-flex items-center gap-1 text-[11.5px] text-faint">
            <Clock className="h-3 w-3" /> {branch.hours}{branch.days ? ` · ${branch.days}` : ""}
          </span>
        </div>

        <ul className="space-y-2.5 px-5 pt-4 text-[13px]">
          <li className="flex gap-2.5 text-fg">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <span className="leading-5">{branch.address}</span>
          </li>
          <li className="flex items-center gap-2.5 text-fg">
            <Phone className="h-4 w-4 shrink-0 text-faint" />
            <span className="tabular">{branch.phone}</span>
          </li>
          <li className="flex items-center gap-2.5 text-muted">
            <UserRound className="h-4 w-4 shrink-0 text-faint" />
            <span>{branch.manager}</span>
          </li>
          {branch.role && (
            <li className="pt-0.5">
              <span className="inline-flex rounded-md bg-tint px-2 py-1 text-xs font-medium text-accent-text">{branch.role}</span>
            </li>
          )}
        </ul>

        <div className="mt-auto flex items-center gap-2 px-5 pb-5 pt-5">
          <Button size="sm" onClick={onDetails}>
            View Branch Details
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" leading={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit} aria-label={`Edit details for ${branchLabel(branch)}`}>
              Edit Details
            </Button>
          )}
          {canEdit && <ActiveToggle branch={branch} />}
          <span className="ml-auto flex items-center gap-0.5">
            <CallLink branch={branch} />
            <DirectionsLink branch={branch} />
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 text-faint">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 text-[13px] leading-5 text-fg">{children}</dd>
      </div>
    </div>
  );
}

function BranchDrawer({ branch, canEdit, open, onClose, onEdit }: { branch: Branch | null; canEdit: boolean; open: boolean; onClose: () => void; onEdit: () => void }) {
  const allEntries = useStock((s) => s.entries);
  if (!branch) return null;
  const stock = allEntries.filter((e) => e.branchId === branch.id);
  const hq = branch.kind === "hq";
  return (
    <Drawer open={open} onClose={onClose} width={480} title={branch.name} description={branchLabel(branch)}>
      <div className="px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          {hq ? (
            <Badge tone="accent" className="bg-accent text-accent-fg ring-0">
              Head Office &amp; Central Yard
            </Badge>
          ) : (
            <Badge>Sub-Branch</Badge>
          )}
          <StatusBadge branch={branch} />
        </div>

        <dl className="mt-3 divide-y divide-line">
          <DetailRow icon={<MapPin className="h-4 w-4" />} label="Address">
            {branch.address}
          </DetailRow>
          <DetailRow icon={<Phone className="h-4 w-4" />} label="Contact">
            <span className="tabular">{branch.phone}</span>
            {!branch.dial && <span className="block text-xs text-faint">Direct number not added yet</span>}
          </DetailRow>
          {branch.whatsapp && (
            <DetailRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp">
              <a href={`https://wa.me/${intlDigits(branch.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="tabular outline-none hover:underline focus-visible:underline">
                {branch.whatsapp}
              </a>
            </DetailRow>
          )}
          <DetailRow icon={<UserRound className="h-4 w-4" />} label="Manager">
            {branch.manager}
          </DetailRow>
          <DetailRow icon={<Clock className="h-4 w-4" />} label="Opening hours">
            {branch.hours}
            {branch.days && <span className="block text-muted">{branch.days}</span>}
          </DetailRow>
          {branch.role && (
            <DetailRow icon={<Building2 className="h-4 w-4" />} label="Role">
              {branch.role}
            </DetailRow>
          )}
        </dl>

        <section className="mt-6">
          <h3 className="mb-2 flex items-center justify-between text-[13px] font-semibold text-fg">
            Stock added here
            <span className="tabular text-xs font-normal text-muted">
              {stock.length} {stock.length === 1 ? "unit" : "units"}
            </span>
          </h3>
          {stock.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-xs text-faint">Nothing has been added to this showroom yet. Use Add Stock to take vehicles in.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {stock.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                  <StockThumb entry={e} size={44} />
                  <div className="min-w-0 flex-1 leading-4">
                    <p className="truncate text-[13px] font-medium text-fg">
                      {e.modelName} <span className="font-normal text-muted">· {e.variant}</span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-faint">{e.chassisNo}</p>
                  </div>
                  <Badge tone={e.status === "Pre-Booked" ? "warn" : e.status === "In Stock / Yard Ready" ? "accent" : "info"} dot>
                    {STATUS_SHORT[e.status]}
                  </Badge>
                </li>
              ))}
              {stock.length > 8 && <li className="px-3 py-2 text-center text-xs text-faint">+ {stock.length - 8} more</li>}
            </ul>
          )}
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          {branch.dial ? (
            <a href={`tel:${branch.dial}`}>
              <Button variant="primary" leading={<Phone className="h-3.5 w-3.5" />}>
                Call
              </Button>
            </a>
          ) : (
            <Button variant="primary" disabled leading={<PhoneOff className="h-3.5 w-3.5" />}>
              Call
            </Button>
          )}
          <a href={mapsUrl(branch)} target="_blank" rel="noopener noreferrer">
            <Button leading={<Navigation className="h-3.5 w-3.5" />}>Directions</Button>
          </a>
          {canEdit && (
            <Button leading={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
              Edit Details
            </Button>
          )}
          <Button
            leading={<Copy className="h-3.5 w-3.5" />}
            onClick={() => {
              navigator.clipboard?.writeText(branch.address).then(
                () => toast.success("Address copied"),
                () => toast.error("Couldn't copy the address"),
              );
            }}
          >
            Copy address
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

export default function BranchesPage() {
  const scope = useApp((s) => s.branchScope);
  const setBranchScope = useApp((s) => s.setBranchScope);
  const { branches: BRANCHES, all: allBranches, byId: branchById } = useBranchTools();
  // Ids, not snapshots: the drawers read the live branch, so a saved edit shows up straight away.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [lastDetailsId, setLastDetailsId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [lastEditId, setLastEditId] = useState<string | null>(null);
  const lastDetails = useBranch(lastDetailsId) ?? null;
  const isAdmin = useIsAdmin();
  const loading = useBranchStore((s) => s.loading);
  const [adding, setAdding] = useState(false);

  const selected = branchById(scope);
  // Admins also see deactivated showrooms here (dimmed) so they can switch them back on.
  const shown = selected ? [selected] : isAdmin ? allBranches : BRANCHES;
  const startEdit = (id: string) => {
    if (!isAdmin) return void toast.error("Unauthorized: Only Admins can modify branch details.");
    setDetailsId(null);
    setLastEditId(id);
    setEditId(id);
  };

  return (
    <>
      <PageHeader
        title="Branches"
        description={selected ? `Showing ${branchLabel(selected)}.` : BRANCHES.length < allBranches.length ? `${BRANCHES.length} showroom${BRANCHES.length === 1 ? "" : "s"} you can access.` : `Head Office and ${BRANCHES.length - 1} sub-branches across Ernakulam.`}
        actions={
          <>
            {isAdmin && (
              <Button variant="primary" leading={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
                Add Showroom
              </Button>
            )}
          <AnimatePresence>
            {selected && (
              <motion.div initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <Button onClick={() => setBranchScope("all")}>Show all branches</Button>
              </motion.div>
            )}
          </AnimatePresence>
          </>
        }
      />
      {loading && <div className="mb-3 h-1 animate-pulse rounded bg-hover" aria-busy />}

      <motion.div key={scope} variants={stagger(0.07)} initial="hidden" animate="show" className={cn("grid gap-4", selected ? "max-w-xl" : "lg:grid-cols-2 2xl:grid-cols-3")}>
        {shown.map((b) => (
          <BranchCard
            key={b.id}
            branch={b}
            canEdit={isAdmin}
            onDetails={() => {
              setLastDetailsId(b.id);
              setDetailsId(b.id);
            }}
            onEdit={() => startEdit(b.id)}
          />
        ))}
      </motion.div>

      <BranchDrawer branch={lastDetails} canEdit={isAdmin} open={detailsId !== null} onClose={() => setDetailsId(null)} onEdit={() => lastDetails && startEdit(lastDetails.id)} />
      {isAdmin && <AddBranchDrawer open={adding} onClose={() => setAdding(false)} />}
      {isAdmin && <EditBranchDrawer branchId={lastEditId} open={editId !== null} onClose={() => setEditId(null)} />}
    </>
  );
}
