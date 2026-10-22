import { useAlertSound } from "@/store/alert-sound-store";
import { getSettings } from "@/store/settings-store";

/**
 * Engine sound effects, synthesised with the Web Audio API (no audio files). Everything is off unless an Admin turned
 * sound on in Settings, and browsers only allow audio after a tap or keypress, so calls before that are silently ignored.
 */
let ctx: AudioContext | null = null;

function audio(force = false): AudioContext | null {
  if (typeof window === "undefined" || (!force && !getSettings().appearance.sound)) return null;
  try {
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A sawtooth through a low-pass filter whose pitch sweeps from one value to another — a throttle rev. */
function rev(from: number, to: number, seconds: number, gain: number, force = false) {
  const a = audio(force);
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const filter = a.createBiquadFilter();
  const amp = a.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + seconds * 0.8);
  osc.frequency.exponentialRampToValueAtTime(from * 1.2, t + seconds);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(380, t);
  filter.frequency.linearRampToValueAtTime(1500, t + seconds * 0.7);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(filter).connect(amp).connect(a.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.05);
}

export const sfx = {
  /** Code Red: a soft, low double chirp. Plays only when the user has switched the alert sound on, which is the gesture that unlocks audio. */
  alert: () => {
    const a = audio(true);
    if (!a) return;
    [330, 392].forEach((f, i) => {
      const t = a.currentTime + i * 0.16;
      const osc = a.createOscillator();
      const amp = a.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, t + 0.1);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(amp).connect(a.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  },
  /** One keystroke: a short throttle blip. */
  blip: () => rev(70, 130, 0.12, 0.05),
  /** Launch control: the full rev as the dashboard opens. */
  launch: (force = false) => {
    rev(55, 420, 1.1, 0.12, force);
    setTimeout(() => rev(90, 520, 0.7, 0.08, force), 350);
  },
  /** A saved or confirmed action: a short rising two-note chirp. */
  confirm: () => {
    const a = audio();
    if (!a) return;
    [660, 880].forEach((f, i) => {
      const t = a.currentTime + i * 0.09;
      const osc = a.createOscillator();
      const amp = a.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(amp).connect(a.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  },
};

let lastMild = 0;

/**
 * A single soft beep for overdue claims: a 520 Hz sine, 80 ms, quiet, fading out. Plays only when the alert sound is on,
 * only after the user has tapped or pressed something (browsers block audio before that), and at most once a second so
 * sweeping the pointer across several overdue cards stays calm.
 */
export function playMildAlertBeep() {
  if (typeof window === "undefined" || loopOn || !useAlertSound.getState().enabled || !navigator.userActivation?.hasBeenActive) return;
  const now = Date.now();
  if (now - lastMild < 1000) return;
  const a = audio(true);
  if (!a) return;
  lastMild = now;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = "sine";
  osc.frequency.value = 520;
  amp.gain.setValueAtTime(0.08, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(amp).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.09);
}

/* ───────── Continuous Code Red beep ───────── */

/** The default gap between beeps, and the period every Code Red animation pulses at. */
export const BEAT_MS = 1200;
const BEAT_ANIMATIONS = new Set(["radarRing", "beaconGlow", "sirenBeat", "redPulse"]);

let loopOn = false;
let loopMs = BEAT_MS;
let loopTimer: ReturnType<typeof setTimeout> | undefined;
let stopWaiting: (() => void) | undefined;
let syncQueued = false;

export const isBeepLoopRunning = () => loopOn;

/** Snaps every Code Red animation to the page clock, which the beep loop also ticks on, so they land together. */
export function syncBeat() {
  if (typeof document === "undefined" || typeof CSSAnimation === "undefined" || syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    for (const a of document.getAnimations()) if (a instanceof CSSAnimation && BEAT_ANIMATIONS.has(a.animationName)) a.startTime = 0;
  });
}

/** One monitor "beep-beep": two 600 Hz blips of 70 ms with 50 ms of silence between, softly faded in and out. */
function blip(a: AudioContext, t: number) {
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = "sine";
  osc.frequency.value = 600;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.07, t + 0.012);
  amp.gain.setValueAtTime(0.07, t + 0.055);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(amp).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

function tick() {
  if (!document.hidden) {
    const a = audio(true);
    if (a) {
      blip(a, a.currentTime);
      blip(a, a.currentTime + 0.12);
    }
  }
  schedule();
}

// Beeps fall on whole multiples of the period on the page clock, the same clock the animations are snapped to.
function schedule() {
  if (!loopOn) return;
  loopTimer = setTimeout(tick, loopMs - (performance.now() % loopMs));
}

/** Starts the repeating alert beep (once, however often it is called). Waits for the first click or key press, as browsers insist on. */
export function startContinuousBeepLoop(intervalMs = BEAT_MS) {
  if (typeof window === "undefined") return;
  const ms = Math.min(1500, Math.max(1200, intervalMs));
  if (loopOn && ms === loopMs) return;
  stopContinuousBeepLoop();
  loopOn = true;
  loopMs = ms;
  document.documentElement.style.setProperty("--beat", `${ms}ms`);
  syncBeat();
  if (navigator.userActivation?.hasBeenActive) {
    schedule();
    return;
  }
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const go = () => {
    stopWaiting?.();
    schedule();
  };
  for (const e of events) window.addEventListener(e, go, { capture: true, once: true });
  stopWaiting = () => {
    for (const e of events) window.removeEventListener(e, go, { capture: true });
    stopWaiting = undefined;
  };
}

export function stopContinuousBeepLoop() {
  loopOn = false;
  clearTimeout(loopTimer);
  stopWaiting?.();
}
