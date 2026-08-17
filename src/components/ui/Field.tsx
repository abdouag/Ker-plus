'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-xl border bg-white px-4 py-3 text-base text-ink transition-colors ' +
  'placeholder:text-ink-muted/70 focus:border-forest-500 disabled:bg-sand-50 disabled:text-ink-muted';

function controlClass(hasError: boolean, className?: string): string {
  return cn(CONTROL, hasError ? 'border-red-500 bg-red-50/40' : 'border-sand-300', className);
}

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldWrapper({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-forest-700">
        {label}
        {required ? (
          <span className="text-ember-500" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, containerClassName, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldWrapper
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        className={controlClass(Boolean(error), className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        required={required}
        {...props}
      />
    </FieldWrapper>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, containerClassName, className, id, required, children, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldWrapper
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={fieldId}
        className={cn(controlClass(Boolean(error), className), 'appearance-none pr-10')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%231A4D2E'%3E%3Cpath d='M5.5 7.5l4.5 4.5 4.5-4.5' stroke='%231A4D2E' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1.25rem',
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        required={required}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    { label, hint, error, containerClassName, className, id, required, ...props },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FieldWrapper
        label={label}
        htmlFor={fieldId}
        hint={hint}
        error={error}
        required={required}
        className={containerClassName}
      >
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(controlClass(Boolean(error), className), 'min-h-[110px] resize-y')}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          required={required}
          {...props}
        />
      </FieldWrapper>
    );
  },
);

export interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField({ label, error, className, id, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-3">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-sand-400 text-forest-600 accent-forest-600',
              error && 'border-red-500',
              className,
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            {...props}
          />
          <label htmlFor={fieldId} className="cursor-pointer text-sm leading-relaxed text-ink-soft">
            {label}
          </label>
        </div>
        {error ? (
          <p id={`${fieldId}-error`} role="alert" className="pl-8 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
