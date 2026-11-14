import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMembers } from '@/hooks/useMembers';
import { useEvents } from '@/hooks/useEvents';
import { useAttendances } from '@/hooks/useAttendances';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceRecord, Member } from '@/lib/types';
import { eventStatus, isEventPastEnd } from '@/lib/types';
import { formatDateFr } from '@/utils/date';
import { presentStatuses, attendanceStatusStyle } from '@/lib/constants';
import ScannerView from './components/ScannerView';
import LazyImage from '@/components/base/LazyImage';
import Portal from '@/components/base/Portal';
import PageHeader from '@/components/base/PageHeader';
import StatTile from '@/components/base/StatTile';

type ScanFeedback = { type: 'ok' | 'duplicate' | 'unknown' | 'wrong_community' | 'closed' | 'not_started' | 'error' | 'service' | 'inactive' | 'forbidden' | 'notice'; name: string; community?: string } | null;

const statusOrder: Record<string, number> = { 'En cours': 0, 'À venir': 1, 'Terminé': 2 };

export default function ScannerPage() {
  const { members, loading: membersLoading, error: membersError, fetchMembers } = useMembers();
  const { events, loading: eventsLoading, error: eventsError, fetchEvents } = useEvents();
  const { records, checkIn, markAbsentInService, promoteRecord, removeRecord, closeEvent } = useAttendances();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedEventId = searchParams.get('event');
  const appliedRequestRef = useRef<string | null>(null);
  const isAgent = user?.role === 'attendance_agent';
  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [search, setSearch] = useState('');
  // Le filtrage des membres est différé pour que la saisie reste fluide.
  const deferredSearch = useDeferredValue(search);
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Confirmation avant d'annuler un pointage : un simple clic sur la croix
  // supprimait définitivement la ligne, sans filet de sécurité.
  const [removeTarget, setRemoveTarget] = useState<AttendanceRecord | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const selectableEvents = useMemo(
    () =>
      events
        .filter((e) => !e.isContainer)
        .sort(
          (a, b) => statusOrder[eventStatus(a)] - statusOrder[eventStatus(b)] || b.date.localeCompare(a.date),
        ),
    [events],
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Sélectionner automatiquement le premier événement pertinent quand les
  // événements se chargent, sans écraser un choix manuel de l'utilisateur.
  useEffect(() => {
    if (selectableEvents.length === 0) return;
    // Lien « Pointer » depuis la page Événements : on ouvre l'événement
    // demandé, et non le premier événement « En cours » trouvé.
    if (requestedEventId && selectableEvents.some((e) => e.id === requestedEventId)) {
      if (appliedRequestRef.current !== requestedEventId) {
        appliedRequestRef.current = requestedEventId;
        setSelectedEventId(requestedEventId);
      }
      return;
    }
    const isCurrentValid = selectedEventId !== null && selectableEvents.some((e) => e.id === selectedEventId);
    if (isCurrentValid) return;
    const ongoing = selectableEvents.find((e) => eventStatus(e) === 'En cours');
    const next = ongoing ?? selectableEvents[0] ?? null;
    setSelectedEventId(next?.id ?? null);
  // selectedEventId intentionnellement omis : on veut uniquement réagir
  // au changement de liste d'événements.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableEvents, requestedEventId]);

  const selectedEvent = selectableEvents.find((e) => e.id === selectedEventId) ?? null;

  // Deux états distincts à ne pas confondre :
  // - `pointageLocked` : plus aucun pointage possible (déjà clôturé OU heure de
  //   fin dépassée en attente de clôture) ;
  // - `isActuallyClosed` : l'événement a réellement été clôturé (closed_at), et
  //   c'est UNIQUEMENT dans ce cas que le bouton doit être verrouillé. Sinon,
  //   un événement dont l'heure de fin vient de passer restait bloqué avant que
  //   la clôture automatique n'ait enregistré les absents.
  const isActuallyClosed = selectedEvent ? Boolean(selectedEvent.closedAt) : false;
  const isPastEnd = selectedEvent ? isEventPastEnd(selectedEvent) : false;
  const pointageLocked = isActuallyClosed || isPastEnd;

  // Communauté effective de l'événement : une session sans communauté propre
  // hérite de celle de son événement parent (conteneur). Cela évite qu'une
  // session rattachée à une communauté prenne encore tous les membres.
  const selectedEventCommunityId = useMemo(() => {
    if (!selectedEvent) return null;
    if (selectedEvent.communityId) return selectedEvent.communityId;
    if (selectedEvent.parentEventId) {
      const parent = events.find((e) => e.id === selectedEvent.parentEventId);
      return parent?.communityId ?? null;
    }
    return null;
  }, [selectedEvent, events]);

  // Membres éligibles au pointage pour l'événement sélectionné :
  // tous si événement global, sinon uniquement ceux de sa communauté.
  const scopedMembers = useMemo(
    () => (selectedEventCommunityId ? members.filter((m) => m.communityIds.includes(selectedEventCommunityId)) : members),
    [members, selectedEventCommunityId],
  );

  // Seuls les membres ACTIFS sont attendus et pointables. Pointer un membre
  // inactif/suspendu faisait monter le numérateur sans le dénominateur → un
  // taux de présence pouvant dépasser 100 %.
  const eligibleMembers = useMemo(
    () => scopedMembers.filter((m) => m.status === 'Actif'),
    [scopedMembers],
  );

  const eventRecords = useMemo(
    () => (selectedEvent ? records.filter((r) => r.eventId === selectedEvent.id) : []),
    [records, selectedEvent],
  );


  // Statut réel de chaque membre déjà enregistré pour cet événement. Après une
  // clôture, TOUS les membres ont une ligne (souvent « Absent ») : afficher
  // « Pointé » pour tout le monde dans la liste manuelle était faux.
  const recordStatusById = useMemo(() => {
    const map = new Map<string, string>();
    eventRecords.forEach((r) => map.set(r.memberId, r.status));
    return map;
  }, [eventRecords]);

  const presentCount = eventRecords.filter((r) => presentStatuses.includes(r.status)).length;
  const totalMembers = eligibleMembers.length;
  const rate = totalMembers > 0 ? Math.min(100, Math.round((presentCount / totalMembers) * 100)) : 0;

  // Nettoyage du timer de feedback au démontage (évite un setState après
  // démontage quand l'utilisateur change de page juste après un scan).
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  // Le message de clôture concerne l'événement affiché : il ne doit pas rester
  // affiché quand on bascule sur un autre événement.
  useEffect(() => {
    setCloseMsg(null);
  }, [selectedEventId]);

  const showFeedback = (fb: ScanFeedback) => {
    // Un nouveau retour (pointage, erreur) rend obsolète le message de clôture
    // précédent, qui restait affiché au-dessus du fil de pointage.
    setCloseMsg(null);
    setFeedback(fb);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  };

  const handleScan = async (value: string) => {
    if (!selectedEvent) return;
    if (pointageLocked) {
      showFeedback({ type: 'closed', name: selectedEvent.title });
      return;
    }
    const scanned = value.trim();
    // Un scan vide (QR illisible, lecteur qui renvoie une chaîne vide) ne doit
    // jamais retomber sur un membre dont le numéro est vide.
    if (!scanned) return;
    // Comparaison insensible à la casse : un QR encodé « mc-001 » ne trouvait
    // pas le membre enregistré « MC-001 ».
    const member = members.find(
      (m) => m.number.trim().toLowerCase() === scanned.toLowerCase(),
    );
    if (!member) {
      showFeedback({ type: 'unknown', name: scanned });
      return;
    }
    if (member.status !== 'Actif') {
      showFeedback({ type: 'inactive', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (selectedEventCommunityId && !member.communityIds.includes(selectedEventCommunityId)) {
      showFeedback({ type: 'wrong_community', name: `${member.firstName} ${member.lastName}`, community: member.community });
      return;
    }
    // Membre déjà présent dans la base (résultat repris de la session
    // précédente, ou absence clôturée) : un simple scan ne peut pas créer une
    // seconde ligne, on transforme la ligne existante en pointage réel.
    const existing = eventRecords.find((r) => r.memberId === member.id);
    if (existing && !presentStatuses.includes(existing.status)) {
      const promoted = await promoteRecord(existing.id, selectedEvent.id, 'QR');
      if (promoted === 'closed') {
        showFeedback({ type: 'closed', name: selectedEvent.title });
      } else if (promoted === 'not_started') {
        showFeedback({ type: 'not_started', name: selectedEvent.title });
      } else if (promoted === 'forbidden') {
        showFeedback({ type: 'forbidden', name: `${member.firstName} ${member.lastName}` });
      } else if (promoted === 'ok') {
        showFeedback({ type: 'ok', name: `${member.firstName} ${member.lastName}` });
      } else {
        showFeedback({ type: 'error', name: `${member.firstName} ${member.lastName}` });
      }
      return;
    }
    const result = await checkIn(selectedEvent.id, member, 'QR');
    if (result === 'error') {
      showFeedback({ type: 'error', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (result === 'closed') {
      showFeedback({ type: 'closed', name: selectedEvent.title });
      return;
    }
    if (result === 'not_started') {
      showFeedback({ type: 'not_started', name: selectedEvent.title });
      return;
    }
    if (result === 'wrong_community') {
      showFeedback({ type: 'wrong_community', name: `${member.firstName} ${member.lastName}`, community: member.community });
      return;
    }
    if (result === 'inactive') {
      showFeedback({ type: 'inactive', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    showFeedback({
      type: result === 'ok' ? 'ok' : 'duplicate',
      name: `${member.firstName} ${member.lastName}`,
    });
  };

  const handleManual = async (member: Member) => {
    if (!selectedEvent) return;
    if (pointageLocked) {
      showFeedback({ type: 'closed', name: selectedEvent.title });
      return;
    }
    if (member.status !== 'Actif') {
      showFeedback({ type: 'inactive', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (selectedEventCommunityId && !member.communityIds.includes(selectedEventCommunityId)) {
      showFeedback({ type: 'wrong_community', name: `${member.firstName} ${member.lastName}`, community: member.community });
      return;
    }
    const existing = eventRecords.find((r) => r.memberId === member.id);
    if (existing && !presentStatuses.includes(existing.status)) {
      const promoted = await promoteRecord(existing.id, selectedEvent.id, 'Manuel');
      if (promoted === 'closed') {
        showFeedback({ type: 'closed', name: selectedEvent.title });
      } else if (promoted === 'not_started') {
        showFeedback({ type: 'not_started', name: selectedEvent.title });
      } else if (promoted === 'forbidden') {
        showFeedback({ type: 'forbidden', name: `${member.firstName} ${member.lastName}` });
      } else if (promoted === 'ok') {
        showFeedback({ type: 'ok', name: `${member.firstName} ${member.lastName}` });
      } else {
        showFeedback({ type: 'error', name: `${member.firstName} ${member.lastName}` });
      }
      return;
    }
    const result = await checkIn(selectedEvent.id, member, 'Manuel');
    if (result === 'wrong_community') {
      showFeedback({ type: 'wrong_community', name: `${member.firstName} ${member.lastName}`, community: member.community });
      return;
    }
    if (result === 'error') {
      showFeedback({ type: 'error', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (result === 'closed') {
      showFeedback({ type: 'closed', name: selectedEvent.title });
      return;
    }
    if (result === 'not_started') {
      showFeedback({ type: 'not_started', name: selectedEvent.title });
      return;
    }
    if (result === 'inactive') {
      showFeedback({ type: 'inactive', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    showFeedback({
      type: result === 'ok' ? 'ok' : 'duplicate',
      name: `${member.firstName} ${member.lastName}`,
    });
  };

  const handleMarkAbsent = async (member: Member) => {
    if (!selectedEvent) return;
    if (pointageLocked) {
      showFeedback({ type: 'closed', name: selectedEvent.title });
      return;
    }
    if (member.status !== 'Actif') {
      showFeedback({ type: 'inactive', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (selectedEventCommunityId && !member.communityIds.includes(selectedEventCommunityId)) {
      showFeedback({ type: 'wrong_community', name: `${member.firstName} ${member.lastName}`, community: member.community });
      return;
    }
    const result = await markAbsentInService(selectedEvent.id, member);
    if (result === 'wrong_community') {
      showFeedback({ type: 'wrong_community', name: `${member.firstName} ${member.lastName}`, community: member.community });
      return;
    }
    if (result === 'error') {
      showFeedback({ type: 'error', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (result === 'closed') {
      showFeedback({ type: 'closed', name: selectedEvent.title });
      return;
    }
    if (result === 'duplicate') {
      showFeedback({ type: 'duplicate', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    if (result === 'inactive') {
      showFeedback({ type: 'inactive', name: `${member.firstName} ${member.lastName}` });
      return;
    }
    showFeedback({ type: 'service', name: `${member.firstName} ${member.lastName}` });
  };

  const requestRemove = (record: AttendanceRecord) => {
    if (pointageLocked) return;
    setRemoveError(null);
    setRemoveTarget(record);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    const res = await removeRecord(removeTarget.id);
    setRemoving(false);
    // L'échec de suppression était totalement silencieux.
    if (res?.error) {
      setRemoveError(res.error);
      return;
    }
    setRemoveTarget(null);
  };

  const handleCloseEvent = async () => {
    if (!selectedEvent) return;
    setClosing(true);
    const res = await closeEvent(selectedEvent.id);
    setClosing(false);
    setCloseMsg(
      res.error
        ? { ok: false, text: res.error }
        : { ok: true, text: `Événement clôturé : ${res.markedAbsent} membre(s) marqué(s) absent(s).` },
    );
  };

  // Résultats de la saisie manuelle : on expose aussi le nombre total de
  // correspondances, sinon on croyait qu'un membre n'existait pas alors qu'il
  // était simplement au-delà des 8 premiers résultats.
  const manualMatches = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) {
      const sorted = [...eligibleMembers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'),
      );
      return { items: sorted.slice(0, 8), total: sorted.length };
    }
    const matched = eligibleMembers.filter(
      (m) =>
        m.firstName.toLowerCase().includes(term) ||
        m.lastName.toLowerCase().includes(term) ||
        m.number.toLowerCase().includes(term),
    );
    return { items: matched.slice(0, 8), total: matched.length };
  }, [eligibleMembers, deferredSearch]);

  const manualResults = manualMatches.items;

  // Fermeture de la confirmation au clavier, comme sur les autres pages.
  useEffect(() => {
    if (!removeTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !removing) {
        setRemoveTarget(null);
        setRemoveError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeTarget, removing]);

  // --- États de chargement / erreur : ne jamais afficher « Aucun événement »
  // alors que les données sont encore en train d'arriver, ni masquer une erreur
  // de chargement derrière un faux « rien à afficher ».
  if (eventsLoading || membersLoading) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-24">
          <div className="flex flex-col items-center gap-3 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
            <p className="text-sm">Chargement des données de pointage…</p>
          </div>
        </div>
      </div>
    );
  }

  if (eventsError || membersError) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="rounded-lg border border-accent-200 bg-accent-100/50 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-error-warning-line text-3xl"></i>
          </div>
          <h1 className="mt-4 font-heading text-xl font-bold text-foreground-950">Impossible de charger le scanner</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground-600">
            {eventsError || membersError}
          </p>
          <button
            onClick={() => {
              fetchEvents();
              fetchMembers();
            }}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="rounded-lg border border-background-200 bg-background-50 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-calendar-event-line text-3xl"></i>
          </div>
          <h1 className="mt-4 font-heading text-xl font-bold text-foreground-950">Aucun événement</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground-500">
            Créez d'abord un événement pour pouvoir scanner les présences.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-add-line"></i>
            Créer un événement
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Pointage"
        icon="ri-qr-scan-2-line"
        title="Scanner QR & Pointage"
        description="Scannez ou recherchez les membres pour pointer leur présence."
        tone="accent"
      />

      <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-calendar-check-line text-xl"></i>
            </div>
            <div className="min-w-0 w-full sm:w-auto">
              <label htmlFor="scanner-event" className="block text-xs font-medium text-foreground-400">
                Événement ciblé
              </label>
              <select
                id="scanner-event"
                value={selectedEvent.id}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-background-200 bg-background-50 px-2 py-1.5 text-sm font-semibold text-foreground-900 focus:border-primary-400 focus:outline-none sm:w-auto sm:max-w-[300px]"
              >
                {selectableEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.parentTitle ? `${e.parentTitle} — ${e.title}` : e.title} · {formatDateFr(e.date)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-500">
            <span className="flex items-center gap-1.5">
              <i className="ri-calendar-line text-foreground-400"></i>
              {formatDateFr(selectedEvent.date)}
            </span>
            {selectedEvent.startTime && (
              <span className="flex items-center gap-1.5">
                <i className="ri-time-line text-foreground-400"></i>
                {selectedEvent.startTime}
                {selectedEvent.endTime && ` – ${selectedEvent.endTime}`}
              </span>
            )}
            {selectedEvent.location && (
              <span className="flex items-center gap-1.5">
                <i className="ri-map-pin-line text-foreground-400"></i>
                {selectedEvent.location}
              </span>
            )}
          </div>
        </div>
        {!isAgent && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCloseEvent}
              disabled={closing || isActuallyClosed}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                isPastEnd && !isActuallyClosed
                  ? 'border-primary-300 bg-primary-100/70 text-primary-800 hover:bg-primary-100'
                  : 'border-accent-200 text-accent-700 hover:bg-accent-100/60'
              }`}
            >
              <i className={closing ? 'ri-loader-4-line animate-spin' : isActuallyClosed ? 'ri-lock-line' : 'ri-flag-2-line'}></i>
              {closing
                ? 'Clôture...'
                : isActuallyClosed
                  ? 'Clôturé'
                  : isPastEnd
                    ? 'Finaliser la clôture'
                    : "Clôturer l'événement"}
            </button>
            <Link
              to="/events"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-200 px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-settings-3-line"></i>
              Gérer les événements
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Présents" value={presentCount} icon="ri-user-follow-line" tone="primary" />
        <StatTile label="Membres attendus" value={totalMembers} icon="ri-team-line" tone="secondary" />
        <StatTile label="Taux de présence" value={`${rate}%`} icon="ri-percent-line" tone="accent" />
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-primary-200 bg-primary-100/70 text-primary-800'
              : feedback.type === 'duplicate' || feedback.type === 'service'
                ? 'border-secondary-200 bg-secondary-100/70 text-secondary-800'
                : feedback.type === 'notice'
                  ? 'border-background-300 bg-background-100 text-foreground-700'
                  : 'border-accent-200 bg-accent-100/70 text-accent-800'
          }`}
        >
          <i
            className={`mt-0.5 shrink-0 ${
              feedback.type === 'ok'
                ? 'ri-checkbox-circle-line text-lg'
                : feedback.type === 'duplicate' || feedback.type === 'notice'
                  ? 'ri-information-line text-lg'
                  : feedback.type === 'service'
                    ? 'ri-user-star-line text-lg'
                    : feedback.type === 'closed' || feedback.type === 'not_started'
                      ? 'ri-lock-line text-lg'
                      : feedback.type === 'forbidden'
                        ? 'ri-lock-2-line text-lg'
                        : feedback.type === 'inactive'
                        ? 'ri-user-forbid-line text-lg'
                        : 'ri-error-warning-line text-lg'
            }`}
          ></i>
          <span className="min-w-0 break-words">
            {feedback.type === 'ok' && `${feedback.name} pointé ✓`}
            {feedback.type === 'duplicate' && `${feedback.name} est déjà pointé`}
            {feedback.type === 'service' && `${feedback.name} marqué absent en service ✓`}
            {feedback.type === 'notice' && feedback.name}
            {feedback.type === 'unknown' && `QR Code inconnu : ${feedback.name}`}
            {feedback.type === 'inactive' &&
              `${feedback.name} n'est pas un membre actif — pointage impossible`}
            {feedback.type === 'wrong_community' &&
              `${feedback.name} appartient à ${feedback.community ? `la communauté « ${feedback.community} »` : 'une autre communauté'} — non concerné par cet événement`}
            {feedback.type === 'closed' &&
              `L'événement « ${feedback.name} » est clôturé — pointage impossible`}
            {feedback.type === 'not_started' &&
              `L'événement « ${feedback.name} » a lieu un jour futur — pointage impossible pour l'instant`}
            {feedback.type === 'forbidden' &&
              `${feedback.name} n'a pas pu être pointé : vous n'avez pas les droits pour modifier cette ligne.`}
            {feedback.type === 'error' &&
              `Erreur lors du pointage de ${feedback.name}. Réessayez.`}
          </span>
        </div>
      )}

      {closeMsg && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${closeMsg.ok ? 'border-primary-200 bg-primary-100/70 text-primary-800' : 'border-accent-200 bg-accent-100/70 text-accent-800'}`}>
          <i className={`mt-0.5 shrink-0 ${closeMsg.ok ? 'ri-checkbox-circle-line text-lg' : 'ri-error-warning-line text-lg'}`}></i>
          <span className="min-w-0 flex-1 break-words">{closeMsg.text}</span>
          <button
            onClick={() => setCloseMsg(null)}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-background-200/60"
            title="Fermer"
            aria-label="Fermer le message"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {isActuallyClosed && (
        <div className="flex items-center gap-2 rounded-lg border border-background-200 bg-background-100 px-4 py-3 text-sm font-medium text-foreground-700">
          <i className="ri-lock-line text-lg"></i>
          <span>Cet événement est clôturé. Les pointages sont verrouillés.</span>
        </div>
      )}

      {!isActuallyClosed && isPastEnd && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 px-4 py-3 text-sm font-medium text-accent-800">
          <i className="ri-time-line mt-0.5 text-lg"></i>
          <span>
            L'heure de fin est dépassée : les pointages sont fermés. Cliquez sur
            « Finaliser la clôture » pour enregistrer les absents.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-background-200 bg-background-50 p-5 lg:col-span-2">
          <div className="mb-4 inline-flex rounded-full bg-background-100 p-1" role="tablist" aria-label="Mode de pointage">
            <button
              onClick={() => setMode('camera')}
              role="tab"
              aria-selected={mode === 'camera'}
              className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === 'camera' ? 'bg-background-50 text-foreground-900' : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              <i className="ri-camera-line mr-1.5"></i>Caméra
            </button>
            <button
              onClick={() => setMode('manual')}
              role="tab"
              aria-selected={mode === 'manual'}
              className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === 'manual' ? 'bg-background-50 text-foreground-900' : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              <i className="ri-keyboard-line mr-1.5"></i>Saisie manuelle
            </button>
          </div>

          {mode === 'camera' ? (
            <ScannerView active={mode === 'camera'} onScan={handleScan} disabled={pointageLocked} />
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                  <i className="ri-search-line text-sm"></i>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un membre (nom ou numéro)..."
                  className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="divide-y divide-background-100">
                {manualResults.map((member) => {
                  // Statut réellement enregistré (et non simple présence d'une
                  // ligne) : après clôture, les membres marqués absents doivent
                  // apparaître comme absents, pas comme « Pointé ».
                  const currentStatus = recordStatusById.get(member.id);
                  const checked = currentStatus !== undefined;
                  const statusBadge =
                    currentStatus === 'Absent en service'
                      ? { className: 'bg-secondary-100 text-secondary-700', label: 'En service' }
                      : currentStatus === 'En retard'
                        ? { className: 'bg-accent-100 text-accent-700', label: 'En retard' }
                        : currentStatus === 'Absent'
                          ? { className: 'bg-background-100 text-foreground-500', label: 'Absent' }
                          : { className: 'bg-primary-100 text-primary-700', label: 'Présent' };
                  return (
                    <div key={member.id} className="flex items-center gap-3 py-2.5">
                      <LazyImage
                        src={member.photoUrl}
                        alt={`${member.firstName} ${member.lastName}`}
                        containerClassName="h-9 w-9 shrink-0 rounded-full border border-background-200 bg-background-100"
                        imgClassName="object-top"
                        fallback={
                          <span className="text-xs font-bold text-foreground-600">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </span>
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground-900">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="truncate text-xs text-foreground-500">
                          {member.number} · {member.community}
                        </p>
                      </div>
                      {checked ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ${statusBadge.className}`}
                          >
                            <i className={currentStatus === 'Absent' ? 'ri-user-unfollow-line' : 'ri-check-line'}></i>
                            {statusBadge.label}
                          </span>
                          {!presentStatuses.includes(currentStatus ?? '') && (
                            <button
                              onClick={() => void handleManual(member)}
                              disabled={pointageLocked}
                              title={pointageLocked ? 'Pointage verrouillé' : 'Pointer ce membre pour cette session'}
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary-500 px-2.5 py-1.5 text-xs font-semibold text-background-50 ${
                                pointageLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-primary-600'
                              }`}
                            >
                              <i className="ri-user-add-line"></i>
                              Pointer
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => void handleMarkAbsent(member)}
                            disabled={pointageLocked}
                            title={pointageLocked ? 'Pointage verrouillé' : 'Marquer comme absent en service'}
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-secondary-200 px-2.5 py-1.5 text-xs font-semibold text-secondary-700 ${
                              pointageLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-secondary-100'
                            }`}
                          >
                            <i className="ri-user-star-line"></i>
                            En service
                          </button>
                          <button
                            onClick={() => void handleManual(member)}
                            disabled={pointageLocked}
                            title={pointageLocked ? 'Pointage verrouillé' : 'Pointer ce membre'}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50 ${
                              pointageLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-primary-600'
                            }`}
                          >
                            <i className="ri-user-add-line"></i>
                            Pointer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {manualResults.length === 0 && (
                  <p className="py-8 text-center text-sm text-foreground-400">
                    {eligibleMembers.length === 0
                      ? 'Aucun membre actif à pointer pour cet événement.'
                      : 'Aucun membre ne correspond à cette recherche.'}
                  </p>
                )}
                {manualResults.length > 0 && manualMatches.total > manualResults.length && (
                  <p className="pt-3 text-center text-xs text-foreground-400">
                    {manualMatches.total - manualResults.length} autre(s) membre(s) correspondant(s) — affinez la
                    recherche pour les voir.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold text-foreground-900">Pointages en direct</h3>
            <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
              {presentCount} présent{presentCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
            {eventRecords.map((record) => (
              <div key={record.id} className="flex items-center gap-3 rounded-lg border border-background-100 bg-background-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-xs font-bold text-foreground-600">
                  {record.memberName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground-900">{record.memberName}</p>
                  <p className="truncate text-xs text-foreground-500">{record.community}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {record.time && <span className="text-xs font-medium text-foreground-600">{record.time}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${attendanceStatusStyle[record.status] ?? 'bg-background-100 text-foreground-500'}`}>
                    {record.status}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      record.method === 'QR'
                        ? 'bg-primary-100 text-primary-700'
                        : record.method === 'Manuel' && record.time
                          ? 'bg-secondary-100 text-secondary-700'
                          : 'bg-background-100 text-foreground-500'
                    }`}
                  >
                    {/* Une absence générée à la clôture n'a pas d'heure : elle
                        n'a pas été saisie manuellement, l'afficher « Manuel »
                        laissait croire à une action d'un responsable. Une ligne
                        reprise d'une session précédente porte « Repris ». */}
                    {record.method === 'Repris' ? 'Repris' : record.time ? record.method : 'Clôture'}
                  </span>
                </div>
                <button
                  onClick={() => requestRemove(record)}
                  disabled={pointageLocked}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-400 ${
                    pointageLocked
                      ? 'cursor-not-allowed opacity-40'
                      : 'cursor-pointer hover:bg-accent-100 hover:text-accent-700'
                  }`}
                  title={pointageLocked ? 'Événement clôturé : pointage non modifiable' : 'Annuler le pointage'}
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            ))}
            {eventRecords.length === 0 && (
              <p className="py-8 text-center text-sm text-foreground-400">
                Aucun pointage pour le moment. Scannez un QR Code ou ajoutez manuellement.
              </p>
            )}
          </div>
        </div>
      </div>

      {removeTarget && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40 animate-fade-in"
              onClick={() => {
                if (!removing) {
                  setRemoveTarget(null);
                  setRemoveError(null);
                }
              }}
            ></div>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-pointage-title"
              className="relative w-full max-w-sm rounded-lg border border-background-200 bg-background-50 p-6 animate-fade-up"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <i className="ri-delete-bin-line text-2xl"></i>
              </div>
              <h3 id="remove-pointage-title" className="mt-4 font-heading text-lg font-bold text-foreground-950">
                Annuler ce pointage ?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-500">
                Le pointage de <strong className="text-foreground-800">{removeTarget.memberName}</strong> sera
                supprimé. Le membre redeviendra pointable pour cet événement.
              </p>
              {removeError && (
                <p className="mt-3 rounded-lg bg-accent-100/70 px-3 py-2 text-sm text-accent-800">{removeError}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRemoveTarget(null);
                    setRemoveError(null);
                  }}
                  disabled={removing}
                  className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void confirmRemove()}
                  disabled={removing}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removing ? (
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