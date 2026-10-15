/** Yamaha two-wheelers offered on the intake form. Prices are indicative references, editable per entry. */
export interface ModelOption {
  id: string;
  name: string;
  /** Compact label for charts and chips */
  short: string;
  /** Yamaha product family, e.g. "MT Hyper Naked" */
  series: string;
  category: "Motorcycle" | "Scooter";
  variants: string[];
  colours: string[];
  exShowroom: number;
  onRoad: number;
}

export type ModelCategory = ModelOption["category"];

/** Dropdown sentinels for the "create it" choices. */
export const NEW_MODEL = "__new_model__";
export const CUSTOM_VARIANT = "__custom_variant__";
export const CUSTOM_COLOUR = "__custom_colour__";

/** "Yamaha XSR 155" and "xsr 155" are the same model: strip the brand, case and spacing. */
export const modelKey = (name: string) => name.toLowerCase().replace(/^yamaha\s+/, "").replace(/\s+/g, " ").trim();
/** Display name without a leading "Yamaha " (cards add it back). */
export const cleanModelName = (name: string) => name.trim().replace(/^yamaha\s+/i, "").replace(/\s+/g, " ");

const road = (ex: number) => Math.round((ex * 1.14) / 500) * 500;
const model = (id: string, name: string, short: string, series: string, category: ModelOption["category"], variants: string[], colours: string[], exShowroom: number): ModelOption => ({ id, name, short, series, category, variants, colours, exShowroom, onRoad: road(exShowroom) });

export const STOCK_MODELS: ModelOption[] = [
  model("mt15-v2", "MT-15 V2", "MT-15", "MT Hyper Naked", "Motorcycle", ["Standard", "Dark Matte", "Moto GP Edition"], ["Cyan Storm", "Ice Fluo-Vermillion", "Racing Blue", "Metallic Black"], 168000),
  model("r15", "YZF R15 V4 / R15M", "R15", "R-World", "Motorcycle", ["R15 V4 Standard", "R15 V4 Dark Knight", "R15M Metallic Silver", "R15M Moto GP Edition", "R15M Monster Energy Edition"], ["Racing Blue", "Metallic Red", "Dark Knight", "Metallic Silver", "Matte Black"], 182000),
  model("aerox-155", "Aerox 155", "Aerox", "Maxi Sports Scooter", "Scooter", ["Version S", "Moto GP Edition", "Monster Energy Edition"], ["Racing Blue", "Metallic Black", "Grey Vermillion", "Metallic Silver"], 151000),
  model("fzs-fi-v4", "FZS-FI V4", "FZS-FI", "FZ Series", "Motorcycle", ["Standard", "Deluxe", "Dark Matte"], ["Matte Black", "Cyan Blue", "Metallic Red", "Racing Blue"], 121000),
  model("fz-x", "FZ-X", "FZ-X", "FZ Series", "Motorcycle", ["Standard", "Deluxe"], ["Matte Copper", "Matte Black", "Matte Green", "Metallic Blue"], 138000),
  model("rayzr-125", "RayZR 125 Fi Hybrid", "RayZR", "Hybrid Scooter", "Scooter", ["Drum", "Disc", "Street Rally"], ["Metallic Black", "Cyan Blue", "Matte Red", "Ice Silver", "Racing Blue"], 82000),
  model("fascino-125", "Fascino 125 Fi Hybrid", "Fascino", "Hybrid Scooter", "Scooter", ["Drum", "Disc", "Deluxe"], ["Vivid Red", "Metallic White", "Dark Matte Blue", "Sparkle Green", "Metallic Black"], 80000),
];

export const COLOUR_HEX: Record<string, string> = {
  "Cyan Storm": "#2aa3c7",
  "Ice Fluo-Vermillion": "#ff5a3c",
  "Racing Blue": "#1f4fa3",
  "Metallic Black": "#1b1d21",
  "Metallic Red": "#c4202e",
  "Dark Knight": "#2b2f36",
  "Metallic Silver": "#b5bac2",
  "Matte Black": "#202226",
  "Grey Vermillion": "#8a8d93",
  "Cyan Blue": "#2f8fc0",
  "Matte Copper": "#a86a46",
  "Matte Green": "#4a6b52",
  "Metallic Blue": "#2f4fa8",
  "Matte Red": "#a8242f",
  "Ice Silver": "#c3c7cd",
  "Vivid Red": "#c8283a",
  "Metallic White": "#e8eaee",
  "Dark Matte Blue": "#223a63",
  "Sparkle Green": "#2f7d57",
};

export const STOCK_STATUSES = ["In Stock / Yard Ready", "In Transit (From Factory / Plant)", "Pre-Booked"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];
export const IN_STOCK: StockStatus = "In Stock / Yard Ready";
export const BOOKED: StockStatus = "Pre-Booked";
export const TRANSIT: StockStatus = "In Transit (From Factory / Plant)";

/** On-screen wording and colour for each status: Available (green), Booked (amber), In Transit (sky blue). */
export const STATUS_UI: Record<StockStatus, { label: string; tone: "ok" | "warn" | "info" }> = {
  [IN_STOCK]: { label: "Available", tone: "ok" },
  [BOOKED]: { label: "Booked", tone: "warn" },
  [TRANSIT]: { label: "In Transit", tone: "info" },
};

export const STATUS_SHORT: Record<StockStatus, string> = { "In Stock / Yard Ready": "In Stock", "In Transit (From Factory / Plant)": "In Transit", "Pre-Booked": "Pre-Booked" };

/** A frame (chassis) number is a 17-character VIN: letters and digits, never I, O or Q. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
export const ENGINE_PATTERN = /^[A-Z0-9]{6,17}$/;
