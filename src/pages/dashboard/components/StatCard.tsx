interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  color: 'primary' | 'accent' | 'secondary';
}

const colorMap: Record<
  StatCardProps['color'],
  { icon: string; bar: string; halo: string }
> = {
  primary: {
    icon: 'bg-primary-100 text-primary-700',
    bar: 'bg-primary-400',
    halo: 'bg-primary-100/40',
  },
  accent: {
    icon: 'bg-accent-100 text-accent-800',
    bar: 'bg-accent-400',
    halo: 'bg-accent-100/40',
  },
  secondary: {
    icon: 'bg-secondary-100 text-secondary-700',
    bar: 'bg-secondary-300',
    halo: 'bg-secondary-100/50',
  },
};

/**
 * Carte d'indicateur : même contrat de props qu'avant (aucun calcul modifié),
 * uniquement une mise en forme plus premium et plus lisible.
 */
export default function StatCard({ title, value, icon, trend, trendUp, subtitle, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-background-200/90 bg-background-50 p-4 transition-colors duration-200 hover:border-background-300 md:p-5">
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 ${c.halo}`}
      ></div>

      <div className="relative flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.icon}`}>
          <i className={`${icon} text-lg leading-none`}></i>
        </span>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              trendUp ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-800'
            }`}
          >
            <i className={`${trendUp ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[11px] leading-none`}></i>
            {trend}
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <p className="font-heading text-[1.85rem] font-extrabold leading-none tracking-tight text-foreground-950 tabular-nums md:text-[2.05rem]">
          {value}
        </p>
        <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-500">
          {title}
        </p>
        {subtitle && <p className="mt-1 text-[11px] leading-snug text-foreground-400">{subtitle}</p>}
      </div>

      <span className={`absolute inset-x-0 bottom-0 h-[3px] ${c.bar} opacity-70`}></span>
    </div>
  );
}