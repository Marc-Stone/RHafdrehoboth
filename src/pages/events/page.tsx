import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvents } from '@/hooks/useEvents';
import { useCommunities } from '@/hooks/useCommunities';
import type { ChurchEvent, EventInput, EventStatus } from '@/lib/types';
import { eventStatus } from '@/lib/types';
import { formatDateFr, monthShortFr } from '@/utils/date';
import EventFormModal from './components/EventFormModal';
import InheritBaseModal from './components/InheritBaseModal';
import { fetchInheritSummary, inheritSessionBase } from '@/lib/sessionInheritance';
import type { InheritSummary } from '@/lib/sessionInheritance';
import PageHeader from '@/components/base/PageHeader';
import StatTile from '@/components/base/StatTile';
import Portal from '@/components/base/Portal';

const statusStyle: Record<EventStatus, string> = {
  'À venir': 'bg-primary-100 text-primary-700',
  'En cours': 'bg-accent-100 text-accent-700',
  'Terminé': 'bg-background-100 text-foreground-500',
};

const statusDot: Record<EventStatus, string> = {
  'À venir': 'bg-primary-500',
  'En cours': 'bg-accent-500',
  'Terminé': 'bg-foreground-300',
};

function containerStatus(sessions: ChurchEvent[]): EventStatus {
  if (sessions.length === 0) return 'À venir';
  const statuses = sessions.map(eventStatus);
  if (statuses.every((s) => s === 'Terminé')) return 'Terminé';
  if (statuses.some((s) => s === 'En cours')) return 'En cours';
  return 'À venir';
}

