import { Suspense, useMemo } from 'react';
import { lazyWithRetry } from '@/lib/chunkRecovery';
import { useAuth } from '@/hooks/useAuth';
import { useMembers } from '@/hooks/useMembers';
import { useCommunities } from '@/hooks/useCommunities';
import { useEvents } from '@/hooks/useEvents';
import { useAttendances } from '@/hooks/useAttendances';
import { useActivity } from '@/hooks/useActivity';
import { eventStatus } from '@/lib/types';
import { presentStatuses } from '@/lib/constants';
import { formatDateFr } from '@/utils/date';
import StatCard from './StatCard';
import PanelCard from './PanelCard';
import SectionTitle from './SectionTitle';
import DashboardHeader from './DashboardHeader';
import type { NameValue } from './ChartsSection';
import type { ActivityAction } from '@/lib/types';

/** Graphiques chargés à la demande : le tableau de bord s'affiche sans attendre. */
const ChartsPanel = lazyWithRetry(() => import('./ChartsPanel'));

function ChartsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-background-100"></div>
            <div className="h-3.5 w-32 animate-pulse rounded bg-background-100"></div>
          </div>
          <div className="mt-5 h-64 animate-pulse rounded-lg bg-background-100/60 md:h-72"></div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-background-100/50 px-4 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-400">
        <i className={`${icon} text-base leading-none`}></i>
      </span>
      <p className="mt-2.5 text-[12px] leading-snug text-foreground-400">{text}</p>
    </div>
  );
}

const actionIcon: Record<ActivityAction, { icon: string; color: string }> = {
  pointage: { icon: 'ri-qr-scan-2-line', color: 'bg-primary-100 text-primary-700' },
  ajout: { icon: 'ri-user-add-line', color: 'bg-accent-100 text-accent-800' },
  modification: { icon: 'ri-edit-line', color: 'bg-secondary-100 text-secondary-700' },
  suppression: { icon: 'ri-delete-bin-line', color: 'bg-accent-100 text-accent-800' },
  connexion: { icon: 'ri-login-box-line', color: 'bg-primary-100 text-primary-700' },
  déconnexion: { icon: 'ri-logout-box-r-line', color: 'bg-background-100 text-foreground-600' },
  export: { icon: 'ri-file-download-line', color: 'bg-secondary-100 text-secondary-700' },
  refus: { icon: 'ri-close-circle-line', color: 'bg-accent-100 text-accent-800' },
};

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function monthAbbr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

