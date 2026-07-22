'use client';

import { useEmployeeStore } from '@/lib/stores/use-employee-store';
import { SESSION_JWT_TTL_MS } from '@/lib/tpv/auth-constants';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmployeeAvatarGrid } from './employee-avatar-grid';
import { PinKeypad } from './pin-keypad';

export function EmployeeLoginScreen() {
  const t = useTranslations('tpv.auth');
  const login = useEmployeeStore((s) => s.login);

  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const handleSelect = (id: string, name: string) => {
    setSelected({ id, name });
  };

  const handleSuccess = (
    sessionToken: string,
    employee: {
      id: string;
      name: string;
      avatarUrl: string | null;
      role: 'admin' | 'manager' | 'worker';
    },
  ) => {
    login(sessionToken, employee, Date.now() + SESSION_JWT_TTL_MS);
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('login.title')}
          </h1>
        </div>

        {selected ? (
          /* PIN entry view */
          <div className="flex justify-center">
            <PinKeypad
              employeeId={selected.id}
              employeeName={selected.name}
              onSuccess={handleSuccess}
              onBack={() => setSelected(null)}
            />
          </div>
        ) : (
          /* Employee grid */
          <EmployeeAvatarGrid selectedId={null} onSelect={handleSelect} />
        )}
      </div>
    </div>
  );
}
