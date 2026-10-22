"use client";

import { create } from "zustand";

const KEY = "vg.codeRedSound";

/** Whether the Code Red card may beep. Off until someone turns it on, and remembered per browser. */
interface AlertSoundState {
  enabled: boolean;
  hydrate: () => void;
  set: (on: boolean) => void;
}

export const useAlertSound = create<AlertSoundState>((set) => ({
  enabled: false,
  // Read after mount so the server and first client render agree (muted).
  hydrate: () => {
    try {
      set({ enabled: localStorage.getItem(KEY) === "1" });
    } catch {
      /* storage unavailable: stays muted */
    }
  },
  set: (on) => {
    set({ enabled: on });
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
  },
}));
