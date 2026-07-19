'use client';

import 'react-easy-crop/react-easy-crop.css';
import { cropImageToFile } from '@/lib/images/crop-image';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Slider,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  sourceUrl: string | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void | Promise<void>;
  busy?: boolean;
};

export function ImageCropDialog({ open, sourceUrl, onCancel, onConfirm, busy }: Props) {
  const t = useTranslations('admin.catalog.products.image');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleApply() {
    if (!sourceUrl || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const { file } = await cropImageToFile(sourceUrl, croppedAreaPixels);
      await onConfirm(file);
    } catch {
      toast.error(t('errorCropFailed'));
    } finally {
      setProcessing(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !processing) onCancel();
  }

  if (!sourceUrl) return null;

  const isBusy = busy ?? processing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('cropTitle')}</DialogTitle>
          <DialogDescription>{t('cropDescription')}</DialogDescription>
        </DialogHeader>

        {/* Contenedor del recortador — must be position:relative con altura definida */}
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
          <Cropper
            image={sourceUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Control de zoom */}
        <div className="space-y-2 px-1">
          <span className="text-xs text-muted-foreground">{t('zoomLabel')}</span>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={([v]) => v !== undefined && setZoom(v)}
            aria-label={t('zoomLabel')}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="lg" onClick={onCancel} disabled={isBusy}>
            {t('cropCancel')}
          </Button>
          <Button size="lg" onClick={handleApply} disabled={isBusy} aria-busy={isBusy}>
            {t('cropApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
