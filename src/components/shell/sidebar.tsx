"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookImage, Boxes, Building2, MonitorPlay, PackagePlus, PanelLeftClose, ChevronDown, PanelLeftOpen, ScrollText, Settings, ShieldCheck, Siren, Users, Wrench, X } from "lucide-react";
import { isRootEmail } from "@/lib/employees";
import { useApp } from "@/store/app-store";
import { useSessionEmployee } from "@/store/employee-store";
import { useIsDesktop } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { STAGES } from "@/lib/claims";
import { useClaimStats } from "@/components/claims/stats";
import { BrandLogo, LogoMark } from "./logo";

/** Everything the Admin can open from the sidebar. */
export const NAV = [
  { href: "/branches", label: "Branches", icon: Building2, group: "Workspace" },
  { href: "/stock", label: "All Stock", icon: Boxes, group: "Workspace" },
  { href: "/stock/add", label: "Add Stock", icon: PackagePlus, group: "Workspace" },
  { href: "/catalogue/explore", label: "Customer Showcase", icon: MonitorPlay, group: "Workspace" },
  { href: "/insurance", label: "Insurance Hub", icon: ShieldCheck, group: "Operations" },
  { href: "/claims", label: "Claims & Workshop", icon: Wrench, group: "Operations" },
  { href: "/employees", label: "Employees", icon: Users, adminOnly: true, group: "Management" },
  { href: "/catalogue/manage", label: "Catalogue Manager", icon: BookImage, adminOnly: true, group: "Management" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, rootOnly: true, group: "System" },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true, group: "System" },
] as const;

/** The nav item whose route best matches (longest prefix), so /stock/add does not also light up /stock. */
export function activeNav(pathname: string) {
  return [...NAV].filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
}

type NavItem = { href: string; label: string; icon: typeof Users; adminOnly?: boolean; rootOnly?: boolean; group: "Workspace" | "Operations" | "Management" | "System" };

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = activeNav(pathname)?.href === item.href;
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className="group relative flex h-9 items-center gap-3 rounded-lg px-3 outline-none">
      {active && <motion.span layoutId="nav-active" transition={spring} className="absolute inset-0 rounded-lg border border-line bg-hover" />}
      {active && <motion.span layoutId="nav-bar" transition={spring} className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-accent" />}
      <span className="relative z-10 grid h-4 w-4 shrink-0 place-items-center">
        <Icon className={cn("h-4 w-4", active ? "text-accent-text" : "text-muted group-hover:text-fg")} />
      </span>
      {!collapsed && <span className={cn("relative z-10 flex-1 truncate text-left text-[13px]", active ? "font-medium text-fg" : "text-muted group-hover:text-fg")}>{item.label}</span>}
      {collapsed && <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-line bg-overlay px-2 py-1 text-xs font-medium text-fg opacity-0 shadow-pop transition-opacity group-hover:opacity-100">{item.label}</span>}
    </Link>
  );
}

/** A count pill; turns red when something in it is overdue. */
function Pill({ n, hot, solid }: { n: number; hot?: boolean; solid?: boolean }) {
  return (
    <span className={cn("shrink-0 rounded-full px-1.5 text-[11px] font-medium tabular-nums", hot ? (solid ? "bg-danger text-white" : "bg-danger-tint text-danger") : "bg-fg/[0.07] text-muted")}>{n}</span>
  );
}

