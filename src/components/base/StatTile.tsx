type Tone = 'primary' | 'accent' | 'secondary' | 'neutral';

const toneStyles: Record<Tone, { badge: string; bar: string }> = {
  primary: { badge: 'bg-primary-100 text-primary-700', bar: 'bg-primary-500/80' },
  accent: { badge: 'bg-accent-100 text-accent-700', bar: 'bg-accent-500/80' },
  secondary: { badge: 'bg-secondary-100 text-secondary-700', bar: 'bg-secondary-400/80' },
  neutral: { badge: 'bg-background-100 text-foreground-600', bar: 'bg-background-300' },
};

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: string;
  hint?: string;
  tone?: Tone;
  className?: string;
}

export default function StatTile({
  label,
  value,
  icon,
  hint,
  tone = 'primary',
  className = '',
}: StatTileProps) {
  const styles = toneStyles[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-background-200 bg-background-50 px-4 py-4 transition-colors hover:border-background-300 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-400">
            {label}
          </p>
          <p className="mt-2 font-heading text-[26px] font-bold leading-none tabular-nums text-foreground-950">
            {value}
          </p>
          {hint ? <p className="mt-1.5 text-xs leading-snug text-foreground-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.badge}`}>
            <i className={`${icon} text-lg`}></i>
          </span>
        ) : null}
      </div>
      <span className={`absolute inset-x-0 bottom-0 h-[3px] ${styles.bar}`}></span>
    </div>
  );
}