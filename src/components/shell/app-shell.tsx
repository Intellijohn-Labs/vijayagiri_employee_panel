"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { useTheme } from "@/store/theme-store";
import { useStock } from "@/store/stock-store";
import { useBranchStore } from "@/store/branch-store";
import { useCatalogue } from "@/store/catalogue-store";
import { useInsurance } from "@/store/insurance-store";
import { useClaims } from "@/store/claims-store";
import { useSettings } from "@/store/settings-store";
import { useOfficialImages } from "@/lib/official-images";
import { toast } from "@/store/toast-store";
import { canAccess, useEmployees, useSessionEmployee } from "@/store/employee-store";
import { Toaster } from "@/components/ui/toaster";
import { ClaimsWatcher } from "@/components/claims/watcher";
import { spring } from "@/lib/motion";
import { watermarkMask } from "@/components/auth/auth-kit";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * "Yamaha — Revs Your Heart" brand watermark. A fixed, non-interactive layer behind the page
 * content: the PNG is used as an alpha mask so it takes a single flat tint per theme
 * (brand blue on light, white on dark) at very low opacity. Cards sit above it on opaque surfaces.
 */
function Watermark() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
      <div className="absolute bottom-[5%] right-[3%] aspect-[735/306] w-[min(680px,72%)] bg-accent opacity-[0.04] dark:bg-white dark:opacity-[0.03]" style={watermarkMask} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const init = useApp((s) => s.init);
  const tick = useApp((s) => s.tick);
  const hydrateTheme = useTheme((s) => s.hydrate);
  const hydrateStock = useStock((s) => s.hydrate);
  const hydrateBranches = useBranchStore((s) => s.hydrate);
  const hydrateEmployees = useEmployees((s) => s.hydrate);
  const hydrateCatalogue = useCatalogue((s) => s.hydrate);
  const hydrateInsurance = useInsurance((s) => s.hydrate);
  const hydrateClaims = useClaims((s) => s.hydrate);
  const loadClaims = useClaims((s) => s.load);
  const loadBranches = useBranchStore((s) => s.load);
  const hydrateSettings = useSettings((s) => s.hydrate);
  const loadOfficial = useOfficialImages((s) => s.load);
  const officialLoaded = useOfficialImages((s) => s.loaded);
  const sessionMinutes = useSettings((s) => s.settings.security.sessionMinutes);
  const ready = useEmployees((s) => s.ready);
  const signOut = useEmployees((s) => s.signOut);
  const me = useSessionEmployee();
  const router = useRouter();
  const scope = useApp((s) => s.branchScope);
  const setBranchScope = useApp((s) => s.setBranchScope);

  useEffect(() => {
    hydrateTheme();
    init();
    hydrateStock();
    hydrateBranches();
    hydrateEmployees();
    hydrateCatalogue();
    hydrateInsurance();
    hydrateClaims();
    hydrateSettings();
    loadOfficial();
  }, [hydrateTheme, init, hydrateStock, hydrateBranches, hydrateEmployees, hydrateCatalogue, hydrateInsurance, hydrateClaims, hydrateSettings, loadOfficial]);

  // Claims need a session on the server, so they (and the branch list) are read again once someone has signed in.
  const meId = me?.id;
  useEffect(() => {
    if (!meId) return;
    void loadClaims();
    void loadBranches();
  }, [meId, loadClaims, loadBranches]);

  // Strict access: no session, a removed employee, or a deactivated one all end up back at the sign-in screen.
  const signedIn = !!me && me.status === "Active";
  useEffect(() => {
    if (!ready || pathname === "/login") return;
    if (!signedIn) {
      if (me) signOut();
      router.replace("/login");
    } else if (scope !== "all" && !canAccess(me, scope)) {
      // The remembered showroom is not one this person may open.
      setBranchScope("all", { silent: true });
    }
  }, [ready, signedIn, me, pathname, scope, router, signOut, setBranchScope]);

  // Session timeout from Settings → Security: signed out after this long without a tap or keypress.
  // The customer showcase is exempt (it has its own return-to-home timer and must stay up on a showroom screen).
  const timedOut = signedIn && sessionMinutes > 0 && pathname !== "/login" && !pathname.startsWith("/catalogue/explore");
  useEffect(() => {
    if (!timedOut) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      signOut();
      toast.info("Signed out for inactivity", `You were away for ${sessionMinutes} minute${sessionMinutes === 1 ? "" : "s"}.`);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, sessionMinutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, arm, { passive: true });
    arm();
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, arm);
    };
  }, [timedOut, sessionMinutes, signOut]);

  // Keep open / closed badges honest.
  useEffect(() => {
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tick]);

  // The login page and the customer showcase are standalone full-screen experiences: no sidebar or top bar.
  // The showcase still needs a signed-in employee, so it waits for the session like every other page.
  if (pathname === "/login") {
    return (
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster />
      </MotionConfig>
    );
  }
  if (pathname.startsWith("/catalogue/explore")) {
    return (
      <MotionConfig reducedMotion="user">
        {ready && signedIn && officialLoaded ? children : null}
        <Toaster />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh overflow-hidden bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="relative min-h-0 flex-1">
            <Watermark />
            <main id="main" className="relative z-10 h-full overflow-y-auto">
              <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: spring }} className="mx-auto w-full max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                {ready && signedIn && officialLoaded ? children : null}
              </motion.div>
            </main>
          </div>
        </div>
      </div>
      {signedIn && <ClaimsWatcher />}
      <Toaster />
    </MotionConfig>
  );
}
