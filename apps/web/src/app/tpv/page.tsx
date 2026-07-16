import { TpvHeader } from '@/components/tpv/tpv-header';
import { TpvNavTabs } from '@/components/tpv/tpv-nav-tabs';
import { TpvOrderSidebar } from '@/components/tpv/tpv-order-sidebar';

export default function TpvPage() {
  return (
    <div className="flex h-full flex-col">
      <TpvHeader />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">
          <TpvNavTabs />
        </main>
        <TpvOrderSidebar />
      </div>
    </div>
  );
}
