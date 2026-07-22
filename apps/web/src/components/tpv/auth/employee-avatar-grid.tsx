'use client';

import { useDeviceStore } from '@/lib/stores/use-device-store';
import { trpc } from '@/lib/trpc/client';
import { Avatar, AvatarFallback, AvatarImage } from '@tpv/ui';
import { useTranslations } from 'next-intl';

interface EmployeeCardProps {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'manager' | 'worker';
  onSelect: (id: string, name: string) => void;
}

interface EmployeeAvatarGridProps {
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
}

export function EmployeeAvatarGrid({ selectedId, onSelect }: EmployeeAvatarGridProps) {
  const t = useTranslations('tpv.auth');
  const clearDevice = useDeviceStore((s) => s.clear);

  const {
    data: employees = [],
    isLoading,
    error,
  } = trpc.auth.listEmployees.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 w-full">
        {(['sk0', 'sk1', 'sk2'] as const).map((key) => (
          <div key={key} className="flex flex-col items-center gap-2 animate-pulse">
            <div className="h-20 w-20 rounded-full bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    const code = (error as { data?: { code?: string } }).data?.code;
    if (code === 'UNAUTHORIZED') {
      // Device was revoked — clear token and let the gate redirect to pairing.
      clearDevice();
    }
    return (
      <p role="alert" className="text-sm text-destructive text-center">
        {t('login.errors.deviceRevoked')}
      </p>
    );
  }

  if (employees.length === 0) {
    return <p className="text-sm text-muted-foreground text-center">{t('login.noEmployees')}</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-4 w-full">
      {employees.map((emp) => (
        <EmployeeCard
          key={emp.id}
          id={emp.id}
          name={emp.name}
          avatarUrl={emp.avatarUrl}
          role={emp.role}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function EmployeeCard({ id, name, avatarUrl, role, onSelect }: EmployeeCardProps) {
  const t = useTranslations('tpv.auth.chip.role');
  const initial = name.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(id, name)}
      className="flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
    >
      <Avatar className="h-20 w-20">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="text-2xl font-semibold bg-primary text-primary-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground leading-tight">{name}</p>
        <p className="text-xs text-muted-foreground">{t(role)}</p>
      </div>
    </button>
  );
}
