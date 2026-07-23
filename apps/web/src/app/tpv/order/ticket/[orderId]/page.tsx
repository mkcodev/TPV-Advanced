import { InvoiceTicket } from '@/components/tpv/print/invoice-ticket';

// Ventana de ticket imprimible — se abre con window.open() desde el TPV.
// Auto-dispara window.print() al cargar los datos.
export default async function TicketPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <InvoiceTicket orderId={orderId} />;
}
