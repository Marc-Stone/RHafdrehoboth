import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PanelCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  iconClassName?: string;
  action?: { label: string; to: string };
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Panneau visuel réutilisable du tableau de bord : en-tête homogène,
 * séparateur discret et corps libre. Purement présentationnel — aucune
 * donnée n'est calculée ici.
 */
export default function PanelCard({
  title,
  subtitle,
  icon,
  iconClassName = 'bg-background-100 text-foreground-600',
  action,
  badge,
  children,
  className = '',
  bodyClassName = 'mt-4',
}: PanelCardProps) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5 ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
            >
              <i className={`${icon} text-base leading-none`}></i>
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground-900">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] font-medium text-foreground-400">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {action && (
            <Link
              to={action.to}
              className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              {action.label}
              <i className="ri-arrow-right-s-line text-sm leading-none"></i>
            </Link>
          )}
        </div>
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}