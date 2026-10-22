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
  if (typeof window === "undefined" || !useAlertSound.getState().enabled || !navigator.userActivation?.hasBeenActive) return;
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
