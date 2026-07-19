'use client';

import { getActiveBusinessClient } from '@/lib/business/active';
import { StorageError, uploadProductImage } from '@/lib/supabase/storage';
import { Button } from '@tpv/ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageCropDialog } from './image-crop-dialog';

// TODO(orphan-images): al reemplazar o eliminar la foto de un producto, el objeto anterior
// queda huérfano en el bucket 'product-images'. La política DELETE existe en Supabase Storage
// (product_images_delete_own_business en setup-storage.ts), así que se podría borrar el
// antiguo antes de subir el nuevo. Pendiente para evitar acumulación de basura en el bucket.

const MAX_SOURCE_BYTES = 15 * 1024 * 1024; // 15 MB — la imagen fuente, antes de comprimir
const MAX_MEGAPIXELS = 40_000_000; // 40 MP — evita OOM al dibujar en canvas
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

export function ImageUploader({ value, onChange, disabled }: Props) {
  const t = useTranslations('admin.catalog.products.image');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  // Revocar el objectURL si el componente se desmonta con el dialog abierto
  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de tipo
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error(t('errorInvalidType'));
      return;
    }

    // Validación de tamaño de la fuente (antes de comprimir)
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error(t('errorTooLarge'));
      return;
    }

    // Validación de megapíxeles (carga la imagen para leer dimensiones)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (img.naturalWidth * img.naturalHeight > MAX_MEGAPIXELS) {
        URL.revokeObjectURL(url);
        toast.error(t('errorTooManyPixels'));
        return;
      }
    } catch {
      // Si decode falla el cropper lo manejará
    }

    setSourceUrl(url);
    setCropOpen(true);
  }

  async function handleCropConfirm(croppedFile: File) {
    const businessId = getActiveBusinessClient();
    if (!businessId) return;

    setUploading(true);
    try {
      const url = await uploadProductImage(croppedFile, businessId);
      onChange(url);
      handleCleanup();
    } catch (err) {
      const msg = err instanceof StorageError ? err.message : t('errorCropFailed');
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleCropCancel() {
    handleCleanup();
  }

  function handleCleanup() {
    setCropOpen(false);
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      setSourceUrl(null);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative h-32 w-32 overflow-hidden rounded-md border border-input">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="product" className="h-full w-full object-cover" />
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          aria-busy={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={14} strokeWidth={1.5} />
          {uploading ? t('uploading') : t('upload')}
        </Button>

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => onChange(null)}
          >
            <Trash2 size={14} strokeWidth={1.5} />
            {t('remove')}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('hint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />

      <ImageCropDialog
        open={cropOpen}
        sourceUrl={sourceUrl}
        busy={uploading}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
