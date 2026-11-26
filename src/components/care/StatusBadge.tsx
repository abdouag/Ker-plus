import type { QuoteStatus, RequestStatus, VerificationStatus } from '@prisma/client';
import { Badge } from '@/components/ui/Feedback';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONES,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from '@/lib/care/constants';

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_STATUS_TONES[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={QUOTE_STATUS_TONES[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <Badge tone={VERIFICATION_STATUS_TONES[status]}>{VERIFICATION_STATUS_LABELS[status]}</Badge>
  );
}
