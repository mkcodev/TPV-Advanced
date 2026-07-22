import { TpvHeader } from '@/components/tpv/tpv-header';
import { TpvOrderSidebar } from '@/components/tpv/tpv-order-sidebar';
import { TpvShell } from '@/components/tpv/tpv-shell';

export default function TpvOrderPage() {
  return (
    <div className="flex h-full flex-col">
      <TpvHeader />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">
          <TpvShell />
        </main>
        <TpvOrderSidebar />
      </div>
    </div>
  );
}
