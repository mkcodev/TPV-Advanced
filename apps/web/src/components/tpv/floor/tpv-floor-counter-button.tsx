'use client';

import { useOrderStore } from '@/lib/stores/use-order-store';
import { Button } from '@tpv/ui';
import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function TpvFloorCounterButton() {
  const t = useTranslations('tpv.floor');
  const router = useRouter();
  const setActiveCounter = useOrderStore((s) => s.setActiveCounter);

  function handlePress() {
    setActiveCounter();
    router.push('/tpv/order');
  }

  return (
    <Button
      size="lg"
      variant="outline"
      onClick={handlePress}
      className="h-16 gap-3 border-2 text-base font-semibold"
    >
      <ShoppingCart size={20} strokeWidth={1.5} />
      {t('counter')}
    </Button>
  );
}
