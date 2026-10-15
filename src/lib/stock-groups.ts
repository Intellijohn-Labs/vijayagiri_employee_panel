import { STOCK_MODELS, cleanModelName, modelKey, type ModelCategory } from "./stock-options";
import type { StockEntry } from "@/store/stock-store";

export interface ModelGroup {
  /** Normalised model name — the grouping key */
  key: string;
  /** Id of the first unit, used for catalogue art */
  modelId: string;
  name: string;
  short: string;
  series: string;
  category: ModelCategory;
  units: StockEntry[];
}

const shortOf = (name: string) => (name.length > 14 ? `${name.slice(0, 13).trim()}…` : name);

/** What we know about a unit's model: its own saved details first, then the built-in catalogue, then sensible defaults. */
export function entryMeta(e: StockEntry) {
  const built = STOCK_MODELS.find((m) => m.id === e.modelId);
  const category: ModelCategory = e.category ?? built?.category ?? "Motorcycle";
  return { name: cleanModelName(e.modelName), short: e.short ?? built?.short ?? shortOf(cleanModelName(e.modelName)), series: e.series ?? built?.series ?? (category === "Scooter" ? "Scooter" : "Motorcycle"), category };
}

/**
 * Groups live inventory by model name. Nothing here lists models in advance: a model appears the moment a unit of it
 * exists, and every further unit of the same model lands in the same group instead of creating a duplicate.
 */
export function groupByModel(entries: StockEntry[]): ModelGroup[] {
  const groups = entries.reduce<Map<string, ModelGroup>>((acc, e) => {
    const key = modelKey(e.modelName);
    const g = acc.get(key);
    if (g) g.units.push(e);
    else acc.set(key, { key, modelId: e.modelId, ...entryMeta(e), units: [e] });
    return acc;
  }, new Map());
  return [...groups.values()].sort((a, z) => z.units.length - a.units.length || a.name.localeCompare(z.name));
}
