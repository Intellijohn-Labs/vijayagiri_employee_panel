import { BASE_BRANCHES } from "@/lib/branches";
import { BranchStockView } from "@/components/stock/branch-stock-view";

/** One page per showroom, built ahead of time: /stock/perumbavoor, /stock/kalady, …; branches added later resolve in the browser */
export function generateStaticParams() {
  return BASE_BRANCHES.map((b) => ({ branch: b.id }));
}

export default async function ShowroomStockPage({ params }: { params: Promise<{ branch: string }> }) {
  const { branch } = await params;
  return <BranchStockView branchId={branch} />;
}
