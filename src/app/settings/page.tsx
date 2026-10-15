"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Lock, RotateCcw, Save } from "lucide-react";
import { hashPassword, useEmployees, useIsAdmin, useSessionEmployee } from "@/store/employee-store";
import { DEFAULT_SETTINGS, THEME_DEFAULT_KEY, useSettings, type Settings } from "@/store/settings-store";
import { useTheme } from "@/store/theme-store";
import { toast } from "@/store/toast-store";
import { PASSCODE_SALT } from "@/components/auth/passcode";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Card, PageHeader } from "@/components/ui/primitives";
import { AppearanceTab, FinanceTab, ProfileTab, SecurityTab, ShowcaseTab } from "@/components/settings/tabs";

type Tab = "profile" | "finance" | "showcase" | "security" | "appearance";
const TABS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Dealership & Network" },
  { value: "finance", label: "Finance & EMI" },
  { value: "showcase", label: "Showcase & Catalogue" },
  { value: "security", label: "Security" },
  { value: "appearance", label: "Appearance & Sound" },
];

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const CIN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SettingsPage() {
  const me = useSessionEmployee();
  const admin = useIsAdmin();
  const hydrated = useSettings((s) => s.hydrated);

  if (me && !admin) {
    return (
      <Card className="mx-auto mt-10 flex max-w-md flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-hover text-muted">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-sm font-medium text-fg">Settings is for Admins only</h1>
        <p className="mt-1 text-[13px] text-muted">Ask an Admin if something needs to change.</p>
      </Card>
    );
  }
  // The form copies the saved settings when it first renders, so wait until they have been read from the browser.
  if (!hydrated) return <div className="h-64 animate-pulse rounded-xl bg-hover" aria-busy />;
  return <SettingsForm />;
}

