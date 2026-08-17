import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<Tone, string> = {
  info: 'bg-forest-50 text-forest-800 border-forest-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-ember-50 text-ember-900 border-ember-200',
  danger: 'bg-red-50 text-red-900 border-red-200',
  neutral: 'bg-sand-50 text-ink-soft border-sand-200',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}) {
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : undefined)}
      className={cn('rounded-xl border px-4 py-3 text-sm leading-relaxed', TONES[tone], className)}
    >
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      {children}
    </div>
  );
}

const BADGE_TONES: Record<Tone, string> = {
  info: 'bg-forest-100 text-forest-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-ember-100 text-ember-800',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-sand-200 text-ink-soft',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-6 py-12 text-center">
      <p className="text-base font-semibold text-forest-700">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted" role="status">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-forest-300 border-t-forest-600"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
