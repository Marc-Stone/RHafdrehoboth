import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useMembers } from '@/hooks/useMembers';
import { useCommunities } from '@/hooks/useCommunities';
import { useEvents } from '@/hooks/useEvents';
import { useAttendances } from '@/hooks/useAttendances';
import { eventStatus } from '@/lib/types';
import { presentStatuses } from '@/lib/constants';
import { formatDateFr } from '@/utils/date';
import StatCard from './StatCard';
import DashboardHeader from './DashboardHeader';
import type { NameValue } from './ChartsSection';

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return localISO(new Date());
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

type Period = 'day' | 'week' | 'month';

const primary = 'oklch(var(--primary-500))';

/**
 * Tableau de bord du responsable de communauté : uniquement les statistiques
 * de sa propre communauté (membres, présences, événements).
 */
export default function LeaderDashboard() {
  const { user } = useAuth();
  const { members } = useMembers();
  const { communities } = useCommunities();
  const { events } = useEvents();
  const { records } = useAttendances();
  const [period, setPeriod] = useState<Period>('week');

  // Mémorisé : `?? []` créait un nouveau tableau à chaque rendu et forçait le
  // recalcul de tous les filtres dépendants.
  const communityIds = useMemo(() => user?.communityIds ?? [], [user?.communityIds]);
  const communityNames = communityIds
    .map((cid) => communities.find((c) => c.id === cid)?.name)
    .filter((n): n is string => Boolean(n));
  const communityName =
    communityNames.length === 0
      ? 'Votre communauté'
      : communityNames.length === 1
        ? communityNames[0]
        : communityNames.join(', ');

  // Isolation par communauté (double sécurité, en plus des RLS).
  const myMembers = useMemo(
    () => members.filter((m) => m.communityIds.some((cid) => communityIds.includes(cid))),
    [members, communityIds],
  );
  const myMemberIds = useMemo(() => new Set(myMembers.map((m) => m.id)), [myMembers]);
  const myRecords = useMemo(
    () => records.filter((r) => myMemberIds.has(r.memberId)),
    [records, myMemberIds],
  );

  const today = todayISO();
  // Les jours sans événement ne doivent pas être traités comme « tout le
  // monde absent » : on ne calcule absents et taux que s'il y a eu au moins
  // une session aujourd'hui pour cette communauté.
  const hasEventToday = events.some(
    (e) => !e.isContainer && e.date === today && (e.communityId === null || communityIds.includes(e.communityId)),
  );
  const activeMembers = myMembers.filter((m) => m.status === 'Actif');
  const presentTodayIds = new Set(
    myRecords.filter((r) => r.eventDate === today && presentStatuses.includes(r.status)).map((r) => r.memberId),
  );
  const presentToday = presentTodayIds.size;
  const excusedTodayIds = new Set(
    myRecords.filter((r) => r.eventDate === today && r.status === 'Absent en service').map((r) => r.memberId),
  );
  const excusedToday = excusedTodayIds.size;
  const absentToday = hasEventToday
    ? Math.max(0, activeMembers.length - presentToday - excusedToday)
    : 0;
  const attendanceRate =
    hasEventToday && activeMembers.length - excusedToday > 0
      ? Math.round((presentToday / (activeMembers.length - excusedToday)) * 100)
      : 0;

  const newMembers = myMembers.slice(0, 5);
  const upcomingEvents = events
    .filter((e) => !e.isContainer && (e.communityId === null || communityIds.includes(e.communityId)) && eventStatus(e) === 'À venir')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const byDay = useMemo<NameValue[]>(() => {
    const result: NameValue[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = localISO(d);
      result.push({
        name: dayLabel(iso),
        value: myRecords.filter((r) => r.eventDate === iso && presentStatuses.includes(r.status)).length,
      });
    }
    return result;
  }, [myRecords]);

  const byWeek = useMemo<NameValue[]>(() => {
    const result: NameValue[] = [];
    const now = new Date();
    const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
    for (let i = 7; i >= 0; i -= 1) {
      const start = new Date(now);
      start.setDate(start.getDate() + mondayOffset - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startIso = localISO(start);
      const endIso = localISO(end);
      result.push({
        name: dayLabel(startIso),
        value: myRecords.filter((r) => r.eventDate >= startIso && r.eventDate <= endIso && presentStatuses.includes(r.status)).length,
      });
    }
    return result;
  }, [myRecords]);

  const byMonth = useMemo<NameValue[]>(() => {
    const map = new Map<string, number>();
    myRecords.forEach((r) => {
      if (!r.eventDate) return;
      if (!presentStatuses.includes(r.status)) return;
      const key = r.eventDate.slice(0, 7);
      map.set(key, (map.get(key) || 0) + 1);
    });
    const result: NameValue[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        name: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        value: map.get(key) || 0,
      });
    }
    return result;
  }, [myRecords]);

  const chartData = period === 'day' ? byDay : period === 'week' ? byWeek : byMonth;
  const chartTitle =
    period === 'day' ? 'Présences (7 derniers jours)' : period === 'week' ? 'Présences (8 semaines)' : 'Présences (12 mois)';

  return (
    <div className="space-y-6 animate-fade-up md:space-y-8">
      <DashboardHeader
        greeting={communityName}
        subtitle={`Bienvenue, ${user?.name ?? 'Responsable'} — voici l'activité de votre communauté.`}
        primaryAction={{ label: 'Contacter mes membres', to: '/whatsapp', icon: 'ri-whatsapp-line' }}
        secondaryAction={{ label: 'Historique', to: '/attendances', icon: 'ri-history-line' }}
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        <StatCard title="Membres au total" value={myMembers.length} icon="ri-team-line" color="primary" />
        <StatCard title="Présents aujourd'hui" value={presentToday} icon="ri-user-follow-line" color="accent" />
        <StatCard title="Absents aujourd'hui" value={hasEventToday ? absentToday : '—'} subtitle={hasEventToday ? `${excusedToday} en service` : 'Aucun événement aujourd’hui'} icon="ri-user-unfollow-line" color="secondary" />
        <StatCard title="Taux de présence" value={hasEventToday ? `${attendanceRate}%` : '—'} subtitle={hasEventToday ? undefined : 'Aucun événement aujourd’hui'} icon="ri-line-chart-line" color="primary" />
      </div>

      <div className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-line-chart-line text-base leading-none"></i>
            </span>
            <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground-900">{chartTitle}</h3>
          </div>
          <div className="flex items-center rounded-full bg-background-100 p-1">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-background-50 text-foreground-900'
                    : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid oklch(var(--background-300))',
                  background: 'oklch(var(--background-50))',
                  boxShadow: 'none',
                  fontSize: 12,
                  padding: '8px 10px',
                }}
                cursor={{ fill: 'oklch(var(--background-100))' }}
              />
              <Bar dataKey="value" name="Présences" fill={primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                <i className="ri-user-add-line text-base leading-none"></i>
              </span>
              <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground-900">Nouveaux membres</h3>
            </div>
            <Link to="/members" className="text-xs font-semibold text-primary-600 hover:text-primary-700">Voir tout</Link>
          </div>
          {newMembers.length === 0 ? (
            <p className="mt-6 text-center text-sm text-foreground-400">Aucun membre pour le moment.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {newMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-sm font-bold text-foreground-600">
                    {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="truncate text-xs text-foreground-500">{member.number}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <i className="ri-calendar-2-line text-base leading-none"></i>
              </span>
              <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground-900">Événements à venir</h3>
            </div>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="mt-6 text-center text-sm text-foreground-400">Aucun événement à venir.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-lg border border-background-100 bg-background-50 p-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                    <span className="text-sm font-bold leading-none">{event.date.slice(8, 10)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-900">{event.title}</p>
                    <p className="truncate text-xs text-foreground-500">{formatDateFr(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-history-line text-base leading-none"></i>
              </span>
              <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground-900">Dernières présences</h3>
            </div>
            <Link to="/attendances" className="text-xs font-semibold text-primary-600 hover:text-primary-700">Historique</Link>
          </div>
          {myRecords.length === 0 ? (
            <p className="mt-6 text-center text-sm text-foreground-400">Aucune présence enregistrée.</p>
          ) : (
            <div className="mt-4 divide-y divide-background-100">
              {myRecords.filter((r) => presentStatuses.includes(r.status)).slice(0, 6).map((record) => (
                <div key={record.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-100 text-sm font-bold text-foreground-600">
                    {record.memberName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground-900">{record.memberName}</p>
                    <p className="truncate text-xs text-foreground-500">{record.eventTitle}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-400">
                    {dayLabel(record.eventDate)} · {record.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}