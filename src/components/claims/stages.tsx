"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, Camera, ExternalLink, FileUp, Lock, MessageCircle, Plus, Printer, Trash2, Truck } from "lucide-react";
import { useBranch } from "@/store/branch-store";
import { useSessionEmployee } from "@/store/employee-store";
import { fileId, isBranchManagerOf, useClaims, type FileSlot } from "@/store/claims-store";
import { toast } from "@/store/toast-store";
import { loadClaimFile } from "@/lib/photo-db";
import { fmtHours, stageSla } from "@/lib/sla-config";
import { INTIMATION_MODES, APPROVALS, ESTIMATE_CATEGORIES, SLA, VISIT_STATUSES, customerPayable, estimateTotal, fmtDateTime, isoToday, jobCardOf, missingFor, nextClaimNo, nextJobCardNo, stageDef, toLocalInput, type Claim, type ClaimFile, type EstimateLine, type StageNo } from "@/lib/claims";
import { cn, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/popover";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/primitives";
import { IntakeFields, intakeOf, validateIntake } from "./intake";
import { JobCardSheet, REQUIRED_MESSAGE, type JobCardErrors, type JobCardForm } from "./job-card";
import { useSla } from "./sla";
import { Fact, Section } from "./ui";

export interface PanelProps {
  claim: Claim;
  /** True for a stage that is already complete (or a delivered claim): shown, not editable */
  readOnly: boolean;
}

/* ───────── Shared bits ───────── */

function useActions(claim: Claim) {
  const set = useClaims((s) => s.set);
  const complete = useClaims((s) => s.complete);
  return {
    save: (patch: Partial<Claim>, message = "Changes saved") => {
      set(claim.id, patch);
      toast.success(message);
    },
    /** Apply `patch` and move on; explains what is missing otherwise. */
    finish: (patch?: Partial<Claim>) => {
      const r = complete(claim.id, patch);
      if (r.ok) toast.success(`Stage ${claim.stage} complete`, claim.stage < 10 ? `Moved to Stage ${claim.stage + 1} · ${stageDef((claim.stage + 1) as StageNo).short}` : undefined);
      else toast.error("This stage isn't ready to complete", r.missing.join(" · "));
      return r.ok;
    },
  };
}

function Footer({ missing, children }: { missing: string[]; children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <p className="min-w-0 flex-1 text-[12px] text-muted">{missing.length ? <><span className="font-medium text-warn">Still needed: </span>{missing.join(" · ")}</> : <span className="font-medium text-ok">Everything this stage needs is in place.</span>}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const toNum = (s: string): number | null => {
  const t = s.replace(/[,₹\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const numStr = (n: number | null) => (n === null ? "" : String(n));

const sizeText = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Object URL for a file kept in IndexedDB, or null when there isn't one (or it was never stored). */
function useStoredFile(claimId: string, slot: FileSlot, file: ClaimFile | null) {
  const [url, setUrl] = useState<string | null>(null);
  const stamp = file?.stored ? file.at : null;
  useEffect(() => {
    if (stamp === null) return setUrl(null);
    let made: string | null = null;
    let live = true;
    loadClaimFile(fileId(claimId, slot))
      .then((doc) => {
        if (!live || !doc) return;
        made = URL.createObjectURL(doc.blob);
        setUrl(made);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [claimId, slot, stamp]);
  return url;
}

/** A file picker with a preview for images and an "Open" link for the rest. */
function FilePicker({ claim, slot, file, label, accept, image, readOnly }: { claim: Claim; slot: FileSlot; file: ClaimFile | null; label: string; accept: string; image?: boolean; readOnly: boolean }) {
  const attach = useClaims((s) => s.attachFile);
  const input = useRef<HTMLInputElement>(null);
  const url = useStoredFile(claim.id, slot, file);

  const pick = (f?: File) => {
    if (!f) return;
    const ok = image ? f.type.startsWith("image/") : f.type === "application/pdf" || f.type.startsWith("image/");
    if (!ok) return void toast.error(image ? "Please choose an image" : "Please choose a PDF or an image");
    if (f.size > 10 * 1024 * 1024) return void toast.error("The file is larger than 10 MB");
    void attach(claim.id, slot, f).then(() => toast.success(`${label} uploaded`, f.name));
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        {image && (
          <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-hover text-faint">
            {url ? (
              // biome-ignore lint/performance/noImgElement: a blob: preview URL, which next/image cannot load
              <img src={url} alt={`${label} preview`} className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">{file ? file.name : `No ${label.toLowerCase()} yet`}</p>
          <p className="text-[12px] text-muted">{file ? `${sizeText(file.size)} · ${fmtDateTime(file.at)}${file.stored ? "" : " · file not stored"}` : image ? "JPG or PNG, up to 10 MB" : "PDF or image, up to 10 MB"}</p>
        </div>
        <div className="flex gap-2">
          {!image && url && (
            <Button size="sm" leading={<ExternalLink className="h-3 w-3" />} onClick={() => window.open(url, "_blank", "noopener")}>
              Open
            </Button>
          )}
          {!readOnly && (
            <Button size="sm" leading={<FileUp className="h-3 w-3" />} onClick={() => input.current?.click()}>
              {file ? "Replace" : "Upload"}
            </Button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1} onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ───────── Stage 1 · Customer intake ───────── */

function Stage1({ claim, readOnly }: PanelProps) {
  const { save, finish } = useActions(claim);
  const [draft, setDraft] = useState(() => intakeOf(claim));
  const missing = missingFor({ ...claim, ...draft });
  return (
    <>
      <IntakeFields value={draft} onChange={setDraft} errors={validateIntake(draft)} readOnly={readOnly} />
      {!readOnly && (
        <Footer missing={missing}>
          <Button onClick={() => save(draft, "Intake details saved")}>Save</Button>
          <Button variant="primary" onClick={() => finish(draft)}>
            Complete Stage 1
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 2 · Job card & claim number ───────── */

function Stage2({ claim, readOnly }: PanelProps) {
  const { save, finish } = useActions(claim);
  const claims = useClaims((s) => s.claims);
  // The job card number is generated when the sheet opens, and the receiving time defaults to now; both stay editable.
  const [form, setForm] = useState<JobCardForm>(() => {
    const jc = jobCardOf(claim);
    return { jobCardNo: claim.jobCardNo || (readOnly ? "" : nextJobCardNo(claims)), claimNo: claim.claimNo, chassisNo: claim.chassisNo, odometer: claim.odometer, damage: claim.damage, jc: { ...jc, receivedAt: jc.receivedAt || (readOnly ? "" : toLocalInput(Date.now())) } };
  });
  const patch = { jobCardNo: form.jobCardNo.trim(), claimNo: form.claimNo.trim(), chassisNo: form.chassisNo.trim().toUpperCase(), odometer: form.odometer, damage: form.damage, jobCard: form.jc };
  const missing = missingFor({ ...claim, ...patch });
  // Red highlighting only starts once the user has tried to save. It is derived from the live form, so a field clears the moment it is filled.
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const errors: JobCardErrors = {};
  if (showValidationErrors) {
    if (!patch.jobCardNo) errors.jobCardNo = REQUIRED_MESSAGE;
    if (!patch.claimNo) errors.claimNo = REQUIRED_MESSAGE;
    if (!form.jc.bay) errors.bay = REQUIRED_MESSAGE;
    if (!form.jc.receivedAt) errors.receivedAt = REQUIRED_MESSAGE;
    if (!form.jc.promisedAt) errors.promisedAt = REQUIRED_MESSAGE;
    else if (form.jc.receivedAt && form.jc.promisedAt <= form.jc.receivedAt) errors.promisedAt = "Promised delivery must be after the receiving time";
    if (!patch.chassisNo) errors.chassisNo = REQUIRED_MESSAGE;
    if (!patch.odometer.trim()) errors.odometer = REQUIRED_MESSAGE;
    if (!form.jc.supervisor.trim()) errors.supervisor = REQUIRED_MESSAGE;
  }
  const sheet = useRef<HTMLDivElement>(null);
  /** Turn on the red highlights, then shake and scroll to the first invalid field (in form order, top to bottom). */
  const flagInvalid = () => {
    setShowValidationErrors(true);
    if (!missing.length) return;
    // Wait a frame so the invalid markers are in the DOM.
    requestAnimationFrame(() => {
      const first = sheet.current?.querySelector<HTMLElement>("[data-invalid]");
      if (!first) return;
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.classList.remove("field-shake");
      void first.offsetWidth;
      first.classList.add("field-shake");
      first.querySelector<HTMLElement>("input,select")?.focus({ preventScroll: true });
    });
  };
  return (
    <>
      <div ref={sheet}>
      <JobCardSheet errors={errors} claim={claim} value={form} onChange={setForm} readOnly={readOnly} onAutoJobNo={() => setForm({ ...form, jobCardNo: nextJobCardNo(claims) })} onAutoClaimNo={() => setForm({ ...form, claimNo: nextClaimNo(claims) })} canAutoClaimNo={!form.claimNo || form.claimNo !== claim.claimNo} />
      </div>
      {!readOnly && (
        <Footer missing={missing}>
          <Button onClick={() => { flagInvalid(); save(patch, "Job card saved"); }}>Save</Button>
          <Button variant="primary" onClick={() => { flagInvalid(); finish(patch); }}>
            Save job card & continue to Estimation
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 3 · Estimate & intimation ───────── */

function Stage3({ claim, readOnly }: PanelProps) {
  const { save, finish } = useActions(claim);
  const [est, setEst] = useState(claim.estimate);
  const patch = { estimate: est };
  const missing = missingFor({ ...claim, ...patch });
  const setLine = (id: string, p: Partial<EstimateLine>) => setEst({ ...est, lines: est.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  return (
    <>
      <Section title="Estimate breakdown" hint={`Total ${formatINR(estimateTotal({ estimate: est }))}`}>
        <div className="space-y-2">
          {est.lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[104px_1fr_110px_auto] items-center gap-2 max-sm:grid-cols-[1fr_96px_auto]">
              <div className="max-sm:col-span-3">
                <Select<string> value={l.category} onChange={(v) => setLine(l.id, { category: v as EstimateLine["category"] })} disabled={readOnly} options={ESTIMATE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </div>
              <Input value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} placeholder="Description" aria-label="Description" disabled={readOnly} />
              <Input value={l.amount ? String(l.amount) : ""} onChange={(e) => setLine(l.id, { amount: toNum(e.target.value) ?? 0 })} placeholder="₹ Amount" inputMode="numeric" aria-label="Amount" disabled={readOnly} />
              {!readOnly && (
                <Button variant="ghost" size="sm" iconOnly aria-label="Remove line" onClick={() => setEst({ ...est, lines: est.lines.filter((x) => x.id !== l.id) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {!est.lines.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-faint">No estimate lines yet.</p>}
          {!readOnly && (
            <Button size="sm" leading={<Plus className="h-3 w-3" />} onClick={() => setEst({ ...est, lines: [...est.lines, { id: `l${Date.now().toString(36)}`, category: "Parts", description: "", amount: 0 }] })}>
              Add line
            </Button>
          )}
        </div>
      </Section>
      <div className="mt-5">
        <Section title="Insurance intimation" hint={claim.insurer ? `Insurer: ${claim.insurer}` : undefined}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Intimation date" required>
              <Input type="date" value={est.intimationDate} onChange={(e) => setEst({ ...est, intimationDate: e.target.value })} disabled={readOnly} />
            </Field>
            <Field label="Mode">
              <Select<string> value={est.intimationMode} onChange={(v) => setEst({ ...est, intimationMode: v as typeof est.intimationMode })} disabled={readOnly} options={INTIMATION_MODES.map((m) => ({ value: m, label: m }))} />
            </Field>
            <Field label="Insurer reference" hint="Optional">
              <Input value={est.intimationRef} onChange={(e) => setEst({ ...est, intimationRef: e.target.value })} className="font-mono" disabled={readOnly} />
            </Field>
            <Field label="Notes" hint="Optional" className="sm:col-span-3">
              <Textarea value={est.notes} onChange={(e) => setEst({ ...est, notes: e.target.value })} disabled={readOnly} />
            </Field>
          </div>
          {!readOnly && !est.intimationDate && (
            <Button size="sm" className="mt-3" onClick={() => setEst({ ...est, intimationDate: isoToday() })}>
              Log intimation today
            </Button>
          )}
        </Section>
      </div>
      {!readOnly && (
        <Footer missing={missing}>
          <Button onClick={() => save(patch, "Estimate saved")}>Save</Button>
          <Button variant="primary" onClick={() => finish(patch)}>
            Complete Stage 3
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 4 · Surveyor inspection ───────── */

function Stage4({ claim, readOnly }: PanelProps) {
  const { save, finish } = useActions(claim);
  const { report: _report, ...rest } = claim.survey;
  void _report;
  const [s, setS] = useState(rest);
  // The report is uploaded straight away, so always merge onto the live survey record rather than a stale copy.
  const patch = { survey: { ...claim.survey, ...s } };
  const missing = missingFor({ ...claim, ...patch });
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Surveyor name" required>
          <Input value={s.surveyor} onChange={(e) => setS({ ...s, surveyor: e.target.value })} disabled={readOnly} />
        </Field>
        <Field label="Surveyor phone" hint="Optional">
          <Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} inputMode="tel" disabled={readOnly} />
        </Field>
        <Field label="Visit status" required>
          <Select<string> value={s.visit} onChange={(v) => setS({ ...s, visit: v as typeof s.visit })} disabled={readOnly} options={VISIT_STATUSES.map((v) => ({ value: v, label: v }))} />
        </Field>
        <Field label="Visit date">
          <Input type="date" value={s.visitDate} onChange={(e) => setS({ ...s, visitDate: e.target.value })} disabled={readOnly} />
        </Field>
        <Field label="Inspection notes" className="sm:col-span-2">
          <Textarea value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} placeholder="What the surveyor found, parts approved or rejected…" disabled={readOnly} />
        </Field>
      </div>
      <div className="mt-5 space-y-4">
        <Section title="Survey report">
          <FilePicker claim={claim} slot="survey" file={claim.survey.report} label="Survey report" accept="application/pdf,image/*" readOnly={readOnly} />
        </Section>
        <Section title="Report approval">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Report approval</legend>
            {APPROVALS.map((a) => (
              <label
                key={a}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-[13px] font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500/50",
                  readOnly && "cursor-not-allowed",
                  s.approval === a ? (a === "Approved" ? "border-ok/40 bg-ok-tint text-ok" : a === "Rejected" ? "border-danger/40 bg-danger-tint text-danger" : "border-warn/40 bg-warn-tint text-warn") : "border-line bg-surface text-muted hover:bg-hover",
                )}
              >
                <input type="radio" name="survey-approval" className="sr-only" checked={s.approval === a} disabled={readOnly} onChange={() => setS({ ...s, approval: a })} />
                {a}
              </label>
            ))}
          </fieldset>
        </Section>
      </div>
      {!readOnly && (
        <Footer missing={missing}>
          <Button onClick={() => save(patch, "Survey details saved")}>Save</Button>
          <Button variant="primary" onClick={() => finish(patch)}>
            Complete Stage 4
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 5 · Spare parts ordering ───────── */

function Stage5({ claim, readOnly }: PanelProps) {
  const placeOrder = useClaims((s) => s.placeOrder);
  const { finish } = useActions(claim);
  const [orderNo, setOrderNo] = useState(claim.parts.orderNo);
  const [eta, setEta] = useState(String(claim.parts.etaDays));
  const sla = useSla(claim);
  const ordered = !!claim.parts.orderNo && claim.parts.orderedAt !== null;
  const partsLines = claim.estimate.lines.filter((l) => l.category === "Parts");
  const etaAt = claim.parts.orderedAt ? claim.parts.orderedAt + claim.parts.etaDays * 24 * 3_600_000 : null;
  return (
    <>
      <Section title="Parts to order" hint="From the approved estimate">
        {partsLines.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {partsLines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="text-fg">{l.description || "Unnamed part"}</span>
                <span className="tabular-nums text-muted">{formatINR(l.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-faint">No parts lines on the estimate.</p>
        )}
      </Section>

      <div className="mt-5">
        <Section title="Yamaha order" hint={`Parts Manager places it within ${fmtHours(stageSla(5).durationH)} of this stage starting`}>
          {ordered ? (
            <dl className="grid gap-4 sm:grid-cols-4">
              <Fact label="Order no." mono>{claim.parts.orderNo}</Fact>
              <Fact label="Placed">{claim.parts.orderedAt ? fmtDateTime(claim.parts.orderedAt) : ""}</Fact>
              <Fact label="Placed by">{claim.parts.orderedBy}</Fact>
              <Fact label="Transit ETA">{etaAt ? `${fmtDateTime(etaAt)} (${claim.parts.etaDays} d)` : ""}</Fact>
            </dl>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
              <Field label="Yamaha order no." required>
                <Input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="YMD-PO-000000" className="font-mono" disabled={readOnly} />
              </Field>
              <Field label="Transit ETA" hint={`Max ${SLA.maxTransitDays} days`}>
                <Select<string> value={eta} onChange={setEta} disabled={readOnly} options={Array.from({ length: SLA.maxTransitDays }, (_, i) => ({ value: String(i + 1), label: `${i + 1} day${i ? "s" : ""}` }))} />
              </Field>
              {!readOnly && (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (placeOrder(claim.id, orderNo, Number(eta))) toast.success("Yamaha order recorded", "The 5-hour clock stops and the transit ETA clock starts.");
                    else toast.error("Enter the Yamaha order number first");
                  }}
                >
                  Place order
                </Button>
              )}
            </div>
          )}
          {sla && ordered && <p className="mt-3 text-[12px] text-muted">Parts are in transit to the Central yard. When they arrive, mark them received to start the 12-hour dispatch clock.</p>}
        </Section>
      </div>

      {!readOnly && (
        <Footer missing={missingFor(claim)}>
          <Button variant="primary" disabled={!ordered} leading={<Truck className="h-3.5 w-3.5" />} onClick={() => finish()}>
            Parts received at Central
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 6 · Central receipt & transit ───────── */

function Stage6({ claim, readOnly }: PanelProps) {
  const { save, finish } = useActions(claim);
  const [t, setT] = useState({ dispatchRef: claim.transit.dispatchRef, carrier: claim.transit.carrier });
  const patch = { transit: { ...claim.transit, ...t } };
  const missing = missingFor({ ...claim, ...patch });
  return (
    <>
      <dl className="mb-5 grid gap-4 sm:grid-cols-3">
        <Fact label="Received at Central">{claim.parts.receivedAt ? fmtDateTime(claim.parts.receivedAt) : fmtDateTime(claim.stageEnteredAt)}</Fact>
        <Fact label="Yamaha order no." mono>{claim.parts.orderNo}</Fact>
        <Fact label="Reached branch">{claim.transit.reachedAt ? fmtDateTime(claim.transit.reachedAt) : "Not yet"}</Fact>
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dispatch reference" required hint="Vehicle no. or consignment no.">
          <Input value={t.dispatchRef} onChange={(e) => setT({ ...t, dispatchRef: e.target.value })} className="font-mono" disabled={readOnly} />
        </Field>
        <Field label="Carrier" hint="Optional">
          <Input value={t.carrier} onChange={(e) => setT({ ...t, carrier: e.target.value })} placeholder="Branch pickup van, courier…" disabled={readOnly} />
        </Field>
      </div>
      {!readOnly && (
        <Footer missing={missing}>
          <Button onClick={() => save({ transit: { ...patch.transit, dispatchedAt: claim.transit.dispatchedAt ?? Date.now() } }, "Dispatch recorded")}>Record dispatch</Button>
          <Button variant="primary" leading={<Truck className="h-3.5 w-3.5" />} onClick={() => finish({ transit: { ...patch.transit, dispatchedAt: claim.transit.dispatchedAt ?? Date.now() } })}>
            Parts reached the branch
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 7 · Work commencement ───────── */

function Stage7({ claim, readOnly }: PanelProps) {
  const { finish } = useActions(claim);
  const missing = missingFor(claim);
  return (
    <>
      <Section title="Ramp photo" hint="Sent to the customer when the repair starts">
        <FilePicker claim={claim} slot="ramp" file={claim.work.ramp} label="Ramp photo" accept="image/*" image readOnly={readOnly} />
      </Section>
      <div className="mt-5">
        <Section title="Customer notification" hint="Simulated">
          <div className="flex gap-3 rounded-lg border border-line bg-hover/60 p-3">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            <div className="min-w-0 text-[12.5px] leading-5 text-muted">
              {claim.work.notifiedAt ? (
                <p className="font-medium text-ok">Sent {fmtDateTime(claim.work.notifiedAt)}</p>
              ) : (
                <p>Starting the repair sends this WhatsApp message to {claim.phone}:</p>
              )}
              <p className="mt-1 text-fg">“Hello {claim.customerName.split(" ")[0]}, repair of your Yamaha {claim.model} ({claim.regNo}) has started on our workshop ramp. Photo attached. Claim {claim.claimNo || claim.ref}.”</p>
            </div>
          </div>
        </Section>
      </div>
      {!readOnly && (
        <Footer missing={missing}>
          <Button variant="primary" leading={<Camera className="h-3.5 w-3.5" />} onClick={() => finish()}>
            Start repair & notify customer
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 8 · Repair execution ───────── */

function Stage8({ claim, readOnly }: PanelProps) {
  const { finish } = useActions(claim);
  const set = useClaims((s) => s.set);
  const groups = ["Mechanical", "Body repair", "Painting"] as const;
  const done = claim.checklist.filter((i) => i.done).length;
  const toggle = (id: string, v: boolean) => set(claim.id, { checklist: claim.checklist.map((i) => (i.id === id ? { ...i, done: v } : i)) });
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / claim.checklist.length) * 100}%` }} />
        </div>
        <span className="text-[12px] font-medium tabular-nums text-muted">
          {done} / {claim.checklist.length} done
        </span>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {groups.map((g) => {
          const items = claim.checklist.filter((i) => i.group === g);
          return (
            <fieldset key={g} className="min-w-0 rounded-lg border border-line bg-surface p-3">
              <legend className="px-1 text-[12px] font-semibold text-fg">
                {g} <span className="font-normal text-faint">({items.filter((i) => i.done).length}/{items.length})</span>
              </legend>
              <ul className="space-y-2.5">
                {items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5">{readOnly ? <Checkbox checked={i.done} onChange={() => undefined} label={i.label} className="pointer-events-none" /> : <Checkbox checked={i.done} onChange={(v) => toggle(i.id, v)} label={i.label} />}</span>
                    <span className={cn("text-[12.5px] leading-5", i.done ? "text-muted line-through" : "text-fg")}>{i.label}</span>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
      {!readOnly && (
        <Footer missing={missingFor(claim)}>
          <Button variant="primary" onClick={() => finish()}>
            Mark repair complete
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 9 · Billing ───────── */

function Stage9({ claim, readOnly }: PanelProps) {
  const { save, finish } = useActions(claim);
  const b = claim.billing;
  const [f, setF] = useState({ invoiceNo: b.invoiceNo, total: numStr(b.totalBill), insurance: numStr(b.insuranceCredited), dep: numStr(b.depreciation), paymentRef: b.paymentRef, paid: b.balancePaid });
  const billing = { invoiceNo: f.invoiceNo, totalBill: toNum(f.total), insuranceCredited: toNum(f.insurance), depreciation: toNum(f.dep), paymentRef: f.paymentRef, balancePaid: f.paid };
  const payable = customerPayable(billing);
  const missing = missingFor({ ...claim, billing });
  const depTooHigh = (billing.depreciation ?? 0) > payable;
  const money = (k: "total" | "insurance" | "dep", label: string, hint?: string, required?: boolean) => (
    <Field label={label} hint={hint} required={required}>
      <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode="numeric" placeholder="₹ 0" disabled={readOnly} invalid={k === "dep" && depTooHigh} />
    </Field>
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice no." hint="Optional">
          <Input value={f.invoiceNo} onChange={(e) => setF({ ...f, invoiceNo: e.target.value })} className="font-mono" disabled={readOnly} />
        </Field>
        {money("total", "Total bill amount", undefined, true)}
        {money("insurance", "Insurance credited amount", "0 if none", true)}
        {money("dep", "Depreciation (customer-borne)", "Part of the balance")}
      </div>
      {depTooHigh && <p className="mt-2 text-[12px] text-danger">Depreciation can't be more than the customer's balance.</p>}

      <dl className="mt-5 grid gap-3 rounded-xl border border-line bg-hover/60 p-4 sm:grid-cols-4">
        <Fact label="Total bill">{formatINR(billing.totalBill ?? 0)}</Fact>
        <Fact label="Insurance credited">{formatINR(billing.insuranceCredited ?? 0)}</Fact>
        <Fact label="Depreciation">{formatINR(billing.depreciation ?? 0)}</Fact>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-faint">Customer payable balance</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{formatINR(payable)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] text-muted">Customer payable = total bill − insurance credited. Depreciation is the main part of it; anything left is excess or non-claimable charges.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:items-end">
        <Field label="Payment reference" hint="UPI / cash / cheque">
          <Input value={f.paymentRef} onChange={(e) => setF({ ...f, paymentRef: e.target.value })} disabled={readOnly} />
        </Field>
        <div className="flex h-9 items-center gap-2.5 text-[13px] text-fg">
          {readOnly ? <Checkbox checked={f.paid} onChange={() => undefined} label="Balance collected" className="pointer-events-none" /> : <Checkbox checked={f.paid} onChange={(v) => setF({ ...f, paid: v })} label="Balance collected" />}
          <span>{payable > 0 ? `Customer balance of ${formatINR(payable)} collected` : "No balance to collect"}</span>
        </div>
      </div>
      {!readOnly && (
        <Footer missing={missing}>
          <Button onClick={() => save({ billing }, "Billing saved")}>Save</Button>
          <Button variant="primary" disabled={depTooHigh} onClick={() => finish({ billing })}>
            Complete Stage 9
          </Button>
        </Footer>
      )}
    </>
  );
}

/* ───────── Stage 10 · Approval & handover ───────── */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string, string>)[c] ?? c);

function printGatepass(c: Claim, showroom: string) {
  const w = window.open("", "_blank", "width=720,height=800");
  if (!w) return void toast.error("Allow pop-ups to print the gatepass");
  const rows: [string, string][] = [
    ["Gatepass no.", c.handover.gatepassNo],
    ["Issued", c.handover.gatepassAt ? fmtDateTime(c.handover.gatepassAt) : ""],
    ["Showroom", showroom],
    ["Claim no.", c.claimNo || c.ref],
    ["Job card no.", c.jobCardNo],
    ["Customer", c.customerName],
    ["Vehicle", `${c.model} · ${c.regNo}`],
    ["Chassis no.", c.chassisNo],
    ["Approved by (Branch Manager)", c.handover.approvedBy],
    ["Vehicle collected by", c.handover.collectedBy],
  ];
  w.document.write(`<!doctype html><title>Gatepass ${esc(c.handover.gatepassNo)}</title><body style="font:14px system-ui,sans-serif;margin:40px;color:#0f172a"><h1 style="margin:0">Vijayagiri Auto Agencies</h1><p style="margin:4px 0 24px;color:#475569">Vehicle Gatepass · Authorised Yamaha dealer</p><table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#475569;width:240px">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600">${esc(v || "—")}</td></tr>`).join("")}</table><p style="margin-top:56px;display:flex;justify-content:space-between"><span>Customer signature</span><span>Branch Manager</span></p></body>`);
  w.document.close();
  w.focus();
  w.print();
}

function Stage10({ claim, readOnly }: PanelProps) {
  const me = useSessionEmployee();
  const branch = useBranch(claim.branchId);
  const setApproval = useClaims((s) => s.setApproval);
  const issue = useClaims((s) => s.issueGatepass);
  const [collector, setCollector] = useState(claim.handover.collectedBy || claim.customerName);
  const h = claim.handover;
  const manager = isBranchManagerOf(me, claim.branchId);
  const delivered = !!claim.closedAt;
  const showroom = branch?.name ?? claim.branchId;
  return (
    <>
      <Section title="Delivery approval" hint="Branch Manager only">
        <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3", h.approved ? "border-ok/30 bg-ok-tint" : "border-line bg-surface")}>
          <Checkbox checked={h.approved} onChange={(v) => {
              if (delivered) return;
              if (manager) setApproval(claim.id, v);
              else toast.error("Unauthorized: Only the Branch Manager of this branch can approve delivery.");
            }} label="Approve delivery" className={cn(!manager || delivered ? "opacity-50" : undefined)} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">{h.approved ? `Approved by ${h.approvedBy}` : "I approve this vehicle for delivery"}</p>
            <p className="text-[12px] text-muted">{h.approved && h.approvedAt ? fmtDateTime(h.approvedAt) : "Confirms the repair, quality check and billing are complete."}</p>
          </div>
          {!manager && !delivered && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <Lock className="h-3.5 w-3.5" /> Locked — only the Branch Manager of {branch?.short ?? "this branch"} can approve
            </span>
          )}
        </div>
      </Section>

      <div className="mt-5">
        <Section title="Gatepass & handover">
          {delivered ? (
            <div className="rounded-xl border border-accent/25 bg-tint p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-accent-text">
                <BadgeCheck className="h-4 w-4" /> Delivered to Customer
              </p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-4">
                <Fact label="Gatepass no." mono>{h.gatepassNo}</Fact>
                <Fact label="Issued">{h.gatepassAt ? fmtDateTime(h.gatepassAt) : ""}</Fact>
                <Fact label="Collected by">{h.collectedBy}</Fact>
                <Fact label="Approved by">{h.approvedBy}</Fact>
              </dl>
              <Button className="mt-4" leading={<Printer className="h-3.5 w-3.5" />} onClick={() => printGatepass(claim, showroom)}>
                Print gatepass
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Vehicle collected by">
                <Input value={collector} onChange={(e) => setCollector(e.target.value)} disabled={readOnly || !h.approved} />
              </Field>
              <Button
                variant="primary"
                disabled={readOnly || !h.approved}
                onClick={() => {
                  if (issue(claim.id, collector)) toast.success("Gatepass issued", "Status changed to Delivered to Customer.");
                }}
              >
                Generate gatepass & deliver
              </Button>
            </div>
          )}
          {!delivered && !h.approved && <p className="mt-2 text-[12px] text-muted">The gatepass can be generated once the Branch Manager has approved delivery.</p>}
        </Section>
      </div>
    </>
  );
}

/* ───────── Router ───────── */

const PANELS = { 1: Stage1, 2: Stage2, 3: Stage3, 4: Stage4, 5: Stage5, 6: Stage6, 7: Stage7, 8: Stage8, 9: Stage9, 10: Stage10 } as const;

/** The form for one stage. Keyed by claim and stage so its drafts reset when you move on. */
export function StagePanel({ claim, stage }: { claim: Claim; stage: keyof typeof PANELS }) {
  const Panel = PANELS[stage];
  const readOnly = stage !== claim.stage || !!claim.closedAt;
  return <Panel key={`${claim.id}:${stage}`} claim={claim} readOnly={readOnly} />;
}
