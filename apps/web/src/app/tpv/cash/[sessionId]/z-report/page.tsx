import { ZReport } from '@/components/tpv/cash/z-report';

export default async function ZReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ZReport sessionId={sessionId} />;
}
