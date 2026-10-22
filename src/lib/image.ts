/** Longest side, in pixels, a stored claim photo is scaled down to. */
const MAX_EDGE = 960;
/** Claims live in localStorage (about 5 MB for everything), so photos are kept small. */
const MAX_CHARS = 300_000;

/** Reads an image file and returns it as a compressed JPEG data URL small enough to keep on the claim. */
export async function photoToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG, WebP or HEIC).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That image could not be read. Try a JPG or PNG."));
      el.src = url;
    });
    for (const [edge, quality] of [[MAX_EDGE, 0.8], [MAX_EDGE, 0.65], [720, 0.6], [560, 0.55]] as const) {
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser cannot process images.");
      ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black as JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= MAX_CHARS) return data;
    }
    throw new Error("That photo is too detailed to store. Try a smaller one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
