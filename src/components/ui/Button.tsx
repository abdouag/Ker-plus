import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember-400 text-forest-800 hover:bg-ember-300 active:bg-ember-500 shadow-card font-bold',
  secondary:
    'bg-forest-600 text-white hover:bg-forest-500 active:bg-forest-700 shadow-card font-semibold',
  ghost:
    'bg-white text-forest-700 border border-forest-200 hover:bg-sand-50 active:bg-sand-100 font-semibold',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 font-semibold',
};

const SIZES: Record<Size, string> = {
  // Cibles tactiles ≥ 44 px de haut, conformément aux bonnes pratiques mobiles.
  sm: 'min-h-[40px] px-4 text-sm',
  md: 'min-h-[48px] px-5 text-base',
  lg: 'min-h-[56px] px-6 text-base sm:text-lg',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 select-none text-center';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      aria-busy={loading || undefined}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

export interface LinkButtonProps {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
  prefetch?: boolean;
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </Link>
  );
}
