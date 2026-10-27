"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BrandLogo, LogoMark } from "./logo";

const MORPH_MS = 350;
const DRIVE_MS = 1600;

type Phase = "idle" | "morph" | "drive";

const fullTime = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const shortTime = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

/** A tiny tachometer: arc, redline and a needle resting near idle. */
function MiniGauge() {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0" fill="none" aria-hidden>
      <path d="M2 14a10 10 0 0 1 20 0" stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.5 5.2a10 10 0 0 1 4.5 8.8" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 14L7.5 8.5" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="14" r="1.6" fill="#22d3ee" />
    </svg>
  );
}

/** Sparks hanging in the air behind the badge: distance behind it (px), vertical offset, brightness. */
const SPARKS = [
  { r: 70, y: -7, o: 0.8 },
  { r: 110, y: 6, o: 0.55 },
  { r: 150, y: -4, o: 0.35 },
  { r: 185, y: 5, o: 0.2 },
];

/**
 * The sidebar logo, with a hidden trick: tap it and it turns into a glowing digital time badge, which then rides right across
 * the whole screen, past the top bar, trailing a cyan streak, and out of the right edge; the logo then fades back in. While it
 * rides, the badge lives in a fixed layer on the page (a portal), so the sidebar's clipping can't cut it off. Only transform
 * and opacity are animated.
 */
export function DriveByLogo({ slim }: { slim: boolean }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [time, setTime] = useState("");
  const [travel, setTravel] = useState(1400);
  /** Where the logo sits on screen when it is tapped: the badge starts exactly there. */
  const [origin, setOrigin] = useState({ left: 0, top: 0, height: 0 });
  const box = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const format = (d: Date) => (slim ? shortTime.format(d) : fullTime.format(d));

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  // The time keeps ticking while the badge is on show.
  useEffect(() => {
    if (phase === "idle") return;
    const id = setInterval(() => setTime(format(new Date())), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, slim]);

  const go = () => {
    if (phase !== "idle") return;
    setTime(format(new Date()));
    const r = box.current?.getBoundingClientRect();
    if (r) setOrigin({ left: r.left, top: r.top, height: r.height });
    // Far enough that the badge and its whole trail have left the right edge.
    setTravel(window.innerWidth - (r?.left ?? 0) + 260);
    setPhase("morph");
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
    if (reduced) {
      // No riding off: the badge just shows for a moment and the logo returns.
      later(() => setPhase("idle"), 1600);
      return;
    }
    later(() => setPhase("drive"), MORPH_MS);
    // Once it is off the right edge, the logo fades back in where it was.
    later(() => setPhase("idle"), MORPH_MS + DRIVE_MS + 60);
  };

  const driving = phase === "drive";

  return (
    <button ref={box} type="button" onClick={go} aria-label="Vijayagiri — tap to see the time" className={cn("relative block cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent", slim ? "mx-auto" : "-ml-0.5 pl-0.5")}>
      {/* the logo keeps its place so the header never changes size; it fades out for the ride and fades back in after */}
      <motion.span className="block will-change-transform" initial={false} animate={phase === "idle" ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }} transition={phase === "idle" ? { duration: 0.55, ease: "easeOut" } : { duration: MORPH_MS / 1000, ease: "easeOut" }}>
        {slim ? <LogoMark /> : <BrandLogo className="w-[184px] shrink" />}
      </motion.span>

      {phase !== "idle" &&
        createPortal(
          <motion.span
            aria-hidden
            className="pointer-events-none fixed z-[80] flex items-center will-change-transform"
            style={{ left: origin.left, top: origin.top, height: origin.height }}
            initial={{ opacity: 0, scale: 0.8, x: 0 }}
            animate={driving ? { opacity: 1, scale: 1, x: travel } : { opacity: 1, scale: 1, x: 0 }}
            transition={driving ? { duration: DRIVE_MS / 1000, ease: [0.45, 0, 0.35, 1] } : { duration: MORPH_MS / 1000, ease: "easeOut" }}
          >
            <span className="relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-cyan-400/30 bg-zinc-950 px-2 py-1.5 font-mono text-[12px] font-bold tracking-widest text-cyan-300 shadow-[0_0_18px_rgba(0,80,255,0.55),inset_0_0_10px_rgba(0,80,255,0.3)] [text-shadow:0_0_10px_rgba(34,211,238,0.85)]">
              {/* exhaust streak and sparks behind it, once it is moving */}
              <motion.span aria-hidden className="absolute right-full top-1/2 h-[3px] w-44 -translate-y-1/2 rounded-full bg-gradient-to-l from-cyan-300 via-blue-500/70 to-transparent blur-[1px]" initial={{ opacity: 0, scaleX: 0.2 }} animate={driving ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0.2 }} style={{ originX: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} />
              {SPARKS.map((p) => (
                <motion.span key={p.r} aria-hidden className="absolute top-1/2 h-1 w-1 rounded-full bg-cyan-200 shadow-[0_0_6px_2px_rgba(34,211,238,0.8)]" style={{ right: `calc(100% + ${p.r}px)`, marginTop: p.y }} initial={{ opacity: 0 }} animate={{ opacity: driving ? p.o : 0 }} transition={{ duration: 0.4, delay: 0.1 }} />
              ))}
              {!slim && <MiniGauge />}
              <span className={slim ? "text-[10px] tracking-wider" : undefined}>{time}</span>
            </span>
          </motion.span>,
          document.body,
        )}
    </button>
  );
}
