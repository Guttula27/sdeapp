/**
 * Client-side image resize + JPEG encode used by every admin upload path.
 *
 * Single source of truth so the upload caps stay consistent across menu,
 * outlet profile, business profile, cluster — every page used to keep its
 * own copy with subtly different defaults, which is how the menu page
 * ended up shipping 200 KB photos while the outlet page was already
 * sane.
 *
 * Tuned for the inline-base64 storage path (DB column is MEDIUMTEXT, wire
 * limit is 16 MB). When object storage lands the caps can relax but the
 * helper surface stays the same — upload code keeps calling
 * `fileToDataUrl` and only the eventual sink changes.
 *
 * Defaults are intentionally tight: 400 px / q=0.70 on the main image
 * produces ~12-22 KB JPEGs that load on weak (2G/edge) networks where
 * 600 px was timing out. Images look visibly soft on retina phones but
 * stay usable; if quality matters more than load time we'll move to
 * object storage and bump the cap back up.
 */

export const IMAGE_PRESETS = {
  // Main item photo, item gallery, outlet primary image, cluster cover.
  // 400 px renders at ~1.1× density at the ~360 px detail-sheet width on
  // retina phones — soft but functional. Trade-off acknowledged: this is
  // a stop-gap until object storage lands (option E in the perf plan).
  ITEM:     { maxSize: 400, quality: 0.70, sizeLimitKB: 4096 },
  // Logos and explicit thumbnails. Always rendered at avatar size, so
  // anything past 240 px is wasted bytes.
  AVATAR:   { maxSize: 240, quality: 0.72, sizeLimitKB: 2048 },
} as const;

export interface ResizeOptions {
  maxSize?: number;
  quality?: number;
  // Source-file cap *before* resize, to reject pathological uploads.
  // Modern phone photos sit at 2–4 MB raw, so 4 MB is the right default.
  sizeLimitKB?: number;
}

/**
 * Decode → downscale → JPEG re-encode an image File into a data URL.
 * Returns the original data URL untouched only if a 2D canvas isn't
 * available (Safari Private Mode edge case).
 */
export async function fileToDataUrl(file: File, opts: ResizeOptions = {}): Promise<string> {
  const maxSize = opts.maxSize ?? IMAGE_PRESETS.ITEM.maxSize;
  const quality = opts.quality ?? IMAGE_PRESETS.ITEM.quality;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid image'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Convenience: pull a File out of an input change event, validate
 * mime + size, then run it through fileToDataUrl. Returns null on
 * validation failure after surfacing a toast (caller-supplied error
 * handler).
 */
export async function pickAndResize(
  e: React.ChangeEvent<HTMLInputElement>,
  preset: ResizeOptions = IMAGE_PRESETS.ITEM,
  onError?: (message: string) => void,
): Promise<string | null> {
  const file = e.target.files?.[0];
  e.target.value = ''; // allow re-selecting the same file
  if (!file) return null;
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
    onError?.('Only JPG, PNG or WebP images are allowed');
    return null;
  }
  const limitKB = preset.sizeLimitKB ?? IMAGE_PRESETS.ITEM.sizeLimitKB!;
  if (file.size > limitKB * 1024) {
    onError?.(`Image is larger than ${limitKB} KB`);
    return null;
  }
  try {
    return await fileToDataUrl(file, preset);
  } catch {
    onError?.('Could not read that image');
    return null;
  }
}
