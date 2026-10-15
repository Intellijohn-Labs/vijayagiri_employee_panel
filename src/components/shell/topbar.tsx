"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu, Moon, PanelLeft, Sun } from "lucide-react";
import { useApp } from "@/store/app-store";
import { useEmployees, useSessionEmployee } from "@/store/employee-store";
import { useTheme } from "@/store/theme-store";
import { toast } from "@/store/toast-store";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { ThemeToggle } from "./theme-toggle";
import { BranchSwitcher } from "./branch-switcher";
import { activeNav } from "./sidebar";

const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none hover:bg-hover focus-visible:bg-hover";

function ProfileMenu() {
  const router = useRouter();
  const user = useSessionEmployee();
  const signOut = useEmployees((s) => s.signOut);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const { theme, toggle } = useTheme();
  if (!user) return null;
  return (
    <Popover
      align="end"
      width={248}
      trigger={({ toggle: t, open }) => (
        <button onClick={t} aria-label="Account menu" className={`flex items-center gap-2 rounded-lg p-1 pr-2 outline-none transition-colors hover:bg-hover ${open ? "bg-hover" : ""}`}>
          <Avatar name={user.name} src={user.photo} size={26} />
          <span className="hidden text-left leading-4 xl:block">
            <span className="block text-xs font-medium text-fg">{user.name}</span>
            <span className="block text-[11px] text-muted">{user.role}</span>
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <div role="menu">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={user.name} src={user.photo} size={34} />
            <div className="min-w-0 leading-4">
              <p className="truncate text-[13px] font-medium text-fg">{user.name}</p>
              <p className="truncate text-[11.5px] text-muted">{user.email}</p>
            </div>
            <Badge tone="accent" className="ml-auto shrink-0">{user.role}</Badge>
          </div>
          <div className="my-1 h-px bg-line" />
          <button role="menuitem" onClick={() => { toggle(); close(); }} className={`${item} text-fg`}>
            {theme === "dark" ? <Sun className="h-4 w-4 text-muted" /> : <Moon className="h-4 w-4 text-muted" />}
            <span className="flex-1">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <button role="menuitem" onClick={() => { toggleSidebar(); close(); }} className={`${item} hidden text-fg lg:flex`}>
            <PanelLeft className="h-4 w-4 text-muted" />
            <span className="flex-1">Toggle sidebar</span>
          </button>
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            onClick={() => {
              close();
              signOut();
              toast.info("Signed out");
              router.push("/login");
            }}
            className={`${item} text-danger`}
          >
            <LogOut className="h-4 w-4" />
            <span className="flex-1">Sign out</span>
          </button>
        </div>
      )}
    </Popover>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const setMobileNav = useApp((s) => s.setMobileNav);
  const current = activeNav(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/80 px-3 backdrop-blur-md sm:px-5">
      <Button variant="ghost" iconOnly className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
        <Menu className="h-4 w-4" />
      </Button>

      <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-[13px] sm:flex">
        <Link href="/branches" className="text-muted transition-colors hover:text-fg">
          Vijayagiri
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-faint" />
        <span className="font-medium text-fg">{current?.label ?? "Branches"}</span>
      </nav>

      <div className="flex-1" />

      <BranchSwitcher />

      <div className="flex items-center gap-0.5">
        <ThemeToggle />
        <div className="ml-1.5 border-l border-line pl-2">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
