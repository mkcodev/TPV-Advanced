'use client';

import { getActiveBusinessClient } from '@/lib/business/active';
import { StorageError, uploadProductImage } from '@/lib/supabase/storage';
import { Button } from '@tpv/ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

export function ImageUploader({ value, onChange, disabled }: Props) {
  const t = useTranslations('admin.catalog.products.image');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const businessId = getActiveBusinessClient();
    if (!businessId) return;

    setUploading(true);
    try {
      const url = await uploadProductImage(file, businessId);
      onChange(url);
    } catch (err) {
      const msg = err instanceof StorageError ? err.message : t('..'); // fallback
      console.error(err);
      toast.error(msg || t('..'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
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
    </div>
  );
}
