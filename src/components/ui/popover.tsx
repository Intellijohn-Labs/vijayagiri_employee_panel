"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { popoverMotion } from "@/lib/motion";

/* ───────── Popover (portal + viewport-aware placement) ───────── */
interface PopoverProps {
  trigger: (api: { open: boolean; toggle: () => void; close: () => void }) => ReactNode;
  children: (api: { close: () => void }) => ReactNode;
  align?: "start" | "end";
  width?: number | "trigger";
  className?: string;
  /** Prefer opening above the trigger (sidebar footer, etc.) */
  preferUp?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export function Popover({ trigger, children, align = "start", width, className, preferUp, onOpenChange }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const set = useCallback(
    (v: boolean) => {
      setOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  const close = useCallback(() => set(false), [set]);

  const place = useCallback(() => {
    const t = wrapRef.current?.getBoundingClientRect();
    if (!t) return;
    const panelH = panelRef.current?.offsetHeight ?? 260;
    const w = width === "trigger" ? t.width : (width ?? panelRef.current?.offsetWidth ?? 240);
    const below = window.innerHeight - t.bottom;
    const up = preferUp ? t.top > panelH + 16 || below < panelH : below < panelH + 16 && t.top > below;
    const style: CSSProperties = { position: "fixed", zIndex: 70 };
    if (up) style.bottom = window.innerHeight - t.top + 6;
    else style.top = t.bottom + 6;
    let left = align === "end" ? t.right - w : t.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    style.left = left;
    if (width) style.width = w;
    style.maxHeight = Math.max(160, (up ? t.top : below) - 20);
    setPos(style);
  }, [align, preferUp, width]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const n = e.target as Node;
      if (wrapRef.current?.contains(n) || panelRef.current?.contains(n)) return;
      close();
    };
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, close]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"],[role="option"],[role="menuitemcheckbox"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {trigger({ open, toggle: () => set(!open), close })}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                {...popoverMotion}
                style={{ ...pos, transformOrigin: pos.bottom !== undefined ? (align === "end" ? "bottom right" : "bottom left") : align === "end" ? "top right" : "top left" }}
                onKeyDown={onKeyDown}
                className={cn("overflow-auto rounded-lg border border-line bg-overlay p-1 shadow-pop", className)}
              >
                {children({ close })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

/* ───────── Select ───────── */
export interface Option<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

interface SelectProps<T extends string> {
  value: T | null;
  onChange: (v: T) => void;
  options: Option<T>[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  buttonClassName?: string;
  align?: "start" | "end";
  width?: number | "trigger";
  invalid?: boolean;
  disabled?: boolean;
  leading?: ReactNode;
  clearLabel?: string;
}

export function Select<T extends string>({ value, onChange, options, placeholder = "Select…", searchable, className, buttonClassName, align, width = "trigger", invalid, disabled, leading, clearLabel }: SelectProps<T>) {
  const [q, setQ] = useState("");
  const current = options.find((o) => o.value === value);
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <Popover
      align={align}
      width={width}
      className={className}
      onOpenChange={(o) => o && setQ("")}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[13px] shadow-card outline-none transition-colors hover:border-strong disabled:opacity-50",
            open && "border-accent shadow-ring",
            invalid && "!border-red-500 !bg-red-50/50 dark:!bg-red-950/25",
            buttonClassName,
          )}
        >
          {leading ?? current?.icon}
          <span className={cn("flex-1 truncate", current ? "text-fg" : "text-faint")}>{current?.label ?? placeholder}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-faint transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {({ close }) => (
        <div role="listbox">
          {searchable && (
            <div className="relative mb-1 border-b border-line pb-1">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-7 w-full bg-transparent pl-8 pr-2 text-[13px] text-fg outline-none placeholder:text-faint" />
            </div>
          )}
          {clearLabel && (
            <button
              role="option"
              aria-selected={value === null}
              onClick={() => {
                onChange(null as unknown as T);
                close();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted outline-none hover:bg-hover focus-visible:bg-hover"
            >
              {clearLabel}
            </button>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                close();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg outline-none transition-colors hover:bg-hover focus-visible:bg-hover"
            >
              {o.icon}
              <span className="flex-1 truncate">{o.label}</span>
              {o.hint && <span className="text-[11px] text-faint">{o.hint}</span>}
              {o.value === value && <Check className="h-3.5 w-3.5 text-accent-text" />}
            </button>
          ))}
          {!filtered.length && <p className="px-2.5 py-3 text-center text-xs text-faint">No matches</p>}
        </div>
      )}
    </Popover>
  );
}
