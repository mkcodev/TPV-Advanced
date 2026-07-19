export type CropArea = { x: number; y: number; width: number; height: number };
export type CropOutput = { file: File; mimeType: 'image/webp' | 'image/jpeg'; width: number; height: number };
export type CropOptions = { maxSize?: number; quality?: number };

let webpCache: boolean | undefined;

/** Feature-detects WebP encoding support. Result is cached after the first call. */
export function supportsWebP(): boolean {
  if (webpCache !== undefined) return webpCache;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  webpCache = c.toDataURL('image/webp').startsWith('data:image/webp');
  return webpCache;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Crops `sourceUrl` (an objectURL) to `cropArea` and returns a compressed File.
 * Output size is clamped to `maxSize` (default 800) — never upscaled.
 * Prefers WebP; falls back to JPEG if the browser doesn't support WebP encoding.
 */
export async function cropImageToFile(
  sourceUrl: string,
  cropArea: CropArea,
  options: CropOptions = {},
): Promise<CropOutput> {
  const maxSize = options.maxSize ?? 800;
  const quality = options.quality ?? 0.85;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = sourceUrl;
  // decode() awaits load + auto-applies EXIF orientation on modern browsers
  await img.decode();

  // Never upscale: clamp canvas size to the actual crop pixel width
  const size = Math.min(maxSize, Math.round(cropArea.width));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-2d-unavailable');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    size,
    size,
  );

  const useWebP = supportsWebP();
  const primaryMime = useWebP ? 'image/webp' : 'image/jpeg';
  let blob = await canvasToBlob(canvas, primaryMime, quality);
  let mimeType: 'image/webp' | 'image/jpeg' = primaryMime as 'image/webp' | 'image/jpeg';

  // Fallback: if WebP blob is null (shouldn't happen after the feature test, but be safe)
  if (!blob && useWebP) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    mimeType = 'image/jpeg';
  }

  if (!blob) throw new Error('canvas-toblob-failed');

  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const file = new File([blob], `product-${crypto.randomUUID()}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });

  return { file, mimeType, width: size, height: size };
}
