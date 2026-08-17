import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const tones = {
    default: 'border-sand-200 bg-white',
    warning: 'border-ember-200 bg-ember-50',
    danger: 'border-red-200 bg-red-50',
    success: 'border-emerald-200 bg-emerald-50',
  } as const;

  const content = (
    <div className={cn('h-full rounded-2xl border p-4 shadow-card', tones[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-forest-700">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:-translate-y-0.5">
        {content}
      </Link>
    );
  }
  return content;
}
