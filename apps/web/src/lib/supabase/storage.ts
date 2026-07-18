import { getSupabaseBrowser } from './browser';

const BUCKET = 'product-images';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export async function uploadProductImage(file: File, businessId: string): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new StorageError(
      `La imagen no puede superar 2 MB (tamaño: ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new StorageError('Formato no admitido. Usa PNG, JPG o WebP.');
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;

  const supabase = getSupabaseBrowser();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new StorageError(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