function ageBucket(age: number): string {
  if (age <= 12) return '0-12 ans';
  if (age <= 17) return '13-17 ans';
  if (age <= 25) return '18-25 ans';
  if (age <= 35) return '26-35 ans';
  if (age <= 50) return '36-50 ans';
  return '51 ans et +';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { members } = useMembers();
  const { communities } = useCommunities();
  const { events } = useEvents();
  const { records } = useAttendances();
  const { logs } = useActivity();

  const today = todayISO();
  const todayEvents = events.filter((e) => !e.isContainer && e.date === today);
  // Compte des PERSONNES présentes aujourd'hui (et non des pointages) :
  // un membre présent au culte du matin et du soir ne compte qu'une fois.
  const presentToday = new Set(
    records
      .filter((r) => r.eventDate === today && presentStatuses.includes(r.status))
      .map((r) => r.memberId),
  ).size;

  const monthly = useMemo<NameValue[]>(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      if (!r.eventDate) return;
      if (!presentStatuses.includes(r.status)) return;
      const key = r.eventDate.slice(0, 7);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ name: monthShort(month), value: count }));
  }, [records]);

  const byCommunity = useMemo<NameValue[]>(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.community, (map.get(m.community) || 0) + 1));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [members]);

  const byGender = useMemo<NameValue[]>(() => {
    const hommes = members.filter((m) => m.gender?.trim().toLowerCase() === 'homme').length;
    const femmes = members.filter((m) => m.gender?.trim().toLowerCase() === 'femme').length;
    return [
      { name: 'Hommes', value: hommes },
      { name: 'Femmes', value: femmes },
    ];
  }, [members]);

  const byAge = useMemo<NameValue[]>(() => {
    const buckets: Record<string, number> = {};
    members.forEach((m) => {
      const age = ageFrom(m.birthDate);
      if (age === null) return;
      const bucket = ageBucket(age);
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    const order = ['0-12 ans', '13-17 ans', '18-25 ans', '26-35 ans', '36-50 ans', '51 ans et +'];
    return order
      .filter((b) => buckets[b])
      .map((b) => ({ name: b, value: buckets[b] }));
  }, [members]);

  const recentActivity = logs.slice(0, 6);
  const recentMembers = members.slice(0, 5);
  // Liste réellement affichée (sessions uniquement) : le contrôle « vide » doit
  // porter sur cette même liste, sinon un événement-groupe seul à venir
  // affichait une carte vide au lieu du message « Aucun événement à venir ».
  const upcomingEvents = events
    .filter((e) => !e.isContainer && eventStatus(e) === 'À venir')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <div className="space-y-6 animate-fade-up md:space-y-8">
      <DashboardHeader
        greeting={`Bonjour, ${user?.name ?? 'Administrateur'}`}
        subtitle="Voici l'état de votre église aujourd'hui : fréquentation, communautés et activités récentes."
      />

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <StatCard title="Membres au total" value={members.length} icon="ri-team-line" color="primary" />
        <StatCard title="Présents aujourd'hui" value={presentToday} icon="ri-user-follow-line" color="accent" />
        <StatCard title="Événements du jour" value={todayEvents.length} icon="ri-calendar-event-line" color="secondary" />
        <StatCard title="Communautés" value={communities.length} icon="ri-group-line" color="primary" />
      </section>

      <section className="space-y-4">
        <SectionTitle
          kicker="Analyse"
          title="Vue d'ensemble de l'église"
          description="Fréquentation et composition des membres, à partir de vos données réelles."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<ChartsSkeleton />}>
            <ChartsPanel monthly={monthly} byCommunity={byCommunity} byGender={byGender} byAge={byAge} />
          </Suspense>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          kicker="Aujourd'hui"
          title="Le jour en cours et à venir"
          description="Les sessions du jour, les derniers membres enregistrés et les prochains rendez-vous."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PanelCard
            title="Événements du jour"
            icon="ri-calendar-check-line"
            iconClassName="bg-primary-100 text-primary-700"
            badge={
              <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-800">
                {todayEvents.length}
              </span>
            }
          >
            {todayEvents.length === 0 ? (
              <EmptyState icon="ri-calendar-line" text="Aucun événement prévu aujourd'hui." />
            ) : (
              <div className="space-y-2.5">
                {todayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg border border-background-100 bg-background-50 p-2.5 transition-colors hover:border-background-200"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                      <span className="text-[13px] font-extrabold leading-none tabular-nums">
                        {event.startTime ? event.startTime.split(':')[0] : '--'}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium leading-none text-primary-600">
                        {event.startTime ? `:${event.startTime.split(':')[1]}` : ''}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground-900">{event.title}</p>
                      <p className="truncate text-[11px] text-foreground-500">
                        {event.location || event.community}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background-100 px-2 py-1 text-[11px] font-semibold text-foreground-600">
                      <span className="flex h-3 w-3 items-center justify-center">
                        <i className="ri-user-line text-[10px] leading-none"></i>
                      </span>
                      {event.recordCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard
            title="Nouveaux membres"
            icon="ri-user-add-line"
            iconClassName="bg-accent-100 text-accent-800"
            action={{ label: 'Voir tout', to: '/members' }}
          >
            {recentMembers.length === 0 ? (
              <EmptyState icon="ri-user-line" text="Aucun membre pour le moment." />
            ) : (
              <div className="space-y-2.5">
                {recentMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg px-0.5 py-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-100 text-[12px] font-bold text-foreground-600">
                      {member.firstName.charAt(0)}
                      {member.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground-900">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="truncate text-[11px] text-foreground-500">
                        {member.number} · {member.community}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard
            title="Prochains événements"
            icon="ri-calendar-2-line"
            iconClassName="bg-secondary-100 text-secondary-700"
            action={{ label: 'Voir tout', to: '/events' }}
          >
            {upcomingEvents.length === 0 ? (
              <EmptyState icon="ri-calendar-line" text="Aucun événement à venir." />
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg border border-background-100 bg-background-50 p-2.5 transition-colors hover:border-background-200"
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                      <span className="text-[13px] font-extrabold leading-none tabular-nums">
                        {event.date.slice(8, 10)}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium uppercase leading-none">
                        {monthAbbr(event.date)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground-900">{event.title}</p>
                      <p className="truncate text-[11px] text-foreground-500">{formatDateFr(event.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          kicker="Suivi"
          title="Activité récente"
          description="Les dernières actions enregistrées dans l'application."
        />
        <PanelCard title="Dernières actions" icon="ri-history-line" action={{ label: "Tout l'historique", to: '/activity' }}>
          {recentActivity.length === 0 ? (
            <EmptyState icon="ri-history-line" text="Aucune activité enregistrée pour le moment." />
          ) : (
            <div className="divide-y divide-background-100">
              {recentActivity.map((activity) => {
                const meta = actionIcon[activity.action] ?? actionIcon.modification;
                return (
                  <div key={activity.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                      <i className={`${meta.icon} text-[13px] leading-none`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground-700">
                        <span className="font-semibold text-foreground-900">{activity.user}</span>{' '}
                        {activity.details}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-medium text-foreground-500">
                      {activity.time}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>
      </section>
    </div>
  );
}