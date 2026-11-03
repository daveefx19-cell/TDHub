import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-navy-50">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'h-12 w-full rounded-xl border bg-navy-900/80 px-4 text-base text-white placeholder:text-navy-300',
          'transition-colors duration-200 focus:outline-none focus:ring-2',
          error
            ? 'border-rose-400/70 focus:ring-rose-400/40'
            : 'border-navy-600 hover:border-navy-400 focus:border-emerald-400 focus:ring-emerald-400/30',
          className,
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-navy-200">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
