"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { FileText, MessageCircle, Pencil, Phone, Upload } from "lucide-react";
import { useBranchTools } from "@/store/branch-store";
import { intlDigits } from "@/store/employee-store";
import { openPolicyDoc, useInsurance } from "@/store/insurance-store";
import { toast } from "@/store/toast-store";
import { useSettings } from "@/store/settings-store";
import { branchPick } from "@/lib/branches";
import { fmtDate, policyStatus, type Policy, type PolicyStatus } from "@/lib/insurance";
import { cn } from "@/lib/utils";
import { fadeUp, spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";

const TONE: Record<PolicyStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = { active: "ok", expiring: "warn", expired: "danger", renewal: "info", pending: "neutral" };

/** One policy: customer, vehicle, insurer, validity with a status badge, and the actions for it. */
export function PolicyRow({ policy, onEdit }: { policy: Policy; onEdit: () => void }) {
  const { byId } = useBranchTools();
  const update = useInsurance((s) => s.update);
  const markReminded = useInsurance((s) => s.markReminded);
  const fileRef = useRef<HTMLInputElement>(null);
  const dealer = useSettings((s) => s.settings.profile.legalName);
  const st = policyStatus(policy);
  const branch = byId(policy.branchId);
  const canRemind = st.status === "expiring" || st.status === "expired" || st.status === "renewal";

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return void toast.error("The policy document must be a PDF");
    if (file.size > 10 * 1024 * 1024) return void toast.error("PDF is larger than 10 MB");
    await update(policy.id, {}, file);
    toast.success("Policy PDF saved", `${policy.customer} · ${file.name}`);
  };

  const remind = () => {
    const first = policy.customer.split(" ")[0];
    const when = st.days !== null && st.days < 0 ? `expired on ${fmtDate(policy.end)}` : `expires on ${fmtDate(policy.end)}`;
    const text = [
      `Hello ${first}, this is ${dealer}${branch ? ` (${branch.short})` : ""}.`,
      `Your ${policy.partner} insurance (policy ${policy.policyNo}) for your Yamaha ${policy.modelName}${policy.regNo ? ` ${policy.regNo}` : ""} ${when}.`,
      "Renew in time to stay covered and keep your no-claim bonus. Reply here or call us and we will arrange it.",
      branch ? `Phone: ${branch.phone.split(" / ")[0]}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://wa.me/${intlDigits(policy.phone)}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    markReminded(policy.id);
    toast.success("Reminder opened in WhatsApp", `${policy.customer} is marked as Renewal Pending.`);
  };

  return (
    <motion.li layout variants={fadeUp} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }} transition={spring} className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[1.1fr_1.3fr_1.2fr_1.1fr]">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-fg">{policy.customer}</p>
          <a href={`tel:+${intlDigits(policy.phone)}`} className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-muted outline-none hover:text-fg focus-visible:underline">
            <Phone className="h-3 w-3" />
            {policy.phone}
          </a>
          {branch && <p className="mt-1 text-xs text-faint">{branchPick(branch)}</p>}
        </div>

        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-fg">Yamaha {policy.modelName}</p>
          <p className="mt-0.5 truncate font-mono text-[12px] text-muted" title="Chassis number">
            {policy.chassisNo}
          </p>
          <p className="truncate font-mono text-[12px] text-faint" title="Engine number">
            {policy.engineNo ? `Engine ${policy.engineNo}` : "Engine no. not recorded"}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">{policy.regNo ? <span className="font-mono font-medium text-fg">{policy.regNo}</span> : "Registration not allotted yet"}</p>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-fg">{policy.partner}</p>
          <p className="mt-0.5 truncate font-mono text-[12px] text-muted">{policy.policyNo || "Policy number pending"}</p>
          <p className="mt-1 text-xs text-muted">{policy.type}</p>
        </div>

        <div className="min-w-0">
          <Badge tone={TONE[st.status]} dot>
            {st.label}
          </Badge>
          <p className="mt-1.5 text-[12.5px] text-muted">{policy.policyNo && policy.end ? `${fmtDate(policy.start)} → ${fmtDate(policy.end)}` : "Validity not set"}</p>
          {st.status === "expired" && st.days !== null && <p className={cn("text-xs text-danger")}>Lapsed {Math.abs(st.days)} day{Math.abs(st.days) === 1 ? "" : "s"} ago</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {policy.docName ? (
          <Button size="sm" leading={<FileText className="h-3.5 w-3.5" />} onClick={() => void openPolicyDoc(policy.id)} title={policy.docName}>
            View Policy PDF
          </Button>
        ) : (
          <Button size="sm" leading={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
            Upload Policy PDF
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="policy-row-pdf"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {canRemind && (
          <Button size="sm" leading={<MessageCircle className="h-3.5 w-3.5" />} onClick={remind}>
            Send Renewal Reminder
          </Button>
        )}
        <Button size="sm" variant="ghost" leading={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit} className="ml-auto">
          Edit Policy
        </Button>
      </div>
    </motion.li>
  );
}
