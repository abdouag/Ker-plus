import Link from 'next/link';
import type { RequestKind, RequestStatus } from '@prisma/client';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { Badge } from '@/components/ui/Feedback';
import { REQUEST_KIND_LABELS } from '@/lib/care/constants';
import { formatDateTime } from '@/lib/format';

export interface MissionSummary {
  reference: string;
  status: RequestStatus;
  kind: RequestKind;
  categoryName: string;
  commune: string;
  quartier: string | null;
  createdAt: Date;
  nextAppointment?: { startsAt: Date; confirmed: boolean } | null;
}

export function MissionCard({ mission }: { mission: MissionSummary }) {
  return (
    <li>
      <Link
        href={`/ker-care/prestataire/missions/${mission.reference}`}
        className="block min-h-[44px] rounded-xl border border-sand-200 bg-white p-4 shadow-card transition-colors hover:border-forest-300"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-forest-700">{mission.categoryName}</span>
          <RequestStatusBadge status={mission.status} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {mission.commune}
          {mission.quartier ? ` · ${mission.quartier}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>{mission.reference}</span>
          <span>· reçue le {formatDateTime(mission.createdAt)}</span>
          {mission.kind !== 'PLANNED' ? (
            <Badge tone={mission.kind === 'EMERGENCY' ? 'danger' : 'warning'}>
              {REQUEST_KIND_LABELS[mission.kind]}
            </Badge>
          ) : null}
        </div>
        {mission.nextAppointment ? (
          <p className="mt-2 text-sm font-semibold text-forest-600">
            Rendez-vous {mission.nextAppointment.confirmed ? 'confirmé' : 'proposé'} :{' '}
            {formatDateTime(mission.nextAppointment.startsAt)}
          </p>
        ) : null}
      </Link>
    </li>
  );
}
