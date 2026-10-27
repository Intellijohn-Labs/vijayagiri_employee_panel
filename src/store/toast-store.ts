import { create } from "zustand";

export type ToastTone = "success" | "error" | "info" | "loading" | "warning";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number; // ms, 0 = sticky
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Partial<ToastItem> & { title: string }) => string;
  update: (id: string, patch: Partial<ToastItem>) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

/** Tones that are not shown (see `push`). */
const QUIET: ToastTone[] = ["success", "info"];

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = `toast_${++counter}`;
    const tone = t.tone ?? "info";
    // Routine confirmations stay off screen (buttons show their own spinner / state). Only errors, warnings, progress and
    // anything carrying an action such as Undo are shown.
    if (QUIET.includes(tone) && !t.action) return id;
    const item: ToastItem = { id, tone, duration: tone === "loading" ? 0 : 4200, ...t };
    set((s) => ({ toasts: [...s.toasts.slice(-3), item] }));
    return id;
  },
  update: (id, patch) =>
    set((s) => ({
      // A progress toast that finishes successfully just goes away.
      toasts: (patch.tone && QUIET.includes(patch.tone) && !patch.action ? s.toasts.filter((t) => t.id !== id) : s.toasts).map((t) =>
        t.id === id ? { ...t, ...patch, duration: patch.duration ?? (patch.tone && patch.tone !== "loading" ? 4200 : t.duration) } : t,
      ),
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

type Opts = Partial<Omit<ToastItem, "id" | "title" | "tone">>;
const api = (tone: ToastTone) => (title: string, description?: string, opts?: Opts) =>
  useToastStore.getState().push({ title, description, tone, ...opts });

export const toast = {
  success: api("success"),
  error: api("error"),
  info: api("info"),
  warning: api("warning"),
  loading: api("loading"),
  update: (id: string, patch: Partial<ToastItem>) => useToastStore.getState().update(id, patch),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
