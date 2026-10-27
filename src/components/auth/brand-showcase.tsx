import { BrandLogo } from "./auth-ui";

const BLUE = "#0050FF";

/** Blueprint-style line drawing of a modern sport bike, drawn in Yamaha Racing Blue over a faint grid. */
function BikeBlueprint() {
  const wheel = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy={320} r={96} />
      <circle cx={cx} cy={320} r={78} />
      <circle cx={cx} cy={320} r={22} />
      <circle cx={cx} cy={320} r={7} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3;
        return <line key={i} x1={cx + 22 * Math.cos(a)} y1={320 + 22 * Math.sin(a)} x2={cx + 78 * Math.cos(a)} y2={320 + 78 * Math.sin(a)} />;
      })}
      {/* brake disc */}
      <circle cx={cx} cy={320} r={44} strokeDasharray="3 5" />
    </g>
  );
  const lines = (
    <>
      {wheel(200)}
      {wheel(620)}
      {/* swingarm */}
      <path d="M200 320 L340 292 M200 330 L340 304" />
      {/* frame spar and headstock */}
      <path d="M520 172 L440 214 L372 250 L340 292 M526 184 L452 226 L388 262" />
      {/* fork */}
      <path d="M548 160 L620 320 M558 156 L630 316" />
      {/* bars and mirror */}
      <path d="M528 148 L498 138 M498 138 L488 150" />
      {/* fairing and screen */}
      <path d="M470 176 C500 146 552 146 596 200 L566 232 C526 210 494 218 452 238 Z" />
      <path d="M520 150 L556 184" />
      {/* tank */}
      <path d="M340 240 C380 200 436 180 470 178 L452 238 C412 244 372 262 342 280 Z" />
      {/* seat and tail */}
      <path d="M340 240 C306 234 252 236 214 258 L246 280 L342 280" />
      {/* engine block, cylinders and gears */}
      <path d="M366 284 L454 284 L444 330 L374 330 Z" />
      <path d="M382 284 L388 262 M412 284 L418 258 M442 284 L448 262" />
      <circle cx={410} cy={308} r={18} />
      <circle cx={410} cy={308} r={7} />
      {/* exhaust */}
      <path d="M376 332 C430 350 530 344 650 304" strokeDasharray="6 5" />
      {/* chain */}
      <path d="M200 296 L410 290 M200 344 L410 326" strokeDasharray="2 4" />
    </>
  );
  return (
    <svg viewBox="0 0 820 500" role="img" aria-label="Yamaha sport motorcycle blueprint" className="h-auto w-full">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#1d2a44" strokeWidth="0.6" />
        </pattern>
        <radialGradient id="backlight" cx="50%" cy="58%" r="55%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.38" />
          <stop offset="60%" stopColor="#0020B2" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0B0F17" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fade" cx="50%" cy="55%" r="60%">
          <stop offset="55%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <mask id="gridMask">
          <rect width="820" height="500" fill="url(#fade)" />
        </mask>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="820" height="500" fill="url(#grid)" mask="url(#gridMask)" />
      <rect width="820" height="500" fill="url(#backlight)" />
      {/* ground line and centre lines */}
      <line x1="60" y1="418" x2="760" y2="418" stroke="#2a3a5c" strokeWidth="1" />
      <g stroke="#2a3a5c" strokeWidth="0.8" strokeDasharray="10 4 2 4">
        <line x1="200" y1="190" x2="200" y2="440" />
        <line x1="620" y1="190" x2="620" y2="440" />
      </g>
      {/* soft backlight copy, then the crisp line work */}
      <g fill="none" stroke={BLUE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" filter="url(#glow)">
        {lines}
      </g>
      <g fill="none" stroke="#9db8ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {lines}
      </g>
      {/* dimension line */}
      <g stroke="#5b7bd6" strokeWidth="1" fill="#5b7bd6" fontFamily="ui-monospace, monospace" fontSize="11">
        <line x1="200" y1="452" x2="620" y2="452" />
        <line x1="200" y1="446" x2="200" y2="458" />
        <line x1="620" y1="446" x2="620" y2="458" />
        <text x="410" y="446" textAnchor="middle" stroke="none">
          WHEELBASE 1,400 MM
        </text>
      </g>
    </svg>
  );
}

/** Left half of the sign-in screen (desktop): obsidian surface, logo, backlit blueprint and the portal badge. */
export function BrandShowcase() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0B0F17] p-10 lg:flex xl:p-14">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-1/3 h-[520px] w-[520px] rounded-full bg-[#0020B2]/25 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="relative">
        <BrandLogo onDark className="mx-0 w-[190px] xl:w-[220px]" />
      </div>

      <div className="relative -mx-2 my-6">
        <BikeBlueprint />
      </div>

      <div className="relative">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12.5px] font-medium tracking-wide text-slate-200">
          <span className="h-2 w-2 rounded-full bg-[#0050FF] shadow-[0_0_10px_#0050FF]" />
          Enterprise Operations &amp; Claim Management Portal
        </span>
        <p className="mt-4 text-[12px] text-slate-500">Authorised Yamaha dealer network · Vijayagiri Auto Agencies</p>
      </div>
    </aside>
  );
}
