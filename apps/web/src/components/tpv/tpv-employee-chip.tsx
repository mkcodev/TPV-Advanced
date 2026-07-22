'use client';

import { useEmployeeStore } from '@/lib/stores/use-employee-store';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';

export function TpvEmployeeChip() {
  const t = useTranslations('tpv.auth');
  const tEmployee = useTranslations('tpv.employee');
  const employee = useEmployeeStore((s) => s.employee);
  const lock = useEmployeeStore((s) => s.lock);

  if (!employee) {
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            E
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground">
          <span className="sr-only">{tEmployee('label')}: </span>
          {tEmployee('noEmployee')}
        </span>
      </div>
    );
  }

  const initial = employee.name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${tEmployee('label')}: ${employee.name}`}
        >
          <Avatar className="h-8 w-8">
            {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} alt={employee.name} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground leading-none">{employee.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(`chip.role.${employee.role}`)}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={lock}>{t('chip.change')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
