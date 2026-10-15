"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, LogOut, Monitor, Moon, Plus, Sun, Trash2, Upload, Volume2 } from "lucide-react";
import { toast } from "@/store/toast-store";
import { hoursText, type Settings } from "@/store/settings-store";
import { sfx } from "@/lib/sound";
import { processImage } from "@/lib/images";
import { TENURE_OPTIONS, inr } from "@/lib/catalogue";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { Choice, NumBox, Section, Toggle, fieldLabel, selectCls } from "./controls";
import { ShowroomList } from "./showrooms";

export interface TabProps {
  draft: Settings;
  /** Replace one section's values */
  patch: <K extends keyof Settings>(section: K, values: Partial<Settings[K]>) => void;
  errors: Record<string, string>;
}

/* ───────── Tab 1: dealership ───────── */

const LOGO_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];

function LogoSlot({ title, value, mode, onChange }: { title: string; value: string | null; mode: "light" | "dark"; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return void toast.error("Use an SVG, PNG, JPG or WEBP logo");
    if (file.size > 2 * 1024 * 1024) return void toast.error("Logo is larger than 2 MB");
    try {
      if (file.type === "image/svg+xml") {
        const url = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        onChange(url);
      } else onChange((await processImage(file, 800)).src);
    } catch {
      toast.error("Couldn't read that logo", "The file may be damaged.");
    }
  };
  return (
    <div>
      <span className={fieldLabel}>{title}</span>
      <div className={cn("grid h-24 place-items-center rounded-xl border border-line p-3", mode === "light" ? "bg-white" : "bg-slate-900")}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={cn("text-xs", mode === "light" ? "text-slate-500" : "text-slate-400")}>{mode === "light" ? "Official Vijayagiri logo" : "Official logo, light tint"}</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" leading={<Upload className="h-3.5 w-3.5" />} onClick={() => ref.current?.click()}>
          Upload
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" leading={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange(null)}>
            Use official
          </Button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept={LOGO_TYPES.join(",")}
        hidden
        data-testid={`logo-${mode}`}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function DealershipDetails({ draft, patch, errors }: TabProps) {
  const p = draft.profile;
  const set = (v: Partial<Settings["profile"]>) => patch("profile", v);
  return (
    <div className="space-y-5">
      <Section title="Dealership profile" hint="Printed on quotations and used in messages sent to customers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dealership legal name" required error={errors.legalName} className="sm:col-span-2">
            <Input value={p.legalName} invalid={!!errors.legalName} onChange={(e) => set({ legalName: e.target.value })} />
          </Field>
          <Field label="Head Office address" className="sm:col-span-2">
            <Textarea rows={2} value={p.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="GSTIN" error={errors.gstin} hint="15 characters">
            <Input value={p.gstin} invalid={!!errors.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} placeholder="32ABCDE1234F1Z5" className="font-mono uppercase" maxLength={15} />
          </Field>
          <Field label="CIN" error={errors.cin} hint="21 characters, if a company">
            <Input value={p.cin} invalid={!!errors.cin} onChange={(e) => set({ cin: e.target.value.toUpperCase() })} placeholder="U12345KL2000PTC000000" className="font-mono uppercase" maxLength={21} />
          </Field>
          <Field label="Network central hotline" error={errors.hotline}>
            <Input value={p.hotline} invalid={!!errors.hotline} onChange={(e) => set({ hotline: e.target.value })} inputMode="tel" placeholder="9961774455" />
          </Field>
          <Field label="Official support email" error={errors.email}>
            <Input type="email" value={p.email} invalid={!!errors.email} onChange={(e) => set({ email: e.target.value })} placeholder="support@example.com" />
          </Field>
        </div>
      </Section>

      <Section title="Default operating timings" hint="Branches follow these hours unless an Admin sets their own. The Open / Closed badge on Branches is worked out from them automatically.">
        <div className="grid max-w-md grid-cols-2 gap-4">
          <Field label="Opens">
            <Input type="time" value={p.opens} onChange={(e) => set({ opens: e.target.value })} />
          </Field>
          <Field label="Closes" error={errors.hours}>
            <Input type="time" value={p.closes} invalid={!!errors.hours} onChange={(e) => set({ closes: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Shown as <strong className="text-fg">{hoursText(p)}</strong>.
        </p>
      </Section>

      <Section title="Logo" hint="Shown in the sidebar, on the sign-in screen and in the customer showcase. SVG or PNG with a transparent background works best.">
        <div className="grid gap-5 sm:grid-cols-2">
          <LogoSlot title="Light mode logo" value={p.logoLight} mode="light" onChange={(v) => set({ logoLight: v })} />
          <LogoSlot title="Dark mode logo" value={p.logoDark} mode="dark" onChange={(v) => set({ logoDark: v })} />
        </div>
        <p className="mt-3 text-xs text-muted">With no dark logo, the light logo is shown in white on dark backgrounds.</p>
      </Section>
    </div>
  );
}

/** Tab 1: the showroom list comes first. Dealership-wide details (legal name, logos, default hours) sit in a folded section underneath. */
export function ProfileTab(props: TabProps) {
  const [wide, setWide] = useState(false);
  // A validation error inside the folded section opens it.
  const show = wide || ["legalName", "gstin", "cin", "hotline", "email", "hours"].some((k) => props.errors[k]);
  return (
    <div className="space-y-6">
      <ShowroomList />
      <div>
        <button type="button" onClick={() => setWide((w) => !w)} aria-expanded={show} className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-blue-500/50">
          <span>
            <span className="block text-sm font-semibold text-fg">Dealership-wide details</span>
            <span className="block text-xs text-muted">Legal name, GSTIN / CIN, hotline, default timings and logos. Saved with the Save Changes button below.</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", show && "rotate-180")} />
        </button>
        {show && (
          <div className="mt-4">
            <DealershipDetails {...props} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Tab 2: finance ───────── */

export function FinanceTab({ draft, patch, errors }: TabProps) {
  const f = draft.finance;
  const set = (v: Partial<Settings["finance"]>) => patch("finance", v);
  const setScheme = (id: string, v: Partial<Settings["finance"]["schemes"][number]>) => set({ schemes: f.schemes.map((s) => (s.id === id ? { ...s, ...v } : s)) });
  return (
    <div className="space-y-5">
      <Section title="EMI calculator defaults" hint="Where the customer's EMI calculator starts. Customers can still change the rate and tenure while they explore.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className={fieldLabel}>Default interest rate (% a year)</span>
            <NumBox label="Default interest rate" value={f.interest} min={6.5} max={16} step={0.25} suffix="%" onChange={(v) => set({ interest: v })} />
            {errors.interest && <span className="mt-1 block text-[11.5px] text-danger">{errors.interest}</span>}
          </div>
          <div>
            <span className={fieldLabel}>Minimum down payment</span>
            <NumBox label="Minimum down payment percent" value={f.minDownPct} min={0} max={90} step={1} suffix="%" onChange={(v) => set({ minDownPct: v })} />
            {errors.minDownPct && <span className="mt-1 block text-[11.5px] text-danger">{errors.minDownPct}</span>}
            <span className="mt-1 block text-[11.5px] text-muted">Also the starting down payment.</span>
          </div>
          <div>
            <span className={fieldLabel}>Default loan tenure</span>
            <select value={f.tenure} onChange={(e) => set({ tenure: Number(e.target.value) })} className={selectCls} aria-label="Default loan tenure">
              {TENURE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} months ({t / 12} {t === 12 ? "year" : "years"})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Bank / financier scheme presets" hint="Quick-pick buttons under the interest slider in the customer's calculator. Switch off the ones you don't offer.">
        <ul className="space-y-2">
          {f.schemes.map((s) => (
            <li key={s.id} className="grid grid-cols-[auto_1fr_7rem_auto] items-center gap-3">
              <button type="button" role="switch" aria-checked={s.enabled} aria-label={`Offer ${s.name}`} onClick={() => setScheme(s.id, { enabled: !s.enabled })} className={cn("relative h-6 w-11 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", s.enabled ? "bg-[#003399]" : "bg-slate-300 dark:bg-slate-600")}>
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]", s.enabled ? "left-[22px]" : "left-0.5")} />
              </button>
              <Input value={s.name} onChange={(e) => setScheme(s.id, { name: e.target.value })} aria-label="Financier name" invalid={!s.name.trim()} />
              <NumBox label={`${s.name} interest rate`} value={s.rate} min={6.5} max={16} step={0.01} suffix="%" onChange={(v) => setScheme(s.id, { rate: v })} />
              <Button type="button" size="sm" variant="ghost" iconOnly aria-label={`Remove ${s.name}`} onClick={() => set({ schemes: f.schemes.filter((x) => x.id !== s.id) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        {errors.schemes && <p className="mt-2 text-[11.5px] text-danger">{errors.schemes}</p>}
        <Button type="button" className="mt-3" leading={<Plus className="h-3.5 w-3.5" />} onClick={() => set({ schemes: [...f.schemes, { id: `s-${Date.now().toString(36)}`, name: "", rate: f.interest, enabled: true }] })}>
          Add financier
        </Button>
      </Section>

      <Section title="Processing & documentation charges" hint="One-time financier charges, shown to the customer as cash due upfront at delivery and printed on the quotation. They are not added to the EMI.">
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <div>
            <span className={fieldLabel}>Processing fee</span>
            <NumBox label="Processing fee in rupees" value={f.processingFee} prefix="₹" onChange={(v) => set({ processingFee: v })} />
          </div>
          <div>
            <span className={fieldLabel}>Documentation charge</span>
            <NumBox label="Documentation charge in rupees" value={f.docCharge} prefix="₹" onChange={(v) => set({ docCharge: v })} />
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Customers will see <strong className="text-fg">{inr(f.processingFee + f.docCharge)}</strong> in charges.
        </p>
      </Section>
    </div>
  );
}

/* ───────── Tab 3: showcase ───────── */

export function ShowcaseTab({ draft, patch, errors }: TabProps) {
  const s = draft.showcase;
  const set = (v: Partial<Settings["showcase"]>) => patch("showcase", v);
  return (
    <div className="space-y-5">
      <Section title="What customers see" hint="Applies to the Customer Showcase and the quotations printed from it.">
        <div className="space-y-3">
          <Toggle on={s.priceSplit} onChange={(v) => set({ priceSplit: v })} title="Show the ex-showroom / on-road price split" hint="Off: customers only see one on-road price, without the ex-showroom and RTO breakdown." />
          <Toggle on={s.interBranch} onChange={(v) => set({ interBranch: v })} title="Show stock at other branches" hint="Off: hides the “Check Yard Availability Across Other Branches” button." />
        </div>
      </Section>

      <Section title="Test ride requests" hint="Where to send a request once it is taken. The salesperson gets a one-tap button to notify this contact.">
        <Field label="Notification target" error={errors.notifyTarget} hint="email address or WhatsApp number" className="max-w-md">
          <Input value={s.notifyTarget} invalid={!!errors.notifyTarget} onChange={(e) => set({ notifyTarget: e.target.value })} placeholder="sales@example.com or 98470 12345" />
        </Field>
        <p className="mt-2 text-xs text-muted">WhatsApp can pre-fill a message to a number but not to a group, so use a number or an email address.</p>
      </Section>

      <Section title="Kiosk idle timeout" hint="After this long with no touch, the showcase closes the open bike and returns to the home screen for the next customer.">
        <Choice
          label="Kiosk idle timeout"
          value={s.idleMinutes}
          onChange={(v) => set({ idleMinutes: v })}
          options={[
            { value: 1, label: "1 minute" },
            { value: 2, label: "2 minutes" },
            { value: 5, label: "5 minutes" },
            { value: 10, label: "10 minutes" },
            { value: 0, label: "Never" },
          ]}
        />
      </Section>
    </div>
  );
}

/* ───────── Tab 4: security ───────── */

export function SecurityTab({ draft, patch, errors, passcode, onPasscode, onForceLogout }: TabProps & { passcode: { code: string; confirm: string }; onPasscode: (v: { code: string; confirm: string }) => void; onForceLogout: () => void }) {
  const s = draft.security;
  const set = (v: Partial<Settings["security"]>) => patch("security", v);
  return (
    <div className="space-y-5">
      <Section title="Session timeout" hint="Employees are signed out after this long without a tap or keypress. The customer showcase is exempt: it has its own return-to-home timer.">
        <Choice
          label="Session timeout"
          value={s.sessionMinutes}
          onChange={(v) => set({ sessionMinutes: v })}
          options={[
            { value: 15, label: "15 minutes" },
            { value: 30, label: "30 minutes" },
            { value: 60, label: "1 hour" },
            { value: 120, label: "2 hours" },
            { value: 0, label: "Never" },
          ]}
        />
      </Section>

      <Section title="Admin passcode" hint="An extra step for Admin accounts: after the password, they must enter this passcode. A shared-device safeguard, not a replacement for a real second factor.">
        <Toggle on={s.passcodeOn} onChange={(v) => set({ passcodeOn: v })} title="Require a passcode for Admin sign-in" />
        {s.passcodeOn && (
          <div className="mt-4 grid max-w-md gap-4 sm:grid-cols-2">
            <Field label={s.passcodeHash ? "New passcode (optional)" : "Passcode"} hint="6 digits" error={errors.passcode}>
              <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={passcode.code} invalid={!!errors.passcode} onChange={(e) => onPasscode({ ...passcode, code: e.target.value.replace(/\D/g, "") })} placeholder="••••••" className="tracking-[0.3em]" />
            </Field>
            <Field label="Confirm passcode" error={errors.passcodeConfirm}>
              <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={passcode.confirm} invalid={!!errors.passcodeConfirm} onChange={(e) => onPasscode({ ...passcode, confirm: e.target.value.replace(/\D/g, "") })} placeholder="••••••" className="tracking-[0.3em]" />
            </Field>
            {s.passcodeHash && <p className="text-xs text-muted sm:col-span-2">A passcode is already set. Leave these empty to keep it.</p>}
          </div>
        )}
      </Section>

      <Section title="Employee password policy" hint="Applied when an invited employee sets their password.">
        <div className="max-w-md space-y-3">
          <div>
            <span className={fieldLabel}>Minimum length</span>
            <select value={s.minPassword} onChange={(e) => set({ minPassword: Number(e.target.value) })} className={selectCls} aria-label="Minimum password length">
              {[6, 8, 10, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n} characters
                </option>
              ))}
            </select>
          </div>
          <Toggle on={s.requireMixed} onChange={(v) => set({ requireMixed: v })} title="Require letters and numbers" />
          <p className="text-xs text-muted">Passwords are reset by an Admin or Central Admin. “Forgot password?” never emails a link.</p>
        </div>
      </Section>

      <Section title="Sessions" hint="Signs everyone out on this device, including you. There is no server, so sessions on other devices are not affected.">
        <Button type="button" variant="danger" leading={<LogOut className="h-3.5 w-3.5" />} onClick={onForceLogout}>
          Force logout all sessions
        </Button>
      </Section>
    </div>
  );
}

/* ───────── Tab 5: appearance & sound ───────── */

const THEMES: { value: Settings["appearance"]["theme"]; label: string; hint: string; icon: ReactNode }[] = [
  { value: "system", label: "System", hint: "Follows the device", icon: <Monitor className="h-5 w-5" /> },
  { value: "light", label: "Light", hint: "Racing Blue & White", icon: <Sun className="h-5 w-5" /> },
  { value: "dark", label: "Dark (Yamaha Racing Slate)", hint: "Deep slate with blue accents", icon: <Moon className="h-5 w-5" /> },
];

export function AppearanceTab({ draft, patch }: TabProps) {
  const a = draft.appearance;
  const set = (v: Partial<Settings["appearance"]>) => patch("appearance", v);
  return (
    <div className="space-y-5">
      <Section title="Default theme" hint="Used on any device where nobody has picked a theme with the sun / moon button.">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Default theme">
          {THEMES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={a.theme === t.value} onClick={() => set({ theme: t.value })} className={cn("flex items-start gap-3 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50", a.theme === t.value ? "border-[#003399]/60 bg-tint" : "border-line bg-surface hover:bg-hover")}>
              <span className="mt-0.5 text-[#003399] dark:text-sky-300">{t.icon}</span>
              <span>
                <span className="block text-[13.5px] font-semibold text-fg">{t.label}</span>
                <span className="block text-xs text-muted">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sound effects" hint="Synthesised engine sounds, no audio files. Browsers only play sound after a tap or keypress.">
        <Toggle on={a.sound} onChange={(v) => set({ sound: v })} title="Tachometer rev and ignition sounds" hint="A throttle blip as you type on the sign-in screen, a full rev at launch, and a soft chirp on saved actions." />
        <Button type="button" className="mt-3" leading={<Volume2 className="h-3.5 w-3.5" />} onClick={() => sfx.launch(true)}>
          Play a test rev
        </Button>
      </Section>
    </div>
  );
}
