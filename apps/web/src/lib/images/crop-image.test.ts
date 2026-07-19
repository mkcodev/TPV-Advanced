import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeCanvasSize, cropImageToFile } from './crop-image';
import type { CropDeps } from './crop-image';

const FAKE_BLOB_WEBP = new Blob(['x'], { type: 'image/webp' });
const FAKE_BLOB_JPEG = new Blob(['y'], { type: 'image/jpeg' });
const CROP = { x: 10, y: 10, width: 200, height: 200 };
const SRC = 'blob:test-url';

// ─── Funciones puras (sin DOM) ───────────────────────────────────────────────

describe('computeCanvasSize', () => {
  it('no upscala cuando cropWidth < maxSize', () => {
    expect(computeCanvasSize(200, 800)).toBe(200);
  });

  it('clampa a maxSize cuando cropWidth > maxSize', () => {
    expect(computeCanvasSize(1500, 800)).toBe(800);
  });

  it('redondea cropWidth al entero más cercano', () => {
    expect(computeCanvasSize(200.7, 800)).toBe(201);
  });
});

// ─── Helpers para inyección de dependencias ──────────────────────────────────

type BlobCb = (b: Blob | null) => void;

function makeCanvas(blobResult: Blob | null): HTMLCanvasElement {
  const ctx = { drawImage: vi.fn(), imageSmoothingQuality: 'high' as const };
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((cb: BlobCb) => cb(blobResult)),
  } as unknown as HTMLCanvasElement;
}

function makeImage(): HTMLImageElement {
  return {
    decode: vi.fn().mockResolvedValue(undefined),
    naturalWidth: 400,
    naturalHeight: 300,
    crossOrigin: '',
  } as unknown as HTMLImageElement;
}

function makeDeps(overrides: Partial<CropDeps> = {}): CropDeps {
  return {
    createCanvas: () => makeCanvas(FAKE_BLOB_WEBP),
    loadImage: () => Promise.resolve(makeImage()),
    checkWebP: () => true,
    ...overrides,
  };
}

// ─── cropImageToFile ─────────────────────────────────────────────────────────

describe('cropImageToFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve File webp con nombre correcto cuando checkWebP=true', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

    const result = await cropImageToFile(SRC, CROP, {}, makeDeps());

    expect(result.mimeType).toBe('image/webp');
    expect(result.file.name).toBe('product-test-uuid.webp');
    expect(result.file.type).toBe('image/webp');
  });

  it('no hace upscale: createCanvas recibe min(maxSize, cropWidth)', async () => {
    let capturedSize = 0;
    const deps = makeDeps({
      createCanvas: (size) => {
        capturedSize = size;
        return makeCanvas(FAKE_BLOB_WEBP);
      },
    });

    await cropImageToFile(SRC, CROP, { maxSize: 800 }, deps);

    expect(capturedSize).toBe(200); // CROP.width=200 < maxSize=800
  });

  it('clampa a maxSize cuando cropArea.width > maxSize', async () => {
    let capturedSize = 0;
    const bigCrop = { x: 0, y: 0, width: 1500, height: 1500 };
    const deps = makeDeps({
      createCanvas: (size) => {
        capturedSize = size;
        return makeCanvas(FAKE_BLOB_WEBP);
      },
    });

    await cropImageToFile(SRC, bigCrop, { maxSize: 800 }, deps);

    expect(capturedSize).toBe(800);
  });

  it('cae a jpeg cuando webp toBlob devuelve null', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

    const canvas = makeCanvas(null);
    (canvas.toBlob as ReturnType<typeof vi.fn>)
      .mockImplementationOnce((cb: BlobCb) => cb(null))       // webp → null
      .mockImplementationOnce((cb: BlobCb) => cb(FAKE_BLOB_JPEG)); // fallback jpeg

    const result = await cropImageToFile(SRC, CROP, {}, makeDeps({ createCanvas: () => canvas }));

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.file.name).toBe('product-test-uuid.jpg');
  });

  it('lanza canvas-toblob-failed cuando ambos blobs son null', async () => {
    const canvas = makeCanvas(null);
    (canvas.toBlob as ReturnType<typeof vi.fn>).mockImplementation((cb: BlobCb) => cb(null));

    await expect(
      cropImageToFile(SRC, CROP, {}, makeDeps({ createCanvas: () => canvas })),
    ).rejects.toThrow('canvas-toblob-failed');
  });
});
