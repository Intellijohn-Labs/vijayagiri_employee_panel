"use client";

import { useState } from "react";
import { Building2, Check, ChevronDown, Crown, MapPin, Search, Store } from "lucide-react";
import { useApp } from "@/store/app-store";
import { addressTail, branchLabel, branchTitle } from "@/lib/branches";
import { useBranchTools } from "@/store/branch-store";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/ui/popover";

const rowCls = "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-tint focus-visible:bg-tint";

/** Chooses which branch the Branches view shows: all of them, or one. The choice persists across refreshes. */
export function BranchSwitcher() {
  const scope = useApp((s) => s.branchScope);
  const setBranchScope = useApp((s) => s.setBranchScope);
  const [q, setQ] = useState("");
  const { branches: BRANCHES, all, byId: branchById } = useBranchTools();
  const restricted = BRANCHES.length < all.length;

  const current = branchById(scope);
  const label = current ? branchLabel(current) : restricted ? "All My Showrooms" : "All Branches";
  const term = q.trim().toLowerCase();
  const list = BRANCHES.filter((b) => !term || `${b.name} ${b.short} ${b.city} ${b.address}`.toLowerCase().includes(term));
  const showAll = !term || "all branches consolidated head office hq".includes(term);

  return (
    <Popover
      align="end"
      width={432}
      className="!p-0"
      onOpenChange={(o) => o && setQ("")}
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Branch: ${label}. Change branch`}
          className={cn("flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] shadow-card outline-none transition-colors hover:border-strong", open && "border-accent/50 shadow-ring")}
        >
          <Building2 className={cn("h-3.5 w-3.5 shrink-0", current ? "text-accent-text" : "text-muted")} />
          <span className="hidden max-w-[120px] truncate font-medium text-fg sm:inline md:max-w-[220px]">{label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-faint transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {({ close }) => {
        const pick = (id: string) => {
          close();
          setBranchScope(id);
        };
        return (
          <div role="listbox" aria-label="Choose branch" className="flex max-h-[min(560px,calc(100dvh-90px))] flex-col">
            <div className="relative border-b border-line">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search branch or town…" aria-label="Search branches" className="h-11 w-full bg-transparent pl-10 pr-3 text-[13px] text-fg outline-none placeholder:text-faint" style={{ boxShadow: "none" }} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {showAll && (
                <>
                  <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">Network</p>
                  <button role="option" aria-selected={scope === "all"} onClick={() => pick("all")} className={cn(rowCls, scope === "all" && "bg-tint")}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-tint text-accent-text">
                      <Crown className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 leading-4">
                      <span className="block truncate text-[13px] font-medium text-fg group-hover:text-accent-text">{restricted ? "All My Showrooms" : "All Branches"}</span>
                      <span className="block truncate text-[11.5px] text-muted">{restricted ? `${BRANCHES.length} showroom${BRANCHES.length === 1 ? "" : "s"} you can access` : `Head Office and ${BRANCHES.length - 1} sub-branches`}</span>
                    </span>
                    <span className="grid h-4 w-4 shrink-0 place-items-center">{scope === "all" && <Check className="h-3.5 w-3.5 text-accent-text" />}</span>
                  </button>
                </>
              )}
              {list.length > 0 && (
                <>
                  <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">Branches</p>
                  {list.map((b) => {
                    const active = scope === b.id;
                    const hq = b.kind === "hq";
                    return (
                      <button key={b.id} role="option" aria-selected={active} onClick={() => pick(b.id)} className={cn(rowCls, active && "bg-tint")}>
                        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", hq ? "border-accent/30 bg-tint text-accent-text" : "border-line bg-canvas text-muted group-hover:text-accent-text")}>
                          {hq ? <Building2 className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1 leading-4">
                          <span className="block truncate text-[13px] font-medium text-fg group-hover:text-accent-text">{hq ? branchTitle(b) : b.name}</span>
                          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-fg/[0.06] px-1.5 text-[10.5px] font-medium text-muted">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{hq ? "Head Office" : b.city} · {addressTail(b)}</span>
                          </span>
                        </span>
                        <span className="grid h-4 w-4 shrink-0 place-items-center">{active && <Check className="h-3.5 w-3.5 text-accent-text" />}</span>
                      </button>
                    );
                  })}
                </>
              )}
              {!showAll && list.length === 0 && <p className="px-3 py-10 text-center text-xs text-faint">No branch matches “{q}”</p>}
            </div>
          </div>
        );
      }}
    </Popover>
  );
}
