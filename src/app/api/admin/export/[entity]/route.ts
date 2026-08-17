import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth/guard';
import { recordAudit } from '@/lib/audit';
import { exportFileName, toCsv, toXlsx, type ExportColumn } from '@/lib/admin/export';
import { customerWhere, orderWhere, simulationWhere, type ListParams } from '@/lib/admin/queries';
import { formatDateISO, formatDateTime } from '@/lib/format';
import { fromCoefficientInt } from '@/lib/estimation/constants';
import { ORDER_STATUS_LABELS } from '@/lib/services/orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ROWS = 10_000;

type Entity = 'simulations' | 'clients' | 'commandes';

function readParams(url: URL): ListParams {
  return {
    q: url.searchParams.get('q') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    statut: url.searchParams.get('statut') ?? undefined,
    ville: url.searchParams.get('ville') ?? undefined,
    finition: url.searchParams.get('finition') ?? undefined,
  };
}

/**
 * Export CSV / Excel des données d'administration.
 * L'accès est réservé aux administrateurs authentifiés et journalisé.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
): Promise<NextResponse> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
  }

  const { entity } = await params;
  if (!['simulations', 'clients', 'commandes'].includes(entity)) {
    return NextResponse.json({ message: 'Export inconnu.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const filters = readParams(url);

  const { rows, columns, sheet } = await buildExport(entity as Entity, filters);

  const body =
    format === 'csv'
      ? toCsv(rows, columns as ExportColumn<unknown>[])
      : await toXlsx(rows, columns as ExportColumn<unknown>[], sheet);

  await recordAudit({
    adminUserId: admin.id,
    action: `export.${entity}.${format}`,
    entityType: 'Export',
    after: { rows: rows.length, filters },
  });

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type':
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${exportFileName(entity, format)}"`,
      'cache-control': 'private, no-store',
    },
  });
}

async function buildExport(
  entity: Entity,
  filters: ListParams,
): Promise<{ rows: unknown[]; columns: ExportColumn<never>[]; sheet: string }> {
  if (entity === 'simulations') {
    const rows = await prisma.simulation.findMany({
      where: simulationWhere(filters),
      include: { customer: true, orders: { select: { reference: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    type Row = (typeof rows)[number];
    const columns: ExportColumn<Row>[] = [
      { header: 'Référence', value: (row) => row.reference },
      { header: 'Date', value: (row) => formatDateTime(row.createdAt) },
      { header: 'Type de projet', value: (row) => row.projectTypeNameSnapshot },
      {
        header: 'Coefficient projet',
        value: (row) => fromCoefficientInt(row.projectCoefficientSnapshot),
      },
      { header: 'Surface (m²)', value: (row) => row.surface },
      { header: 'Ville', value: (row) => row.cityNameSnapshot },
      {
        header: 'Coefficient ville',
        value: (row) => fromCoefficientInt(row.cityCoefficientSnapshot),
      },
      { header: 'Finition', value: (row) => row.finishNameSnapshot },
      { header: 'Prix au m² (FCFA)', value: (row) => row.pricePerSquareMeterSnapshot },
      { header: 'Fourchette (%)', value: (row) => row.rangePercentageSnapshot / 100 },
      { header: 'Estimation (FCFA)', value: (row) => row.estimatedTotal },
      { header: 'Minimum (FCFA)', value: (row) => row.estimatedMinimum },
      { header: 'Maximum (FCFA)', value: (row) => row.estimatedMaximum },
      {
        header: 'Client',
        value: (row) => (row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : ''),
      },
      { header: 'Email', value: (row) => row.customer?.email ?? '' },
      { header: 'Téléphone', value: (row) => row.customer?.phone ?? '' },
      { header: 'Commande', value: (row) => row.orders[0]?.reference ?? '' },
      { header: 'Source (utm_source)', value: (row) => row.utmSource ?? '' },
      { header: 'Support (utm_medium)', value: (row) => row.utmMedium ?? '' },
      { header: 'Campagne (utm_campaign)', value: (row) => row.utmCampaign ?? '' },
    ];

    return { rows, columns: columns as ExportColumn<never>[], sheet: 'Simulations' };
  }

  if (entity === 'clients') {
    const rows = await prisma.customer.findMany({
      where: customerWhere(filters),
      include: { _count: { select: { simulations: true, orders: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    type Row = (typeof rows)[number];
    const columns: ExportColumn<Row>[] = [
      { header: 'Prénom', value: (row) => row.firstName },
      { header: 'Nom', value: (row) => row.lastName },
      { header: 'Email', value: (row) => row.email },
      { header: 'Téléphone', value: (row) => row.phone },
      { header: 'WhatsApp', value: (row) => row.whatsapp ?? '' },
      { header: 'Ville du projet', value: (row) => row.city ?? '' },
      { header: 'Simulations', value: (row) => row._count.simulations },
      { header: 'Commandes', value: (row) => row._count.orders },
      { header: 'Consentement', value: (row) => formatDateISO(row.consentAt) },
      { header: 'Inscrit le', value: (row) => formatDateTime(row.createdAt) },
      { header: 'Notes internes', value: (row) => row.internalNotes ?? '' },
    ];

    return { rows, columns: columns as ExportColumn<never>[], sheet: 'Clients' };
  }

  const rows = await prisma.order.findMany({
    where: orderWhere(filters),
    include: {
      customer: true,
      simulation: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      report: { select: { status: true, sentAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });

  type Row = (typeof rows)[number];
  const columns: ExportColumn<Row>[] = [
    { header: 'Commande', value: (row) => row.reference },
    { header: 'Statut', value: (row) => ORDER_STATUS_LABELS[row.status] },
    { header: 'Montant (FCFA)', value: (row) => row.amount },
    { header: 'Devise', value: (row) => row.currency },
    { header: 'Client', value: (row) => `${row.customer.firstName} ${row.customer.lastName}` },
    { header: 'Email', value: (row) => row.customer.email },
    { header: 'Téléphone', value: (row) => row.customer.phone },
    { header: 'Simulation', value: (row) => row.simulation?.reference ?? '' },
    { header: 'Estimation (FCFA)', value: (row) => row.simulation?.estimatedTotal ?? '' },
    { header: 'Statut paiement', value: (row) => row.payments[0]?.status ?? '' },
    { header: 'Paiement vérifié', value: (row) => (row.payments[0]?.verified ? 'Oui' : 'Non') },
    { header: 'Référence transaction', value: (row) => row.payments[0]?.externalReference ?? '' },
    { header: 'Payée le', value: (row) => formatDateTime(row.paidAt) },
    { header: 'Échéance', value: (row) => formatDateTime(row.dueAt) },
    { header: 'Livrée le', value: (row) => formatDateTime(row.deliveredAt) },
    { header: 'Statut rapport', value: (row) => row.report?.status ?? '' },
    { header: 'Créée le', value: (row) => formatDateTime(row.createdAt) },
  ];

  return { rows, columns: columns as ExportColumn<never>[], sheet: 'Commandes' };
}
