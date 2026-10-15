import { BASE_BRANCHES } from "./branches";
import { STOCK_MODELS, type StockStatus } from "./stock-options";
import type { StockEntry } from "@/store/stock-store";

/** Small deterministic PRNG so the sample set is identical every time it is loaded. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const ENG_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const POPULARITY: Record<string, number> = { "mt15-v2": 1.5, r15: 1.1, "aerox-155": 0.7, "fzs-fi-v4": 1.2, "fz-x": 0.8, "rayzr-125": 1.4, "fascino-125": 1.3 };
/** Head Office holds the central yard, so it carries the deepest stock. */
const BRANCH_WEIGHT: Record<string, number> = { hq: 2.2, perumbavoor: 1.1, kothamangalam: 1, allapra: 0.9, angamaly: 1.05, kalady: 0.95 };

export type SampleUnit = Omit<StockEntry, "id" | "createdAt" | "photoSetId">;

/** About 150 plausible units spread over the six showrooms, tagged so they can be removed again. */
export function buildSampleStock(now: number): SampleUnit[] {
  const rng = mulberry32(1991);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const code = (chars: string, n: number) => Array.from({ length: n }, () => chars[Math.floor(rng() * chars.length)]).join("");
  const modelPool = STOCK_MODELS.flatMap((m) => Array.from({ length: Math.round((POPULARITY[m.id] ?? 1) * 10) }, () => m));
  const out: SampleUnit[] = [];
  for (const b of BASE_BRANCHES) {
    const n = Math.round(18 * (BRANCH_WEIGHT[b.id] ?? 1));
    for (let i = 0; i < n; i++) {
      const m = pick(modelPool);
      const r = rng();
      const status: StockStatus = r < 0.78 ? "In Stock / Yard Ready" : r < 0.9 ? "Pre-Booked" : "In Transit (From Factory / Plant)";
      const d = new Date(now - Math.floor(rng() * 45) * 86_400_000);
      out.push({
        branchId: b.id,
        modelId: m.id,
        modelName: m.name,
        variant: pick(m.variants),
        colour: pick(m.colours),
        chassisNo: `ME1${code(VIN_CHARS, 14)}`,
        engineNo: `${code(ENG_CHARS, 3)}${code("0123456789", 7)}`,
        status,
        exShowroom: m.exShowroom,
        onRoad: m.onRoad,
        intakeDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        sample: true,
      });
    }
  }
  return out;
}