export default function EventsPage() {
  const { events, loading, error, fetchEvents, addEvent, updateEvent, deleteEvent } = useEvents();
  const { communities } = useCommunities();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ChurchEvent | null>(null);
  const [editingSessions, setEditingSessions] = useState<ChurchEvent[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ChurchEvent | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reprise des résultats d'une session comme base de la session suivante.
  const [inheritTarget, setInheritTarget] = useState<{ target: ChurchEvent; source: ChurchEvent } | null>(null);
  const [inheritSummary, setInheritSummary] = useState<InheritSummary | null>(null);
  const [inheritLoading, setInheritLoading] = useState(false);
  const [inheritSubmitting, setInheritSubmitting] = useState(false);
  const [inheritError, setInheritError] = useState<string | null>(null);

  const sessionsByParent = useMemo(() => {
    const map = new Map<string, ChurchEvent[]>();
    events.forEach((e) => {
      if (e.parentEventId) {
        if (!map.has(e.parentEventId)) map.set(e.parentEventId, []);
        map.get(e.parentEventId)!.push(e);
      }
    });
    map.forEach((list) => list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
    return map;
  }, [events]);

  const topLevel = useMemo(
    () => events.filter((e) => !e.parentEventId).sort((a, b) => b.date.localeCompare(a.date)),
    [events],
  );

  const isFiltering = search.trim() !== '' || statusFilter !== '';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return topLevel.filter((e) => {
      const sessions = sessionsByParent.get(e.id) ?? [];
      const matchesSearch =
        !term ||
        e.title.toLowerCase().includes(term) ||
        e.location.toLowerCase().includes(term) ||
        sessions.some((s) => s.title.toLowerCase().includes(term));
      if (!matchesSearch) return false;
      if (!statusFilter) return true;
      const status = e.isContainer ? containerStatus(sessions) : eventStatus(e);
      return status === statusFilter;
    });
  }, [topLevel, sessionsByParent, search, statusFilter]);

  // Les compteurs portent sur les événements pointables (sessions + événements simples),
  // et non sur les « conteneurs » qui regroupent plusieurs sessions.
  // Une seule passe suffit : trois filtres successifs sur la liste complète
  // étaient recalculés à chaque rendu.
  const { upcomingCount, ongoingCount, doneCount } = useMemo(() => {
    let upcoming = 0;
    let ongoing = 0;
    let done = 0;
    events.forEach((e) => {
      if (e.isContainer) return;
      const status = eventStatus(e);
      if (status === 'À venir') upcoming += 1;
      else if (status === 'En cours') ongoing += 1;
      else done += 1;
    });
    return { upcomingCount: upcoming, ongoingCount: ongoing, doneCount: done };
  }, [events]);

  const openAdd = () => {
    setEditingEvent(null);
    setEditingSessions([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (event: ChurchEvent) => {
    setEditingEvent(event);
    setEditingSessions(event.isContainer ? sessionsByParent.get(event.id) ?? [] : []);
    setFormError(null);
    setModalOpen(true);
  };

  // La confirmation de suppression se ferme aussi avec la touche Échap.
  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  const handleSave = async (input: EventInput) => {
    setSubmitting(true);
    setFormError(null);
    const res = editingEvent ? await updateEvent(editingEvent.id, input) : await addEvent(input);
    setSubmitting(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    setModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const res = await deleteEvent(deleteTarget);
    setDeleting(false);
    if (res.error) {
      setActionError(res.error);
    }
    setDeleteTarget(null);
  };

  const openInherit = async (target: ChurchEvent, source: ChurchEvent) => {
    setInheritTarget({ target, source });
    setInheritSummary(null);
    setInheritError(null);
    setActionSuccess(null);
    setInheritLoading(true);
    const res = await fetchInheritSummary(source.id, target.id);
    setInheritLoading(false);
    if (res.error) {
      setInheritError(res.error);
      return;
    }
    setInheritSummary(res.summary);
  };

  const closeInherit = () => {
    if (inheritSubmitting) return;
    setInheritTarget(null);
    setInheritSummary(null);
    setInheritError(null);
  };

  const confirmInherit = async () => {
    if (!inheritTarget) return;
    const { target, source } = inheritTarget;
    setInheritSubmitting(true);
    setInheritError(null);
    const res = await inheritSessionBase({
      sourceEventId: source.id,
      sourceTitle: source.title,
      targetEventId: target.id,
      targetTitle: target.title,
      targetDate: target.date,
    });
    setInheritSubmitting(false);
    if (res.error) {
      setInheritError(res.error);
      return;
    }
    await fetchEvents();
    setActionSuccess(
      res.added > 0
        ? `${res.added} membre(s) repris de « ${source.title} » vers « ${target.title} ». Chaque session garde ses propres horaires.`
        : `Aucun nouveau membre à reprendre : « ${target.title} » contient déjà toute la base.`,
    );
    setInheritTarget(null);
    setInheritSummary(null);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Planification"
        icon="ri-calendar-event-line"
        title="Événements"
        description="Planifiez les sessions de culte, réunions et activités de l'église."
        actions={
          <button
            onClick={openAdd}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Nouvel événement
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="À venir" value={upcomingCount} icon="ri-calendar-check-line" tone="primary" />
        <StatTile label="En cours" value={ongoingCount} icon="ri-time-line" tone="accent" />
        <StatTile label="Terminés" value={doneCount} icon="ri-history-line" tone="secondary" />
      </div>

      {actionSuccess && (
        <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-100/60 p-3 text-sm text-primary-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <i className="ri-checkbox-circle-line"></i>
          </span>
          <p className="flex-1">{actionSuccess}</p>
          <button
            onClick={() => setActionSuccess(null)}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-primary-700 hover:bg-primary-200/60"
            title="Fermer"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <i className="ri-error-warning-line"></i>
          </span>
          <p className="flex-1">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-accent-700 hover:bg-accent-200/60"
            title="Fermer"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {events.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un événement ou un lieu..."
              className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrer par statut"
            className="cursor-pointer rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="">Tous les statuts</option>
            <option value="À venir">À venir</option>
            <option value="En cours">En cours</option>
            <option value="Terminé">Terminé</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 p-12 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Chargement des événements...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-background-200 bg-background-50 p-12 text-center">
          <p className="text-sm text-foreground-600">{error}</p>
          <button
            onClick={fetchEvents}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Réessayer
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
            <i className="ri-calendar-event-line text-3xl"></i>
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucun événement</h2>
          <p className="mt-2 max-w-sm text-sm text-foreground-500">
            Planifiez votre premier culte ou événement pour commencer à pointer les présences.
          </p>
          <button
            onClick={openAdd}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-add-line"></i>
            Créer un événement
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-400">
            <i className={isFiltering ? 'ri-search-line text-xl' : 'ri-calendar-event-line text-xl'}></i>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground-800">
            {isFiltering ? 'Aucun événement ne correspond à votre recherche' : 'Aucun événement à afficher'}
          </p>
          <p className="mt-1 text-xs text-foreground-500">
            {isFiltering
              ? 'Essayez un autre mot-clé ou affichez à nouveau tous les événements.'
              : 'Créez un événement pour commencer à pointer les présences.'}
          </p>
          {isFiltering ? (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-filter-off-line"></i>
              Réinitialiser les filtres
            </button>
          ) : (
            <button
              onClick={openAdd}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
            >
              <i className="ri-add-line"></i>
              Créer un événement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const isContainer = event.isContainer;
            const sessions = sessionsByParent.get(event.id) ?? [];
            const containerState = isContainer ? containerStatus(sessions) : null;

            if (isContainer) {
              return (
                <div key={event.id} className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-background-100">
                      <span className="text-xl font-bold leading-none text-foreground-900">
                        {event.date ? event.date.slice(8, 10) : '--'}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium uppercase text-foreground-500">
                        {monthShortFr(event.date)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-base font-semibold text-foreground-900">{event.title}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-semibold text-secondary-700">
                          <i className="ri-stack-line"></i>
                          {sessions.length} session{sessions.length === 1 ? '' : 's'}
                        </span>
                        {containerState && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[containerState]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot[containerState]}`}></span>
                            {containerState}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-500">
                        <span className="flex items-center gap-1.5">
                          <i className="ri-calendar-line text-foreground-400"></i>
                          {formatDateFr(event.date)}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1.5">
                            <i className="ri-map-pin-line text-foreground-400"></i>
                            {event.location}
                          </span>
                        )}
                      </div>
                      {event.community !== "Toute l'église" && (
                        <p className="mt-1.5 text-xs text-foreground-500">
                          <i className="ri-group-line mr-1 text-foreground-400"></i>
                          {event.community}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => openEdit(event)}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                        title="Modifier"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(event)}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-accent-100 hover:text-accent-700"
                        title="Supprimer"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-background-200 bg-background-100/40 px-5 py-3">
                    {sessions.map((s, sIndex) => {
                      const sStatus = eventStatus(s);
                      // Session immédiatement précédente (ordre chronologique des
                      // horaires) : c'est sa base qui peut être reprise.
                      const previousSession = sIndex > 0 ? sessions[sIndex - 1] : null;
                      // Une session sans communauté propre hérite de celle de
                      // l'événement : afficher « Toute l'église » était faux.
                      const sessionCommunity = s.communityId ? s.community : event.community;
                      return (
                        <div
                          key={s.id}
                          className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 sm:flex-row sm:items-center"
                        >
                          <span className="hidden h-5 w-5 shrink-0 items-center justify-center text-foreground-300 sm:flex">
                            <i className="ri-subtract-line"></i>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-heading text-sm font-semibold text-foreground-800">{s.title}</h4>
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[sStatus]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${statusDot[sStatus]}`}></span>
                                {sStatus}
                              </span>
                            </div>
                            {s.startTime && (
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-500">
                                <span className="flex items-center gap-1.5">
                                  <i className="ri-time-line text-foreground-400"></i>
                                  {s.startTime}
                                  {s.endTime && ` – ${s.endTime}`}
                                </span>
                              </div>
                            )}
                            {sessionCommunity !== "Toute l'église" && (
                              <p className="mt-1 text-xs text-foreground-500">
                                <i className="ri-group-line mr-1 text-foreground-400"></i>
                                {sessionCommunity}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {s.totalCount > 0 && (
                              <>
                                <span className="flex items-center gap-1.5 rounded-lg bg-primary-100/70 px-2.5 py-1.5 text-xs font-medium text-primary-700">
                                  <i className="ri-user-follow-line"></i>
                                  {s.recordCount} présent{s.recordCount === 1 ? '' : 's'}
                                </span>
                                {s.absentCount > 0 && (
                                  <span className="flex items-center gap-1.5 rounded-lg bg-background-100 px-2.5 py-1.5 text-xs font-medium text-foreground-600">
                                    <i className="ri-user-unfollow-line"></i>
                                    {s.absentCount} absent{s.absentCount === 1 ? '' : 's'}
                                  </span>
                                )}
                              </>
                            )}
                            {sStatus === 'En cours' && (
                              <Link
                                to={`/scanner?event=${s.id}`}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-accent-600"
                              >
                                <i className="ri-qr-scan-2-line"></i>
                                Pointer
                              </Link>
                            )}
                            {previousSession && (
                              <button
                                onClick={() => void openInherit(s, previousSession)}
                                disabled={Boolean(s.closedAt)}
                                title={
                                  s.closedAt
                                    ? 'Session clôturée : sa base ne peut plus être complétée'
                                    : `Reprendre les résultats de « ${previousSession.title} »`
                                }
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-secondary-200 px-3 py-2 text-xs font-semibold text-secondary-700 hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <i className="ri-arrow-down-double-line"></i>
                                Reprendre
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {sessions.length === 0 && (
                      <p className="py-3 text-center text-xs text-foreground-400">Aucune session.</p>
                    )}
                  </div>
                </div>
              );
            }

            const status = eventStatus(event);
            return (
              <div
                key={event.id}
                className="flex flex-col gap-4 rounded-lg border border-background-200 bg-background-50 p-5 transition-colors hover:border-background-300 sm:flex-row sm:items-center"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-background-100">
                  <span className="text-xl font-bold leading-none text-foreground-900">
                    {event.date ? event.date.slice(8, 10) : '--'}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium uppercase text-foreground-500">
                    {monthShortFr(event.date)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-base font-semibold text-foreground-900">{event.title}</h3>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[status]}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`}></span>
                      {status}
                      {event.closedAt && <i className="ri-lock-line"></i>}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-500">
                    <span className="flex items-center gap-1.5">
                      <i className="ri-calendar-line text-foreground-400"></i>
                      {formatDateFr(event.date)}
                    </span>
                    {event.startTime && (
                      <span className="flex items-center gap-1.5">
                        <i className="ri-time-line text-foreground-400"></i>
                        {event.startTime}
                        {event.endTime && ` – ${event.endTime}`}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1.5">
                        <i className="ri-map-pin-line text-foreground-400"></i>
                        {event.location}
                      </span>
                    )}
                  </div>
                  {event.community !== "Toute l'église" && (
                    <p className="mt-1.5 text-xs text-foreground-500">
                      <i className="ri-group-line mr-1 text-foreground-400"></i>
                      {event.community}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {status !== 'À venir' && (
                    <span className="flex items-center gap-1.5 rounded-lg bg-background-100 px-3 py-1.5 text-xs font-medium text-foreground-600">
                      <i className="ri-user-follow-line"></i>
                      {event.recordCount} présent{event.recordCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {status === 'En cours' && (
                    <Link
                      to={`/scanner?event=${event.id}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-accent-600"
                    >
                      <i className="ri-qr-scan-2-line"></i>
                      Pointer
                    </Link>
                  )}
                  <button
                    onClick={() => openEdit(event)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                    title="Modifier"
                  >
                    <i className="ri-edit-line"></i>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(event)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-accent-100 hover:text-accent-700"
                    title="Supprimer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EventFormModal
        open={modalOpen}
        editingEvent={editingEvent}
        editingSessions={editingSessions}
        communities={communities}
        submitting={submitting}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <InheritBaseModal
        target={inheritTarget?.target ?? null}
        source={inheritTarget?.source ?? null}
        summary={inheritSummary}
        loading={inheritLoading}
        submitting={inheritSubmitting}
        error={inheritError}
        onClose={closeInherit}
        onConfirm={() => void confirmInherit()}
      />

      {deleteTarget && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la suppression de l'événement"
        >
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDeleteTarget(null)}></div>
          <div className="relative w-full max-w-sm rounded-lg border border-background-200 bg-background-50 p-6 animate-fade-up">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-alert-line text-2xl"></i>
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground-950">Supprimer cet événement ?</h3>
            <p className="mt-2 text-sm text-foreground-500">
              Vous êtes sur le point de supprimer <strong className="text-foreground-800">{deleteTarget.title}</strong>
              {deleteTarget.isContainer ? ' ainsi que toutes ses sessions.' : '.'}{' '}
              L'événement pourra être restauré ultérieurement (suppression logique).
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-accent-600 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Suppression...
                  </>
                ) : (
                  'Supprimer'
                )}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}