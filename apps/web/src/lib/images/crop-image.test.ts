import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cropImageToFile, supportsWebP } from './crop-image';

// ─── Canvas + Image mocks ─────────────────────────────────────────────────────

type BlobCallback = (blob: Blob | null) => void;

function makeMockCanvas(toDataURLResult: string, blobResult: Blob | null) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      drawImage: vi.fn(),
      imageSmoothingQuality: 'high',
    })),
    toBlob: vi.fn((cb: BlobCallback) => cb(blobResult)),
    toDataURL: vi.fn(() => toDataURLResult),
  };
}

function makeMockImage(w = 200, h = 200) {
  return {
    decode: vi.fn().mockResolvedValue(undefined),
    naturalWidth: w,
    naturalHeight: h,
    crossOrigin: '',
    src: '',
  };
}

const FAKE_BLOB = new Blob(['x'], { type: 'image/webp' });
const FAKE_BLOB_JPEG = new Blob(['y'], { type: 'image/jpeg' });

// ─── supportsWebP ─────────────────────────────────────────────────────────────

describe('supportsWebP', () => {
  beforeEach(() => {
    // Reset module cache so webpCache resets between tests
    vi.resetModules();
  });

  it('devuelve true cuando el canvas produce data:image/webp', async () => {
    const mockCanvas = makeMockCanvas('data:image/webp;base64,abc', FAKE_BLOB);
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockCanvas as unknown as HTMLElement);

    const { supportsWebP: fresh } = await import('./crop-image');
    expect(fresh()).toBe(true);
  });

  it('devuelve false cuando el canvas NO produce data:image/webp', async () => {
    const mockCanvas = makeMockCanvas('data:image/png;base64,abc', FAKE_BLOB_JPEG);
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockCanvas as unknown as HTMLElement);

    const { supportsWebP: fresh } = await import('./crop-image');
    expect(fresh()).toBe(false);
  });
});

// ─── cropImageToFile ──────────────────────────────────────────────────────────

describe('cropImageToFile', () => {
  let mockCanvas: ReturnType<typeof makeMockCanvas>;
  let mockImage: ReturnType<typeof makeMockImage>;

  beforeEach(() => {
    vi.resetModules();
    mockCanvas = makeMockCanvas('data:image/webp;base64,abc', FAKE_BLOB);
    mockImage = makeMockImage(400, 300);

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLElement;
      return document.createElement(tag);
    });

    vi.stubGlobal('Image', vi.fn(() => mockImage));
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('devuelve un File con nombre correcto y tipo webp', async () => {
    const { cropImageToFile: fresh } = await import('./crop-image');
    const crop = { x: 0, y: 0, width: 200, height: 200 };
    const result = await fresh('blob:test', crop);

    expect(result.file.name).toMatch(/^product-test-uuid\.webp$/);
    expect(result.file.type).toBe('image/webp');
    expect(result.mimeType).toBe('image/webp');
  });

  it('no hace upscale: canvas = min(maxSize, cropArea.width)', async () => {
    const { cropImageToFile: fresh } = await import('./crop-image');
    const crop = { x: 0, y: 0, width: 200, height: 200 };
    await fresh('blob:test', crop, { maxSize: 800 });

    // El canvas debe ser 200×200, no 800×800
    expect(mockCanvas.width).toBe(200);
    expect(mockCanvas.height).toBe(200);
  });

  it('clampa a maxSize si cropArea.width > maxSize', async () => {
    mockImage = makeMockImage(2000, 2000);
    vi.stubGlobal('Image', vi.fn(() => mockImage));
    const { cropImageToFile: fresh } = await import('./crop-image');
    const crop = { x: 0, y: 0, width: 1500, height: 1500 };
    await fresh('blob:test', crop, { maxSize: 800 });

    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(800);
  });

  it('cae a jpeg cuando webp toBlob devuelve null', async () => {
    // primer canvas: feature-test (returns webp URL), segundo canvas: crop (returns null for webp → falls back)
    const cropCanvas = makeMockCanvas('data:image/webp;base64,abc', null);
    let callCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        callCount++;
        return (callCount === 1 ? mockCanvas : cropCanvas) as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });
    // For the fallback call, return a jpeg blob
    cropCanvas.toBlob = vi
      .fn()
      .mockImplementationOnce((cb: BlobCallback) => cb(null)) // webp → null
      .mockImplementationOnce((cb: BlobCallback) => cb(FAKE_BLOB_JPEG)); // jpeg → ok

    const { cropImageToFile: fresh } = await import('./crop-image');
    const crop = { x: 0, y: 0, width: 200, height: 200 };
    const result = await fresh('blob:test', crop);

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.file.name).toMatch(/\.jpg$/);
  });

  it('lanza error si ambos blobs son null', async () => {
    const failCanvas = makeMockCanvas('data:image/webp;base64,abc', null);
    failCanvas.toBlob = vi.fn((cb: BlobCallback) => cb(null));
    let callCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        callCount++;
        return (callCount === 1 ? mockCanvas : failCanvas) as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    const { cropImageToFile: fresh } = await import('./crop-image');
    const crop = { x: 0, y: 0, width: 200, height: 200 };
    await expect(fresh('blob:test', crop)).rejects.toThrow('canvas-toblob-failed');
  });
});
