"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useBranches } from "@/store/branch-store";
import { useClaims } from "@/store/claims-store";
import { toast } from "@/store/toast-store";
import { nextRef, type Intake } from "@/lib/claims";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { IntakeFields, validateIntake, type IntakeErrors } from "./intake";

/**
 * Stage 1, the quick check-in: customer, vehicle, insurance, damage and a photo. Submitting opens the claim,
 * completes Stage 1 and lands on the claim at Stage 2 (the official Job Card).
 */
export function NewClaimForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const branches = useBranches();
  const scope = useApp((s) => s.branchScope);
  const claims = useClaims((s) => s.claims);
  const create = useClaims((s) => s.create);
  const complete = useClaims((s) => s.complete);

  const [draft, setDraft] = useState<Intake>(() => ({
    branchId: scope !== "all" && branches.some((b) => b.id === scope) ? scope : branches.length === 1 ? branches[0].id : "",
    customerName: "",
    phone: "",
    altPhone: "",
    regNo: "",
    model: "",
    insurer: "",
    policyNo: "",
    damage: "",
  }));
  const [errors, setErrors] = useState<IntakeErrors>({});
  const ref = draft.branchId ? nextRef(claims, draft.branchId) : "Choose a showroom to generate";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateIntake(draft);
    setErrors(found);
    if (Object.keys(found).length) return void toast.error("Some details need fixing", "Check the highlighted fields.");
    const claim = create({ ...draft, regNo: draft.regNo.trim().toUpperCase(), altPhone: draft.altPhone?.trim() || undefined });
    const moved = complete(claim.id);
    toast.success(`Claim ${claim.ref} opened`, moved.ok ? "Stage 1 is done. Fill in the official Job Card at Stage 2." : "Review the details and complete Stage 1 to move on.");
    onDone?.();
    router.push(`/claims/${claim.id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="rounded-lg border border-line bg-hover/60 px-3 py-2 text-[12px] text-muted">
        Claim reference <span className="ml-1 font-mono font-semibold text-fg">{ref}</span>. The Job Card number and official Claim No. are assigned at Stage 2.
      </p>
      <IntakeFields value={draft} onChange={setDraft} errors={errors} showBranch />
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button type="submit" variant="primary" leading={<FilePlus2 className="h-3.5 w-3.5" />}>
          Initiate Claim & Move to Stage 2
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** The "+ New Claim" button in the Claims toolbar: opens the quick intake as a slide-over. */
export function NewClaimButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" leading={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        New Claim
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} width={600} title="New Claim" description="Stage 1 · Quick customer check-in">
        <div className="p-5">
          <NewClaimForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </div>
      </Drawer>
    </>
  );
}
