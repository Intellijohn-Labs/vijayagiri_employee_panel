"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useBranches } from "@/store/branch-store";
import { useClaims } from "@/store/claims-store";
import { toast } from "@/store/toast-store";
import { isoToday, nextJobCardNo, nextRef, type Intake } from "@/lib/claims";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { IntakeFields, validateIntake, type IntakeErrors } from "@/components/claims/intake";
import { secondaryLinkClass } from "@/components/claims/ui";

export default function NewClaimPage() {
  const router = useRouter();
  const branches = useBranches();
  const scope = useApp((s) => s.branchScope);
  const claims = useClaims((s) => s.claims);
  const create = useClaims((s) => s.create);

  const [draft, setDraft] = useState<Intake>(() => ({
    branchId: scope !== "all" && branches.some((b) => b.id === scope) ? scope : branches.length === 1 ? branches[0].id : "",
    customerName: "",
    phone: "",
    email: "",
    address: "",
    regNo: "",
    model: "",
    chassisNo: "",
    odometer: "",
    insurer: "",
    policyNo: "",
    accidentDate: isoToday(),
    damage: "",
    jobCardNo: nextJobCardNo(claims),
  }));
  const [errors, setErrors] = useState<IntakeErrors>({});

  const ref = draft.branchId ? nextRef(claims, draft.branchId) : "Choose a showroom to generate";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateIntake(draft);
    setErrors(found);
    if (Object.keys(found).length) return void toast.error("Some details need fixing", "Check the highlighted fields.");
    const claim = create({ ...draft, regNo: draft.regNo.trim().toUpperCase(), chassisNo: draft.chassisNo.trim().toUpperCase() });
    toast.success(`Claim ${claim.ref} opened`, "Review the details and complete Stage 1 to move on.");
    router.push(`/claims/${claim.id}`);
  };

  return (
    <>
      <Link href="/claims" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted outline-none hover:text-fg focus-visible:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> All claims
      </Link>
      <PageHeader title="New Claim" description="Stage 1 · Register the customer and vehicle and open the claim. The claim reference is generated for you." />
      <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="p-5">
          <IntakeFields value={draft} onChange={setDraft} errors={errors} showBranch />
        </Card>
        <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <Card className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Claim reference</p>
            <p className="mt-1 font-mono text-lg font-semibold text-fg">{ref}</p>
            <p className="mt-2 text-[12px] leading-5 text-muted">The official Claim No. is assigned at Stage 2, once the job card is finalised.</p>
          </Card>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" leading={<FilePlus2 className="h-3.5 w-3.5" />}>
              Open claim
            </Button>
            <Link href="/claims" className={secondaryLinkClass}>
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </>
  );
}
