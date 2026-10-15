import { catalogueArt } from "./catalogue-art";
import { officialPhotos } from "./official-images";
import type { CataloguePhoto, PhotoKind } from "./catalogue";
import type { CatalogueModel } from "@/store/catalogue-store";

export interface GalleryImage {
  src: string;
  thumb: string;
  label: string;
}

const KIND_ORDER: Record<PhotoKind, number> = { hero: 0, angle: 1, lifestyle: 2 };
const KIND_LABEL: Record<PhotoKind, string> = { hero: "Studio", angle: "Angle", lifestyle: "Lifestyle" };
const byKind = (a: CataloguePhoto, b: CataloguePhoto) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind];

/**
 * The pictures to show for a model in a colour: photos tagged with that colour first, then the "all colours" ones.
 * With nothing suitable uploaded it falls back to the drawn illustration in that colour (flagged, so the screen can say so).
 */
export function galleryFor(item: CatalogueModel, colour: string | null, hexOf: (c: string) => string): { images: GalleryImage[]; illustration: boolean } {
  const photos = item.media?.photos ?? [];
  const tagged = colour ? photos.filter((p) => p.colour === colour).sort(byKind) : [];
  const general = photos.filter((p) => !p.colour).sort(byKind);
  const picked = [...tagged, ...general];
  if (picked.length) return { images: picked.map((p) => ({ src: p.src, thumb: p.thumb, label: `${p.colour ?? "All colours"} · ${KIND_LABEL[p.kind]}` })), illustration: false };
  // No photos uploaded in the Catalogue Manager: use the official photos listed in the manifest, if any.
  const official = officialPhotos(item.model.id, colour);
  if (official.length) return { images: official.map((src, i) => ({ src, thumb: src, label: `${colour ?? "Official"} · Photo ${i + 1}` })), illustration: false };
  const art = catalogueArt(item.model.id, colour ?? undefined, { category: item.model.category, hex: colour ? hexOf(colour) : undefined, name: item.model.name });
  return { images: [{ src: art.src, thumb: art.thumb, label: colour ?? "Illustration" }], illustration: !art.official };
}

/** One picture for a model card: a real photo (uploaded or official) in the first colour that has one, otherwise the illustration. */
export function heroImage(item: CatalogueModel, hexOf: (c: string) => string): string {
  const colours: (string | null)[] = [item.media?.photos[0]?.colour ?? null, ...item.model.colours, null];
  for (const c of colours) {
    const g = galleryFor(item, c, hexOf);
    if (!g.illustration) return g.images[0].src;
  }
  return galleryFor(item, item.model.colours[0] ?? null, hexOf).images[0].src;
}
