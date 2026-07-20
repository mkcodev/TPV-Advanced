'use client';

import { setActiveBusinessClient } from '@/lib/business/active';
import { trpc } from '@/lib/trpc/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SelectBusinessPage() {
  const t = useTranslations('admin.selectBusiness');
  const router = useRouter();
  const { data, isLoading, error } = trpc.me.listMemberships.useQuery();

  // Auto-selección cuando hay un único negocio.
  useEffect(() => {
    if (!data) return;
    const allBusinesses = data.flatMap((org) => org.businesses);
    const single = allBusinesses[0];
    if (allBusinesses.length === 1 && single) {
      setActiveBusinessClient(single.id);
      router.push('/admin');
    }
  }, [data, router]);

  function handleSelect(businessId: string) {
    setActiveBusinessClient(businessId);
    router.push('/admin');
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-destructive">
          Error cargando negocios: {error.message} ({error.data?.code})
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </main>
    );
  }

  const allBusinesses = data?.flatMap((org) => org.businesses) ?? [];

  if (allBusinesses.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">{t('empty')}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-xl font-semibold">{t('title')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>
        <div className="space-y-3">
          {data?.map((org) =>
            org.businesses.map((business) => (
              <Card key={business.id} className="cursor-pointer transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{business.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="mb-3 text-xs text-muted-foreground">{org.organizationName}</p>
                  <Button size="sm" onClick={() => handleSelect(business.id)}>
                    {t('access')}
                  </Button>
                </CardContent>
              </Card>
            )),
          )}
        </div>
      </div>
    </main>
  );
}