function SettingsForm() {
  const saved = useSettings((s) => s.settings);
  const saveSettings = useSettings((s) => s.save);
  const signOut = useEmployees((s) => s.signOut);

  const [tab, setTab] = useState<Tab>("profile");
  const [draft, setDraft] = useState<Settings>(saved);
  const [passcode, setPasscode] = useState({ code: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved) || !!passcode.code || !!passcode.confirm, [draft, saved, passcode]);

  const patch = <K extends keyof Settings>(section: K, values: Partial<Settings[K]>) => {
    setDraft((d) => ({ ...d, [section]: { ...d[section], ...values } }));
    setErrors({});
  };

  /** Problems with the draft, keyed by field; also says which tab each belongs to. */
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const { profile: p, finance: f, showcase: s, security: sec } = draft;
    if (!p.legalName.trim()) e.legalName = "Enter the dealership's legal name";
    if (p.gstin && !GSTIN.test(p.gstin)) e.gstin = "Doesn't look like a valid GSTIN";
    if (p.cin && !CIN.test(p.cin)) e.cin = "Doesn't look like a valid CIN";
    if (p.hotline && p.hotline.replace(/\D/g, "").length < 6) e.hotline = "Enter a valid phone number";
    if (p.email && !EMAIL.test(p.email)) e.email = "Enter a valid email address";
    if (!p.opens || !p.closes || p.opens === p.closes) e.hours = "Set different opening and closing times";
    if (!(f.interest >= 6.5 && f.interest <= 16)) e.interest = "Between 6.5% and 16%";
    if (!(f.minDownPct >= 0 && f.minDownPct <= 90)) e.minDownPct = "Between 0% and 90%";
    if (f.schemes.some((x) => !x.name.trim() || !(x.rate >= 6.5 && x.rate <= 16))) e.schemes = "Every financier needs a name and a rate between 6.5% and 16%";
    const target = s.notifyTarget.trim();
    if (target && !EMAIL.test(target) && target.replace(/\D/g, "").length < 10) e.notifyTarget = "Enter an email address or a phone number";
    if (sec.passcodeOn) {
      if (!sec.passcodeHash && !passcode.code) e.passcode = "Choose a 6-digit passcode";
      else if (passcode.code && passcode.code.length !== 6) e.passcode = "The passcode must be 6 digits";
      if (passcode.code && passcode.code !== passcode.confirm) e.passcodeConfirm = "The passcodes don't match";
    }
    return e;
  };
  const tabOf = (key: string): Tab => (["legalName", "gstin", "cin", "hotline", "email", "hours"].includes(key) ? "profile" : ["interest", "minDownPct", "schemes"].includes(key) ? "finance" : key === "notifyTarget" ? "showcase" : "security");

  const save = async () => {
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setTab(tabOf(first));
      return void toast.error("Some settings need attention", e[first]);
    }
    setBusy(true);
    try {
      let next: Settings = { ...draft, profile: { ...draft.profile, legalName: draft.profile.legalName.trim() }, showcase: { ...draft.showcase, notifyTarget: draft.showcase.notifyTarget.trim() } };
      if (passcode.code) next = { ...next, security: { ...next.security, passcodeHash: await hashPassword(PASSCODE_SALT, passcode.code) } };
      const themeChanged = next.appearance.theme !== saved.appearance.theme;
      if (!saveSettings(next)) return;
      if (themeChanged) {
        // The new default takes over straight away: drop this browser's own pick and apply it.
        const resolved = next.appearance.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next.appearance.theme;
        useTheme.getState().setTheme(resolved);
        try {
          localStorage.removeItem("vg.theme");
          localStorage.setItem(THEME_DEFAULT_KEY, next.appearance.theme);
        } catch {
          /* storage unavailable */
        }
      }
      setDraft(next);
      setPasscode({ code: "", confirm: "" });
      toast.success("Settings saved", "The changes are live across the app.");
    } catch (err) {
      toast.error("Couldn't save the settings", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!window.confirm("Put every setting back to the defaults? Nothing changes until you press Save Changes.")) return;
    setDraft({ ...DEFAULT_SETTINGS, security: { ...DEFAULT_SETTINGS.security } });
    setPasscode({ code: "", confirm: "" });
    setErrors({});
    toast.info("Defaults restored", "Review them, then press Save Changes to apply.");
  };

  const forceLogout = () => {
    if (!window.confirm("Sign out everyone on this device, including you?")) return;
    signOut();
    toast.success("All sessions signed out", "Everyone on this device has to sign in again.");
  };

  const common = { draft, patch, errors };
  return (
    <>
      <PageHeader title="Settings" description="Dealership details, finance defaults, showcase preferences, security and appearance. Saved changes apply across the whole app." />

      <div className="mb-5">
        <PillTabs id="settings-tab" label="Settings sections" value={tab} onChange={setTab} tabs={TABS} />
      </div>

      <div className="pb-4">
        {tab === "profile" && <ProfileTab {...common} />}
        {tab === "finance" && <FinanceTab {...common} />}
        {tab === "showcase" && <ShowcaseTab {...common} />}
        {tab === "security" && <SecurityTab {...common} passcode={passcode} onPasscode={setPasscode} onForceLogout={forceLogout} />}
        {tab === "appearance" && <AppearanceTab {...common} />}
      </div>

      {/* sticky footer */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-5 mt-2 border-t border-line bg-overlay/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mb-7 lg:px-8">
        <div className="flex items-center gap-3">
          <motion.p initial={false} animate={{ opacity: dirty ? 1 : 0.55 }} transition={spring} className={cn("flex-1 text-[13px]", dirty ? "font-medium text-fg" : "text-muted")}>
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </motion.p>
          <Button type="button" leading={<RotateCcw className="h-3.5 w-3.5" />} onClick={reset}>
            Reset to Defaults
          </Button>
          <Button type="button" variant="primary" className="bg-[#003399] text-white hover:bg-[#0047AB]" leading={<Save className="h-3.5 w-3.5" />} loading={busy} disabled={!dirty} onClick={() => void save()}>
            Save Changes
          </Button>
        </div>
      </div>
    </>
  );
}
