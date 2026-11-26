import type { ActorType, RequestStatus } from '@prisma/client';
import { REQUEST_STATUS_LABELS } from '@/lib/care/constants';
import { formatDateTime } from '@/lib/format';

const ACTOR_LABELS: Record<ActorType, string> = {
  CLIENT: 'Client',
  PROVIDER: 'Prestataire',
  ADMIN: 'Kerplus',
  SYSTEM: 'Système',
};

export interface TimelineEvent {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorType: ActorType;
  reason: string | null;
  createdAt: Date;
  /** Nom de l'acteur — affiché uniquement en administration. */
  actorName?: string | null;
}

/** Historique horodaté (fuseau Africa/Dakar) des événements d'une demande. */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-muted">Aucun événement pour le moment.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l-2 border-sand-200 pl-5">
      {events.map((event) => {
        const changed = event.fromStatus !== event.toStatus;
        return (
          <li key={event.id} className="relative">
            <span
              aria-hidden="true"
              className={
                'absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ' +
                (changed ? 'bg-forest-600' : 'bg-sand-400')
              }
            />
            <p className="text-sm font-semibold text-forest-700">
              {changed ? REQUEST_STATUS_LABELS[event.toStatus] : event.reason}
            </p>
            {changed && event.reason ? (
              <p className="text-sm text-ink-soft">{event.reason}</p>
            ) : null}
            <p className="text-xs text-ink-muted">
              <time dateTime={event.createdAt.toISOString()}>{formatDateTime(event.createdAt)}</time>
              {' · '}
              {ACTOR_LABELS[event.actorType]}
              {event.actorName ? ` (${event.actorName})` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
