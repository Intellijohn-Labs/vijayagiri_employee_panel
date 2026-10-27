"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** How long the initialization runs before the portal opens. */
export const INIT_MS = 3000;
const EXIT_MS = 420;

/** What the HUD says, and from when. The middle step is the longest: it is where the workspace is "loaded". */
const STATUS = [
  { from: 0, text: "AUTHENTICATING TELEMETRY..." },
  { from: 600, text: "DECRYPTING WORKSPACE KEYS..." },
  { from: 1200, text: "SYNCHRONIZING FLEET CLAIMS & JOB CARDS..." },
  { from: 2400, text: "WORKSPACE INITIALIZED — WELCOME" },
];

const GLYPHS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン<>/{}[]#$%=+*ABCDEF";
/** Racing Blue, cyan and slate green, with white for the lead character. */
const TINTS = ["#2563eb", "#38bdf8", "#22d3ee", "#5eead4", "#86efac"];
const LOGO_MASK = "url(/images/vijayagiri-mark.png)";

/** Vertical streams of characters falling over a transparent canvas, so the blurred page shows through behind them. */
function DataRain({ animate }: { animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const size = 16;
    let w = 0;
    let h = 0;
    let drops: { y: number; speed: number; tint: string }[] = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drops = Array.from({ length: Math.ceil(w / size) }, () => ({ y: -Math.random() * (h / size) * 1.2, speed: 0.35 + Math.random() * 0.75, tint: TINTS[Math.floor(Math.random() * TINTS.length)] }));
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 40) return; // ~25 fps: the look of a terminal, and cheap
      last = t;
      // Fade what is already drawn instead of clearing it, which leaves the glowing trails.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      drops.forEach((d, i) => {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * size;
        const y = d.y * size;
        // The previous head turns into the stream's tint; the new head is white with a glow.
        ctx.shadowBlur = 0;
        ctx.fillStyle = d.tint;
        ctx.globalAlpha = 0.85;
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], x, y - size);
        ctx.globalAlpha = 1;
        ctx.shadowColor = d.tint;
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#f1f5f9";
        ctx.fillText(ch, x, y);
        d.y += d.speed;
        if (y > h && Math.random() > 0.975) d.y = -Math.random() * 12;
      });
      ctx.shadowBlur = 0;
    };
    if (animate) raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [animate]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}

/**
 * Full-screen portal start-up shown after a successful sign-in: data rain, a pulsing emblem, a progress bar and cycling
 * status lines. After `INIT_MS` it flashes and fades out and calls `onDone`, which opens the portal. Silent.
 */
export function PortalInit({ name, onDone }: { name: string; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let fired = false;
    const tick = (now: number) => {
      const t = Math.min(INIT_MS, now - start);
      setElapsed(t);
      if (t >= INIT_MS) {
        if (!fired) {
          fired = true;
          // At the 3.0 s mark the overlay starts to fade and the portal opens underneath it.
          setLeaving(true);
          done.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const status = [...STATUS].reverse().find((s) => elapsed >= s.from) ?? STATUS[0];
  const pct = Math.round((elapsed / INIT_MS) * 100);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Initializing portal"
      initial={{ opacity: 0 }}
      animate={leaving ? { opacity: 0, scale: 1.08, transition: { duration: EXIT_MS / 1000, ease: "easeIn" } } : { opacity: 1, scale: 1, transition: { duration: 0.3 } }}
      className="fixed inset-0 z-[100] overflow-hidden bg-[#03060f]/80 backdrop-blur-md"
    >
      <DataRain animate={!reduced} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,6,15,0.85)_0%,rgba(3,6,15,0.25)_55%,transparent_80%)]" />

      {/* flash at the hand-over */}
      <AnimatePresence>{leaving && <motion.div key="flash" initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} transition={{ duration: EXIT_MS / 1000 }} className="pointer-events-none absolute inset-0 bg-sky-200" />}</AnimatePresence>

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        {/* emblem with soft pulsing waves */}
        <div className="relative grid h-36 w-36 place-items-center">
          {!reduced &&
            [0, 1].map((i) => (
              <motion.span key={i} aria-hidden className="absolute inset-0 rounded-full border border-sky-400/50" initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.9, ease: "easeOut" }} />
            ))}
          <span aria-hidden className="absolute inset-3 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.28),transparent_70%)] blur-md" />
          <div role="img" aria-label="Vijayagiri" className="relative h-20 w-20 bg-[#E6EEFF] drop-shadow-[0_0_16px_rgba(56,189,248,0.75)]" style={{ WebkitMaskImage: LOGO_MASK, maskImage: LOGO_MASK, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
        </div>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.4em] text-sky-300/80">Vijayagiri Ops Hub</p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-white">Welcome, {name.split(" ")[0]}</p>

        {/* status line: fades between messages */}
        <div className="mt-6 h-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={status.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="font-mono text-[12px] tracking-[0.18em] text-emerald-200/90 sm:text-[13px]">
              {status.text}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* progress */}
        <div className="mt-4 w-[min(360px,80vw)]">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-sky-400/20">
            <div className="h-full rounded-full bg-gradient-to-r from-[#2563eb] via-sky-400 to-emerald-300 shadow-[0_0_14px_rgba(56,189,248,0.9)]" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10.5px] tracking-widest text-slate-400">
            <span>SYS.BOOT</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
