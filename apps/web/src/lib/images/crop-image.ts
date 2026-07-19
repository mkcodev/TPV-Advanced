export type CropArea = { x: number; y: number; width: number; height: number };
export type CropOutput = { file: File; mimeType: 'image/webp' | 'image/jpeg'; width: number; height: number };
export type CropOptions = { maxSize?: number; quality?: number };
export type CropDeps = {
  createCanvas?: (size: number) => HTMLCanvasElement;
  loadImage?: (src: string) => Promise<HTMLImageElement>;
  checkWebP?: () => boolean;
};

/** Pure: target canvas side length — never upscales. */
export function computeCanvasSize(cropWidth: number, maxSize: number): number {
  return Math.min(maxSize, Math.round(cropWidth));
}

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
 * Crops `sourceUrl` to `cropArea` and returns a compressed File.
 * Pass `deps` to inject a fake canvas / image loader in tests.
 */
export async function cropImageToFile(
  sourceUrl: string,
  cropArea: CropArea,
  options: CropOptions = {},
  deps: CropDeps = {},
): Promise<CropOutput> {
  const maxSize = options.maxSize ?? 800;
  const quality = options.quality ?? 0.85;

  const loadImage = deps.loadImage ?? defaultLoadImage;
  const createCanvas = deps.createCanvas ?? defaultCreateCanvas;
  const checkWebP = deps.checkWebP ?? supportsWebP;

  const img = await loadImage(sourceUrl);
  const size = computeCanvasSize(cropArea.width, maxSize);
  const canvas = createCanvas(size);

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

  const useWebP = checkWebP();
  const primaryMime = useWebP ? 'image/webp' : 'image/jpeg';
  let blob = await canvasToBlob(canvas, primaryMime, quality);
  let mimeType: 'image/webp' | 'image/jpeg' = primaryMime as 'image/webp' | 'image/jpeg';

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

function defaultCreateCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

async function defaultLoadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return img;
}
