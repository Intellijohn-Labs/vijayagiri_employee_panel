export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 5 * 1024 * 1024;
const FULL_SIDE = 1200;
const THUMB_SIDE = 176;

/** Returns a message if the file can't be used, otherwise null. */
export function validateImage(file: File, maxBytes = MAX_BYTES): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WEBP images are supported`;
  if (file.size > maxBytes) return `${file.name}: larger than ${Math.round(maxBytes / 1024 / 1024)} MB`;
  return null;
}

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

/**
 * Downscales a photo to a compact WebP (longest side 1200px unless asked for more) plus a square cover-cropped thumbnail, both as
 * data URLs. Keeping them small is what lets photos persist in the browser — a raw 5 MB upload would not.
 */
export async function processImage(file: File, fullSide = FULL_SIDE): Promise<{ src: string; thumb: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await load(url);

    const scale = Math.min(1, fullSide / Math.max(img.width, img.height));
    const full = document.createElement("canvas");
    full.width = Math.round(img.width * scale);
    full.height = Math.round(img.height * scale);
    full.getContext("2d")!.drawImage(img, 0, 0, full.width, full.height);
    let src = full.toDataURL("image/webp", 0.8);
    if (!src.startsWith("data:image/webp")) src = full.toDataURL("image/jpeg", 0.82); // browsers without WebP encoding

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = thumbCanvas.height = THUMB_SIDE;
    const ctx = thumbCanvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, THUMB_SIDE, THUMB_SIDE);
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, THUMB_SIDE, THUMB_SIDE);
    return { src, thumb: thumbCanvas.toDataURL("image/jpeg", 0.8) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A square, cover-cropped profile photo (256px JPEG data URL) small enough to keep in the browser with the employee record. */
export async function processAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await load(url);
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
