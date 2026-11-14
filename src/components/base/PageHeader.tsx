import type { ReactNode } from 'react';

type Tone = 'primary' | 'accent' | 'secondary';

const toneBadge: Record<Tone, string> = {
  primary: 'bg-primary-100 text-primary-700 ring-primary-200/70',
  accent: 'bg-accent-100 text-accent-700 ring-accent-200/70',
  secondary: 'bg-secondary-100 text-secondary-700 ring-secondary-200/70',
};

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Petite ligne au-dessus du titre (section, contexte). */
  eyebrow?: string;
  /** Classe Remix Icon affichee dans la pastille. */
  icon?: string;
  tone?: Tone;
  /** Actions (boutons) alignees a droite sur grand ecran. */
  actions?: ReactNode;
  /** Puces d'information affichees sous le titre (compteurs, filtres actifs...). */
  meta?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  tone = 'primary',
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {icon ? (
          <span
            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${toneBadge[tone]}`}
          >
            <i className={`${icon} text-xl`}></i>
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-600">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-heading text-[22px] font-bold leading-tight tracking-tight text-foreground-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-500">{description}</p>
          ) : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end sm:pt-1">{actions}</div>
      ) : null}
    </div>
  );
}