import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  icon?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export default function FormField({
  label,
  icon,
  error,
  required,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground-700">
        {icon && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-foreground-400">
            <i className={icon}></i>
          </span>
        )}
        <span>
          {label}
          {required && <span className="text-accent-500"> *</span>}
        </span>
      </label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-accent-600">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1 text-xs text-foreground-400">{hint}</p>}
    </div>
  );
}