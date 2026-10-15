"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { useToastStore, type ToastItem, type ToastTone } from "@/store/toast-store";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

const icons: Record<ToastTone, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: "text-accent-text" },
  error: { icon: XCircle, color: "text-danger" },
  warning: { icon: AlertTriangle, color: "text-warn" },
  info: { icon: Info, color: "text-info" },
  loading: { icon: Loader2, color: "text-muted" },
};

function ToastCard({ t }: { t: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    remaining.current = t.duration;
  }, [t.duration, t.tone]);

  useEffect(() => {
    if (!t.duration || paused) return;
    startedAt.current = Date.now();
    const id = setTimeout(() => dismiss(t.id), remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [t.id, t.duration, t.tone, paused, dismiss]);

  const { icon: Icon, color } = icons[t.tone];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1, transition: spring }}
      exit={{ opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.16 } }}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      role="status"
      className="pointer-events-auto relative w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-overlay shadow-pop"
    >
      <div className="flex items-start gap-3 p-3.5 pr-9">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color, t.tone === "loading" && "animate-spin")} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-5 text-fg">{t.title}</p>
          {t.description && <p className="mt-0.5 text-xs leading-[18px] text-muted">{t.description}</p>}
          {t.action && (
            <button
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
              className="mt-2 rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-fg transition-colors hover:bg-hover"
            >
              {t.action.label}
            </button>
          )}
        </div>
      </div>
      <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="absolute right-2 top-2 rounded-md p-1 text-faint transition-colors hover:bg-hover hover:text-fg">
        <X className="h-3.5 w-3.5" />
      </button>
      {t.duration > 0 && (
        <motion.div
          key={`${t.id}-${t.tone}`}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: paused ? undefined : 0 }}
          transition={{ duration: t.duration / 1000, ease: "linear" }}
          style={{ transformOrigin: "left" }}
          className={cn("absolute inset-x-0 bottom-0 h-[2px]", t.tone === "error" ? "bg-danger/60" : t.tone === "warning" ? "bg-warn/60" : "bg-accent/60")}
        />
      )}
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[120] flex flex-col items-end gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
