import { Link } from 'react-router-dom';

interface DashboardAction {
  label: string;
  to: string;
  icon: string;
}

interface DashboardHeaderProps {
  greeting: string;
  subtitle: string;
  primaryAction?: DashboardAction;
  secondaryAction?: DashboardAction;
}

function todayLabel(): string {
  const value = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Bandeau d'accueil du tableau de bord : uniquement de la mise en forme.
 * Le nom affiché et le texte d'introduction sont fournis par la page.
 */
export default function DashboardHeader({
  greeting,
  subtitle,
  primaryAction = { label: 'Nouveau pointage', to: '/scanner', icon: 'ri-qr-scan-2-line' },
  secondaryAction = { label: 'Rapports', to: '/reports', icon: 'ri-bar-chart-box-line' },
}: DashboardHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-lg border border-background-200/80 bg-gradient-to-br from-primary-50 via-background-50 to-accent-50/70 p-5 md:p-7">
      <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-accent-100/60 blur-2xl"></div>
      <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-primary-100/50 blur-2xl"></div>

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-background-200/80 bg-background-50/80 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <i className="ri-calendar-line text-[11px] leading-none"></i>
            </span>
            {todayLabel()}
          </span>
          <h1 className="mt-3 font-heading text-2xl font-extrabold leading-tight tracking-tight text-foreground-950 md:text-[28px]">
            {greeting}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-foreground-600 md:text-sm">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {secondaryAction && (
            <Link
              to={secondaryAction.to}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-background-200/90 bg-background-50/90 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className={`${secondaryAction.icon} text-base`}></i>
              {secondaryAction.label}
            </Link>
          )}
          <Link
            to={primaryAction.to}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className={`${primaryAction.icon} text-base`}></i>
            {primaryAction.label}
          </Link>
        </div>
      </div>
    </header>
  );
}