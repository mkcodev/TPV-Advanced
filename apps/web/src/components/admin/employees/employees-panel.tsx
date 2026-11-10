'use client';

import { trpc } from '@/lib/trpc/client';
import { hasActiveApprover } from '@tpv/core';
import { Button } from '@tpv/ui';
import { AlertTriangle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmployeeFormDialog } from './employee-form-dialog';
import { EmployeesTable } from './employees-table';

export function EmployeesPanel() {
  const t = useTranslations('admin.employees');
  const [newOpen, setNewOpen] = useState(false);

  const { data, isLoading, isError } = trpc.employees.list.useQuery();

  if (isError) {
    toast.error(t('loadError'));
  }

  const employees = data ?? [];
  // Sin ningún manager/admin activo nadie puede autorizar una anulación en el TPV.
  // Se calcula sobre la lista que ya tenemos: se actualiza sola al crear, editar o desactivar.
  const showNoApproverWarning = !isLoading && !isError && !hasActiveApprover(employees);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus size={16} strokeWidth={1.5} />
          {t('new')}
        </Button>
      </div>

      {showNoApproverWarning && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-warning bg-warning/10 px-4 py-3"
        >
          <AlertTriangle size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('noApprover.title')}</p>
            <p className="text-sm text-muted-foreground">{t('noApprover.description')}</p>
          </div>
        </div>
      )}

      {!isLoading && employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setNewOpen(true)}>
            {t('emptyCta')}
          </Button>
        </div>
      ) : (
        <EmployeesTable employees={employees} isLoading={isLoading} />
      )}

      <EmployeeFormDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSuccess={() => {
          setNewOpen(false);
          toast.success(t('toast.created'));
        }}
      />
    </div>
  );
}
