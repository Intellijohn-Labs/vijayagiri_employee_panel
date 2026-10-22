"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { NewClaimForm } from "@/components/claims/new-claim";

export default function NewClaimPage() {
  return (
    <>
      <Link href="/claims" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted outline-none hover:text-fg focus-visible:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> All claims
      </Link>
      <PageHeader title="New Claim" description="Stage 1 · Quick customer check-in. The claim reference is generated for you." />
      <Card className="max-w-3xl p-5">
        <NewClaimForm />
      </Card>
    </>
  );
}
