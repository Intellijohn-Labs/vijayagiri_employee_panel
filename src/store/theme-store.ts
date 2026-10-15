"use client";

import { create } from "zustand";

export type Theme = "light" | "dark";
const KEY = "vg.theme";

interface ThemeState {
  theme: Theme;
  hydrate: () => void;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: "light",
  hydrate: () => {
    const attr = document.documentElement.dataset.theme as Theme | undefined;
    set({ theme: attr === "dark" ? "dark" : "light" });
  },
  setTheme: (theme) => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
    window.setTimeout(() => root.classList.remove("theme-transition"), 320);
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Runs before first paint (inlined in <head>) so there's no flash of the wrong theme. */
export const THEME_DEFAULT_KEY = "vg.theme-default";
/** A person's own choice (the toggle) wins; otherwise the dealership default from Settings: light, dark, or follow the device. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){var d=localStorage.getItem('${THEME_DEFAULT_KEY}');t=d==='dark'?'dark':d==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;
