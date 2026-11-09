'use client';

import { trpc } from '@/lib/trpc/client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tpv/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CashMovementDialog } from './cash-movement-dialog';
import { CloseCashSessionDialog } from './close-cash-session-dialog';
import { OpenCashSessionDialog } from './open-cash-session-dialog';

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

function openZReportWindow(sessionId: string) {
  window.open(
    `/tpv/cash/${sessionId}/z-report`,
    'z-report',
    'width=420,height=800,menubar=no,toolbar=no',
  );
}

const chipClass =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function TpvCashChip() {
  const t = useTranslations('tpv.cash');
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  // Cobros y movimientos invalidan todo `cashSession` (ver payment-dialog y los diálogos de
  // caja), así que el esperado del chip se refresca solo tras cada operación.
  const { data: session } = trpc.cashSession.getCurrent.useQuery();
  const isOpen = session != null;

  // El servidor decide si este rol puede ver el esperado (cierre ciego); si no, visible=false
  // y el chip solo dice "Caja abierta".
  const { data: expected } = trpc.cashSession.getExpected.useQuery(undefined, {
    enabled: isOpen,
  });
  const expectedCents = expected?.visible ? expected.expectedAmountCents : null;

  return (
    <>
      {isOpen ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={chipClass} aria-label={t('status.open')}>
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              <span className="font-medium text-foreground">
                {expectedCents !== null
                  ? t('status.openWithExpected', { amount: formatCents(expectedCents) })
                  : t('status.open')}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowMovement(true)}>
              {t('movementAction')}
            </DropdownMenuItem>
            {/* El informe X revela el esperado: el servidor lo bloquea en cierre ciego y aquí
                ni se ofrece. */}
            {expected?.visible && (
              <DropdownMenuItem onClick={() => openZReportWindow(session.id)}>
                {t('zReportAction')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowClose(true)}
              className="text-destructive focus:text-destructive"
            >
              {t('closeAction')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button type="button" size="lg" onClick={() => setShowOpen(true)}>
          {t('openAction')}
        </Button>
      )}

      <OpenCashSessionDialog
        open={showOpen}
        onOpenChange={setShowOpen}
        onSuccess={() => setShowOpen(false)}
      />

      <CloseCashSessionDialog
        open={showClose}
        onOpenChange={setShowClose}
        onSuccess={(sessionId) => {
          setShowClose(false);
          openZReportWindow(sessionId);
        }}
      />

      <CashMovementDialog
        open={showMovement}
        onOpenChange={setShowMovement}
        onSuccess={() => setShowMovement(false)}
      />
    </>
  );
}
