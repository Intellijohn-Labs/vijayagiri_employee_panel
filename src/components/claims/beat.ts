"use client";

import { useEffect } from "react";
import { startContinuousBeepLoop, stopContinuousBeepLoop, syncBeat } from "@/lib/sound";
import { useAlertSound } from "@/store/alert-sound-store";

/** Lines this element's beacon animations up with the beep loop. Call it with whether the beacon is showing. */
export function useBeatSync(on: boolean) {
  useEffect(() => {
    if (on) syncBeat();
  }, [on]);
}

/** Keeps the repeating alert beep going while `active` and the alert sound is on; silent otherwise, and it stops when the page is left. */
export function useCodeRedBeeper(active: boolean) {
  const enabled = useAlertSound((s) => s.enabled);
  const hydrate = useAlertSound((s) => s.hydrate);
  useEffect(hydrate, [hydrate]);
  useEffect(() => {
    if (!active || !enabled) return;
    startContinuousBeepLoop();
    return stopContinuousBeepLoop;
  }, [active, enabled]);
}
