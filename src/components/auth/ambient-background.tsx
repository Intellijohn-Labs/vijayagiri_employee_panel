/**
 * Light: crisp porcelain with faint Yamaha Blue light. Dark: deep obsidian with a mesh of Racing Blue glow. Both have a soft grid
 * and vignette; `lit` brightens the centre glow while the portal unlocks.
 */
export function AmbientBackground({ lit }: { lit: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-slate-50 dark:bg-[#06080F]">
      <div className="absolute -left-40 -top-48 h-[680px] w-[680px] rounded-full bg-[#0050FF]/15 blur-[140px] dark:bg-[#0020B2]/35" />
      <div className="absolute -bottom-56 -right-40 h-[700px] w-[700px] rounded-full bg-sky-300/25 blur-[150px] dark:bg-[#0050FF]/20" />
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0020B2]/10 blur-[130px] transition-opacity duration-500 dark:bg-[#0020B2]/20" style={{ opacity: lit ? 1 : 0.55 }} />
      <div
        className="absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(100,116,139,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          WebkitMaskImage: "radial-gradient(ellipse 65% 60% at 50% 50%, #000 15%, transparent 75%)",
          maskImage: "radial-gradient(ellipse 65% 60% at 50% 50%, #000 15%, transparent 75%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(100,116,139,0.12)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,4,10,0.8)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0050FF]/60 to-transparent" />
    </div>
  );
}
