'use client';

import { trpc } from '@/lib/trpc/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tpv/ui';
import { KeyRound, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmployeeFormDialog } from './employee-form-dialog';
import { EmployeePinDialog } from './employee-pin-dialog';
import type { Employee } from './employee-types';

type Props = {
  employees: Employee[];
  isLoading: boolean;
};

const ROLE_BADGE = { admin: 'default', manager: 'secondary', worker: 'outline' } as const;

// lockedUntil llega como texto ISO (tRPC sin transformer): se compara como fecha.
function lockedUntilDate(employee: Employee): Date | null {
  if (!employee.lockedUntil) return null;
  const until = new Date(employee.lockedUntil);
  return until.getTime() > Date.now() ? until : null;
}

export function EmployeesTable({ employees, isLoading }: Props) {
  const t = useTranslations('admin.employees');
  const tc = useTranslations('common');
  const utils = trpc.useUtils();

  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [pinTarget, setPinTarget] = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);

  const setActiveMutation = trpc.employees.setActive.useMutation({
    onSuccess: async (_, vars) => {
      await utils.employees.list.invalidate();
      toast.success(vars.isActive ? t('toast.activated') : t('toast.deactivated'));
    },
    onError: (err) => {
      console.error(err);
      toast.error(t('toast.error'));
    },
  });

  function handleToggleActive(employee: Employee, next: boolean) {
    // Desactivar corta su sesión: se pide confirmación. Reactivar es inmediato.
    if (next) setActiveMutation.mutate({ id: employee.id, isActive: true });
    else setDeactivateTarget(employee);
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false });
    setDeactivateTarget(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => `sk-${i}`).map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.name')}</TableHead>
            <TableHead>{t('columns.role')}</TableHead>
            <TableHead>{t('columns.status')}</TableHead>
            <TableHead className="w-20 text-center">{t('columns.active')}</TableHead>
            <TableHead className="w-28">{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const lockedUntil = lockedUntilDate(employee);
            return (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_BADGE[employee.role]}>{t(`roles.${employee.role}`)}</Badge>
                </TableCell>
                <TableCell>
                  {!employee.isActive ? (
                    <Badge variant="secondary">{t('status.inactive')}</Badge>
                  ) : lockedUntil ? (
                    <Badge variant="warning">
                      {t('status.lockedUntil', {
                        time: lockedUntil.toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                    </Badge>
                  ) : (
                    <Badge variant="success">{t('status.active')}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={employee.isActive}
                    onCheckedChange={(v) => handleToggleActive(employee, v)}
                    aria-label={t('columns.active')}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('actions.edit')}
                      onClick={() => setEditTarget(employee)}
                      className="h-11 w-11"
                    >
                      <Pencil size={16} strokeWidth={1.5} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('actions.changePin')}
                      onClick={() => setPinTarget(employee)}
                      className="h-11 w-11"
                    >
                      <KeyRound size={16} strokeWidth={1.5} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <EmployeeFormDialog
        open={Boolean(editTarget)}
        employee={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null);
          toast.success(t('toast.updated'));
        }}
      />

      <EmployeePinDialog
        employee={pinTarget}
        onClose={() => setPinTarget(null)}
        onSuccess={() => {
          setPinTarget(null);
          toast.success(t('toast.pinChanged'));
        }}
      />

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deactivate.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deactivate.description', { name: deactivateTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>
              {t('deactivate.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
