"use client";

import { use } from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { STAGES, type StageNo } from "@/lib/claims";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { secondaryLinkClass } from "@/components/claims/ui";
import { Workspace } from "@/components/claims/workspace";

export default function StagePage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = use(params);
  const no = Number(n);
  if (!Number.isInteger(no) || no < 1 || no > STAGES.length) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
          <SearchX className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-fg">There is no stage “{n}”</p>
        <p className="mt-1 text-[13px] text-muted">Claims move through stages 1 to 10.</p>
        <Link href="/claims" className={cn(secondaryLinkClass, "mt-4")}>
          Back to claims
        </Link>
      </Card>
    );
  }
  // Keyed by stage so the status tab and "show more" reset when you switch stages.
  return <Workspace key={no} stage={no as StageNo} />;
}