/** Claims & Workshop with its stages nested underneath: Code Red first, then the 10 SOP stages, each with a live count. */
function ClaimsNavGroup({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const stats = useClaimStats();
  const inClaims = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const subActive = pathname === "/claims/code-red" || pathname.startsWith("/claims/stage/");
  // Following the route unless the person has opened or closed it by hand.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? inClaims;
  const Icon = item.icon;
  const parentActive = inClaims && !subActive;

  if (collapsed) return <NavLink item={item} collapsed onNavigate={onNavigate} />;

  const sub = "group flex items-start gap-2 rounded-md px-2 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/50";
  return (
    <div>
      <div className="relative flex h-9 items-center rounded-lg">
        {parentActive && <motion.span layoutId="nav-active" transition={spring} className="absolute inset-0 rounded-lg border border-line bg-hover" />}
        {parentActive && <motion.span layoutId="nav-bar" transition={spring} className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-accent" />}
        <Link href={item.href} onClick={() => {
            setManual(true);
            onNavigate();
          }} aria-current={parentActive ? "page" : undefined} className="group relative z-10 flex h-9 min-w-0 flex-1 items-center gap-3 rounded-lg pl-3 outline-none">
          <Icon className={cn("h-4 w-4 shrink-0", inClaims ? "text-accent-text" : "text-muted group-hover:text-fg")} />
          <span className={cn("flex-1 truncate text-left text-[13px]", inClaims ? "font-medium text-fg" : "text-muted group-hover:text-fg")}>{item.label}</span>
          {stats.breachCount > 0 && <Pill n={stats.breachCount} hot solid />}
        </Link>
        <button type="button" onClick={() => setManual(!open)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`} className="relative z-10 grid h-9 w-8 shrink-0 place-items-center rounded-lg text-faint outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-blue-500/50">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="ml-[18px] mt-0.5 space-y-0.5 overflow-hidden border-l border-line pl-2" aria-label="Claim stages">
            <li>
              <Link href="/claims/code-red" onClick={onNavigate} aria-current={pathname === "/claims/code-red" ? "page" : undefined} className={cn(sub, pathname === "/claims/code-red" ? "bg-danger-tint" : "hover:bg-hover")}>
                <Siren className={cn("mt-px h-3.5 w-3.5 shrink-0 text-danger", stats.breachCount > 0 && "animate-pulse")} />
                <span className="flex-1 text-[12.5px] font-semibold leading-4 text-danger">Code Red (SLA Breaches)</span>
                <Pill n={stats.breachCount} hot={stats.breachCount > 0} solid />
              </Link>
            </li>
            {STAGES.map((st) => {
              const href = `/claims/stage/${st.no}`;
              const active = pathname === href;
              return (
                <li key={st.no}>
                  <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={st.name} className={cn(sub, active ? "bg-hover" : "hover:bg-hover")}>
                    <span className={cn("w-4 shrink-0 text-right text-[12px] leading-4 tabular-nums", active ? "text-accent-text" : "text-faint")}>{st.no}.</span>
                    <span className={cn("line-clamp-2 flex-1 text-[12.5px] leading-4", active ? "font-medium text-fg" : "text-muted group-hover:text-fg")}>{st.name}</span>
                    <Pill n={stats.perStage[st.no]} hot={stats.breachPerStage[st.no] > 0} />
                  </Link>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const mobileNav = useApp((s) => s.mobileNav);
  const toggle = useApp((s) => s.toggleSidebar);
  const setMobileNav = useApp((s) => s.setMobileNav);
  const isDesktop = useIsDesktop();
  const me = useSessionEmployee();
  // Employees is for Admins only; everyone else never sees the entry.
  const items = (NAV as readonly NavItem[]).filter((n) => (!n.adminOnly || me?.role === "Admin") && (!n.rootOnly || isRootEmail(me?.email)));
  const slim = isDesktop && collapsed;

  return (
    <>
      <AnimatePresence>
        {mobileNav && !isDesktop && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-[2px] lg:hidden" onClick={() => setMobileNav(false)} />}
      </AnimatePresence>
      <motion.aside
        initial={false}
        animate={{ width: slim ? 68 : 248 }}
        transition={spring}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-line bg-surface px-3 pb-3 pt-3.5 transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] lg:static lg:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex items-center gap-2.5 px-1", slim && "justify-center px-0")}>
          {slim ? <LogoMark /> : <BrandLogo className="w-[184px] shrink" />}
          {!slim && <span className="flex-1" />}
          {!isDesktop && (
            <Button variant="ghost" size="sm" iconOnly onClick={() => setMobileNav(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Scrolls when the Claims stages are open; the slim rail has room for everything and its tooltips must not be clipped. */}
        <div className={cn("-mx-3 min-h-0 flex-1 px-3 pb-2", !slim && "overflow-y-auto pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)] [scrollbar-width:thin]")}>
        {(["Workspace", "Operations", "Management"] as const).map((group) => {
          const list = items.filter((n) => n.group === group);
          if (!list.length) return null;
          return (
            <div key={group}>
              <p className={cn("mb-1.5 mt-6 px-3 text-[11px] font-medium uppercase tracking-wider text-faint", slim && "invisible")}>{group}</p>
              <nav className="flex flex-col gap-0.5" aria-label={group}>
                {list.map((n) => (n.href === "/claims" ? <ClaimsNavGroup key={n.href} item={n} collapsed={slim} onNavigate={() => setMobileNav(false)} /> : <NavLink key={n.href} item={n} collapsed={slim} onNavigate={() => setMobileNav(false)} />))}
              </nav>
            </div>
          );
        })}
        </div>

        <div className="pt-3">
          {items.some((n) => n.group === "System") && (
            <div className="mb-2">
              <p className={cn("mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-faint", slim && "invisible")}>System</p>
              <nav className="flex flex-col gap-0.5" aria-label="System">
                {items
                  .filter((n) => n.group === "System")
                  .map((n) => (
                    <NavLink key={n.href} item={n} collapsed={slim} onNavigate={() => setMobileNav(false)} />
                  ))}
              </nav>
            </div>
          )}
          {isDesktop && (
            <button type="button" onClick={toggle} className={cn("group flex h-8 w-full items-center gap-3 rounded-lg px-3 text-xs text-faint outline-none transition-colors hover:bg-hover hover:text-fg", slim && "justify-center px-0")} aria-label={slim ? "Expand sidebar" : "Collapse sidebar"}>
              {slim ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!slim && <span>Collapse</span>}
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}
