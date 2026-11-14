import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ReactNode } from 'react';

const primary = 'oklch(var(--primary-500))';
const accent = 'oklch(var(--accent-500))';
const secondary = 'oklch(var(--secondary-500))';

const pieColors = ['oklch(var(--primary-500))', 'oklch(var(--accent-500))'];

const axisTick = { fontSize: 11, fill: 'oklch(var(--foreground-500))', fontWeight: 500 };

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid oklch(var(--background-300))',
  background: 'oklch(var(--background-50))',
  boxShadow: 'none',
  fontSize: 12,
  padding: '8px 10px',
  color: 'oklch(var(--foreground-900))',
};

export interface NameValue {
  name: string;
  value: number;
}

/**
 * Carte de graphique : en-tête homogène avec tous les autres blocs du
 * tableau de bord. Aucun calcul de donnée n'est effectué ici.
 */
function ChartCard({
  title,
  subtitle,
  icon,
  iconClassName = 'bg-background-100 text-foreground-600',
  children,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  iconClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
      <header className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
          <i className={`${icon} text-base leading-none`}></i>
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground-900">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] font-medium text-foreground-400">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-background-100/50 text-center text-foreground-400">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background-100">
        <i className="ri-bar-chart-line text-xl leading-none"></i>
      </span>
      <p className="mt-2.5 text-[13px]">Aucune donnée pour le moment.</p>
    </div>
  );
}

/** Hauteur commune des zones de graphique (adaptée mobile / desktop). */
const chartHeight = 'h-64 md:h-72';

export function MonthlyChart({ data }: { data: NameValue[] }) {
  return (
    <ChartCard
      title="Présences par mois"
      subtitle="12 derniers mois"
      icon="ri-line-chart-line"
      iconClassName="bg-primary-100 text-primary-700"
    >
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className={chartHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primary} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="oklch(var(--background-200))" />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={6} minTickGap={12} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'oklch(var(--background-300))' }} />
              <Area
                type="monotone"
                dataKey="value"
                name="Pointages"
                stroke={primary}
                strokeWidth={2.5}
                fill="url(#gPrimary)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function CommunityChart({ data }: { data: NameValue[] }) {
  return (
    <ChartCard
      title="Membres par communauté"
      subtitle={`${data.length} communauté${data.length > 1 ? 's' : ''}`}
      icon="ri-group-line"
      iconClassName="bg-accent-100 text-accent-800"
    >
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className={chartHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="oklch(var(--background-200))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ ...axisTick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={data.length > 5 ? -30 : 0}
                textAnchor={data.length > 5 ? 'end' : 'middle'}
                height={data.length > 5 ? 62 : 34}
                dy={6}
              />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'oklch(var(--background-100))' }}
              />
              <Bar dataKey="value" name="Membres" fill={accent} radius={[6, 6, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function GenderChart({ data }: { data: NameValue[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <ChartCard
      title="Répartition par sexe"
      subtitle={total > 0 ? `${total} membres renseignés` : undefined}
      icon="ri-pie-chart-2-line"
      iconClassName="bg-primary-100 text-primary-700"
    >
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div>
          <div className="relative h-52 md:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [`${value} (${pct(Number(value))}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="font-heading text-[1.75rem] font-extrabold leading-none tracking-tight text-foreground-950 tabular-nums">
                  {total}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-foreground-400">
                  membres
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.map((d, index) => (
              <div
                key={d.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-background-100 bg-background-100/60 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: pieColors[index % pieColors.length] }}
                  ></span>
                  <span className="truncate text-[12px] font-semibold text-foreground-700">{d.name}</span>
                </span>
                <span className="shrink-0 text-[12px] text-foreground-500">
                  <strong className="font-bold text-foreground-900 tabular-nums">{d.value}</strong>
                  <span className="text-foreground-400"> · {pct(d.value)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function AgeChart({ data }: { data: NameValue[] }) {
  return (
    <ChartCard
      title="Tranches d'âge"
      subtitle="Répartition des membres"
      icon="ri-user-heart-line"
      iconClassName="bg-secondary-100 text-secondary-700"
    >
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className={chartHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="oklch(var(--background-200))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} dy={6} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ ...axisTick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'oklch(var(--background-100))' }} />
              <Bar dataKey="value" name="Membres" fill={secondary} radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}