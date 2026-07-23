import { KitchenOrder } from '@/components/tpv/print/kitchen-order';

// Ventana de comanda de cocina — se abre con window.open() desde el TPV.
// Auto-dispara window.print() al cargar los datos.
export default async function KitchenPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <KitchenOrder orderId={orderId} />;
}
