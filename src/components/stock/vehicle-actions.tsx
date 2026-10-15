"use client";

import { ArrowRightLeft, CheckCircle2, PackageCheck } from "lucide-react";
import { useColourHex, useStock, type StockEntry } from "@/store/stock-store";
import { branchPick } from "@/lib/branches";
import { useBranches } from "@/store/branch-store";
import { BOOKED, IN_STOCK, TRANSIT } from "@/lib/stock-options";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";

/** A colour swatch dot. */
export function ColourDot({ name, size = 12 }: { name: string; size?: number }) {
  const hex = useColourHex();
  return <span className="shrink-0 rounded-full ring-1 ring-inset ring-fg/20" style={{ width: size, height: size, background: hex(name) }} aria-hidden />;
}

/** Context-sensitive actions: book / transfer, deliver, or receive, depending on where the unit is in its life. */
export function VehicleActions({ entry, compact }: { entry: StockEntry; compact?: boolean }) {
  const setStatus = useStock((s) => s.setStatus);
  const transfer = useStock((s) => s.transferEntry);
  const deliver = useStock((s) => s.markDelivered);
  const BRANCHES = useBranches();
  const others = BRANCHES.filter((b) => b.id !== entry.branchId);
  const size = "sm" as const;

  if (entry.status === TRANSIT) {
    return (
      <Button size={size} variant="primary" leading={<PackageCheck className="h-3.5 w-3.5" />} onClick={() => setStatus(entry.id, IN_STOCK)}>
        Mark as Received
      </Button>
    );
  }
  if (entry.status === BOOKED) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button size={size} variant="primary" leading={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => deliver(entry.id)}>
          Mark as Delivered
        </Button>
        {!compact && (
          <Button size={size} variant="ghost" onClick={() => setStatus(entry.id, IN_STOCK)}>
            Cancel booking
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size={size} leading={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setStatus(entry.id, BOOKED)}>
        Mark as Booked
      </Button>
      <Popover
        align="end"
        width={236}
        trigger={({ toggle }) => (
          <Button size={size} variant="ghost" leading={<ArrowRightLeft className="h-3.5 w-3.5" />} onClick={toggle}>
            {compact ? "Transfer" : "Transfer to Another Branch"}
          </Button>
        )}
      >
        {({ close }) => (
          <div role="menu">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">Send to</p>
            {others.map((b) => (
              <button
                key={b.id}
                role="menuitem"
                onClick={() => {
                  close();
                  transfer(entry.id, b.id);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg outline-none hover:bg-hover focus-visible:bg-hover"
              >
                <span className="truncate">{branchPick(b)}</span>
                <span className="text-[11px] text-faint">{b.kind === "hq" ? "Head Office" : b.city}</span>
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
