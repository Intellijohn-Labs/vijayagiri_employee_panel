"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookImage, Boxes, Building2, MonitorPlay, PackagePlus, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useSessionEmployee } from "@/store/employee-store";
import { useIsDesktop } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { BrandLogo, LogoMark } from "./logo";

/** Everything the Admin can open from the sidebar. */
export const NAV = [
  { href: "/branches", label: "Branches", icon: Building2, group: "Workspace" },
  { href: "/stock", label: "All Stock", icon: Boxes, group: "Workspace" },
  { href: "/stock/add", label: "Add Stock", icon: PackagePlus, group: "Workspace" },
  { href: "/catalogue/explore", label: "Customer Showcase", icon: MonitorPlay, group: "Workspace" },
  { href: "/insurance", label: "Insurance Hub", icon: ShieldCheck, group: "Operations" },
  { href: "/employees", label: "Employees", icon: Users, adminOnly: true, group: "Management" },
  { href: "/catalogue/manage", label: "Catalogue Manager", icon: BookImage, adminOnly: true, group: "Management" },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true, group: "System" },
] as const;

/** The nav item whose route best matches (longest prefix), so /stock/add does not also light up /stock. */
export function activeNav(pathname: string) {
  return [...NAV].filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
}

type NavItem = { href: string; label: string; icon: typeof Users; adminOnly?: boolean; group: "Workspace" | "Operations" | "Management" | "System" };

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

export function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const mobileNav = useApp((s) => s.mobileNav);
  const toggle = useApp((s) => s.toggleSidebar);
  const setMobileNav = useApp((s) => s.setMobileNav);
  const isDesktop = useIsDesktop();
  const me = useSessionEmployee();
  // Employees is for Admins only; everyone else never sees the entry.
  const items = (NAV as readonly NavItem[]).filter((n) => !n.adminOnly || me?.role === "Admin");
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

        {(["Workspace", "Operations", "Management"] as const).map((group) => {
          const list = items.filter((n) => n.group === group);
          if (!list.length) return null;
          return (
            <div key={group}>
              <p className={cn("mb-1.5 mt-6 px-3 text-[11px] font-medium uppercase tracking-wider text-faint", slim && "invisible")}>{group}</p>
              <nav className="flex flex-col gap-0.5" aria-label={group}>
                {list.map((n) => (
                  <NavLink key={n.href} item={n} collapsed={slim} onNavigate={() => setMobileNav(false)} />
                ))}
              </nav>
            </div>
          );
        })}

        <div className="mt-auto pt-4">
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
            <button onClick={toggle} className={cn("group flex h-8 w-full items-center gap-3 rounded-lg px-3 text-xs text-faint outline-none transition-colors hover:bg-hover hover:text-fg", slim && "justify-center px-0")} aria-label={slim ? "Expand sidebar" : "Collapse sidebar"}>
              {slim ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!slim && <span>Collapse</span>}
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}
