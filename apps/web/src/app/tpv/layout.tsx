import { TpvAuthGate } from '@/components/tpv/auth/tpv-auth-gate';
import { TpvTRPCProvider } from '@/lib/trpc/tpv-provider';
import type { ReactNode } from 'react';

export default function TpvLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <TpvTRPCProvider>
        <TpvAuthGate>{children}</TpvAuthGate>
      </TpvTRPCProvider>
    </div>
  );
}
