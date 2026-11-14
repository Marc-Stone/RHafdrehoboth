import type { ReactNode } from 'react';

interface SectionTitleProps {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Titre de section : hiérarchie visuelle claire entre les blocs du tableau de bord. */
export default function SectionTitle({ kicker, title, description, action }: SectionTitleProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && (
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-600">{kicker}</p>
        )}
        <h2 className="mt-1 font-heading text-lg font-bold leading-tight text-foreground-950 md:text-xl">
          {title}
        </h2>
        {description && <p className="mt-1 text-[13px] text-foreground-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}