"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "./button";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;
function useOverlayBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  // Callers usually pass a fresh inline `onClose` every render. Keep the latest in a ref so the effect below runs once per
  // open, not on every render: re-running it would re-focus the first field and pull focus out of whatever is being typed in.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    scrollLocks++;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      el?.focus({ preventScroll: true });
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab" && panel.current) {
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (--scrollLocks === 0) document.body.style.overflow = "";
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, panel]);
}

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra header content rendered next to the close button */
  headerExtra?: ReactNode;
}

export function Drawer({ open, onClose, title, description, children, footer, width = 520, headerExtra }: BaseProps & { width?: number }) {
  const panel = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose, panel);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0, transition: { type: "spring", stiffness: 300, damping: 32 } }}
            exit={{ x: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            style={{ maxWidth: width }}
            className="pointer-events-auto absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-line bg-overlay shadow-pop"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
                {description && <p className="mt-0.5 truncate text-[13px] text-muted">{description}</p>}
              </div>
              <div className="flex items-center gap-1">
                {headerExtra}
                <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Close panel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <footer className="border-t border-line bg-fg/[0.015] px-5 py-3">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Centred yes/no dialog for actions that can't be undone. `destructive` makes the confirm button red. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", busy, destructive }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode; confirmLabel?: string; busy?: boolean; destructive?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose, panel);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" onClick={busy ? undefined : onClose} />
          <motion.div ref={panel} role="alertdialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }} className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-overlay p-5 shadow-pop">
            <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
            <div className="mt-1.5 text-[13px] leading-5 text-muted">{message}</div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" data-autofocus onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="primary" loading={busy} onClick={onConfirm} className={destructive ? "!bg-red-600 text-white hover:!bg-red-700" : undefined}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** A light image preview: the photo on a dimmed backdrop. Click outside, press Esc or use the button to close. */
export function Lightbox({ open, onClose, src, title }: { open: boolean; onClose: () => void; src: string; title: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose, panel);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-[60] grid place-items-center p-4" onClick={onClose}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={title} initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.97 }} className="pointer-events-auto relative z-10 max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* biome-ignore lint/performance/noImgElement: a data URL the user just uploaded, which next/image cannot optimise */}
            <img src={src} alt={title} className="max-h-[85vh] w-auto max-w-full rounded-xl bg-white object-contain shadow-pop" />
            <Button variant="secondary" size="sm" iconOnly onClick={onClose} aria-label="Close preview" className="absolute right-2 top-2">
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
