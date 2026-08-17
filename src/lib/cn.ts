import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fusion de classes Tailwind sans conflit. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
