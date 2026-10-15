import { COLOUR_HEX, STOCK_MODELS } from "./stock-options";
import { officialPhotos } from "./official-images";

/**
 * Official Yamaha photos are not bundled (Yamaha's photography is copyrighted). Licensed files go in `public/images/catalogue/`
 * and are listed in `public/images/catalogue/manifest.json`, by model and colour. Until then everything falls back to the
 * illustration drawn below.
 */

const DEFAULT_COLOUR: Record<string, string> = {
  "mt15-v2": "#1f4fa3",
  r15: "#1f4fa3",
  "aerox-155": "#1f4fa3",
  "fzs-fi-v4": "#202226",
  "fz-x": "#a86a46",
  "rayzr-125": "#2f8fc0",
  "fascino-125": "#c8283a",
};

const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const wheel = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#111827"/><circle cx="${cx}" cy="${cy}" r="${r * 0.68}" fill="#e5e7eb"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#111827"/><circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="#9ca3af"/>` +
  Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * r * 0.6).toFixed(1)}" y2="${(cy + Math.sin(a) * r * 0.6).toFixed(1)}" stroke="#6b7280" stroke-width="3"/>`;
  }).join("");

function motorcycle(body: string) {
  return `
<ellipse cx="320" cy="352" rx="250" ry="12" fill="#0f172a" opacity=".14"/>
${wheel(150, 285, 62)}${wheel(490, 285, 62)}
<line x1="150" y1="285" x2="310" y2="236" stroke="#1f2937" stroke-width="9" stroke-linecap="round"/>
<line x1="466" y1="150" x2="492" y2="285" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>
<rect x="290" y="212" width="118" height="58" rx="10" fill="#374151"/>
<path d="M300 268 L380 268 L470 286" stroke="#6b7280" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M232 176 C 282 128, 372 126, 424 158 L 452 206 L 296 216 Z" fill="${body}"/>
<path d="M424 156 L 478 146 L 506 190 L 456 206 Z" fill="${body}"/>
<path d="M440 150 L 470 118 L 520 112" stroke="#111827" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M486 160 L 512 170" stroke="#fde68a" stroke-width="9" stroke-linecap="round"/>
<path d="M172 186 L 262 170 L 274 196 L 172 208 Z" fill="#1f2937"/>
<path d="M112 176 L 176 184 L 164 210 L 100 196 Z" fill="${body}"/>`;
}

function scooter(body: string) {
  return `
<ellipse cx="320" cy="350" rx="235" ry="12" fill="#0f172a" opacity=".14"/>
${wheel(170, 300, 48)}${wheel(470, 300, 48)}
<path d="M150 252 L 204 192 L 332 182 L 434 218 L 442 252 L 384 258 L 230 258 Z" fill="${body}"/>
<path d="M430 214 L 468 128 L 506 134 L 484 252 L 440 252 Z" fill="${body}"/>
<path d="M458 130 L 446 100 L 508 94" stroke="#111827" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M486 150 L 504 154" stroke="#fde68a" stroke-width="10" stroke-linecap="round"/>
<path d="M178 192 L 304 176 L 310 198 L 190 210 Z" fill="#1f2937"/>
<path d="M120 236 L 160 196 L 196 200 L 170 258 Z" fill="${body}"/>
<line x1="470" y1="150" x2="476" y2="300" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>`;
}

/** A drawn catalogue-style picture for the model in the chosen colour — an illustration, not a Yamaha photo. */
export function catalogueArt(modelId: string, colour?: string, opts?: { category?: "Motorcycle" | "Scooter"; hex?: string; name?: string }): { src: string; thumb: string; official: boolean } {
  const model = STOCK_MODELS.find((m) => m.id === modelId);
  const category = model?.category ?? opts?.category ?? "Motorcycle";
  const official = officialPhotos(modelId, colour)[0];
  if (official) return { src: official, thumb: official, official: true };
  const body = (colour && COLOUR_HEX[colour]) || opts?.hex || DEFAULT_COLOUR[modelId] || "#1f4fa3";
  const art = category === "Scooter" ? scooter(body) : motorcycle(body);
  const title = model?.name ?? opts?.name;
  const label = title ? `${title}${colour ? ` · ${colour}` : ""}` : "Yamaha";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient></defs>
<rect width="640" height="400" fill="url(#bg)"/>
<text x="28" y="44" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="700" fill="#003399">${label.replace(/&/g, "&amp;")}</text>
<text x="28" y="66" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" letter-spacing="2" fill="#64748b">CATALOGUE ILLUSTRATION</text>
${art}</svg>`;
  const uri = svgUri(svg);
  return { src: uri, thumb: uri, official: false };
}
