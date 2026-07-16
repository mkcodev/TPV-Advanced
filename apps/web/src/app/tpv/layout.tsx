import type { ReactNode } from 'react';

export default function TpvLayout({ children }: { children: ReactNode }) {
  return <div className="h-dvh w-full overflow-hidden bg-background">{children}</div>;
}
