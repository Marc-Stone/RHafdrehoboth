import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAttendances } from '@/hooks/useAttendances';
import { useAuth } from '@/hooks/useAuth';
import { formatDateFr, formatDateShort } from '@/utils/date';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types';
import { attendanceStatusOptions, attendanceStatusStyle, presentStatuses } from '@/lib/constants';
import { exportTableToPdf } from '@/utils/exportPdf';
import { logActivity } from '@/lib/activity';
import ExportMenu from '@/pages/attendances/components/ExportMenu';
import PageHeader from '@/components/base/PageHeader';
import StatTile from '@/components/base/StatTile';

interface Session {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  records: AttendanceRecord[];
  presentCount: number;
  qrCount: number;
  manualCount: number;
}

/** Nombre d'événements rendus au premier affichage (puis chargés par paliers). */
const SESSION_STEP = 10;

/** Abréviation du mois à partir d'une date ISO (« 2026-03-14 » → « mars »). */
function monthShortFr(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

/** Heure comparable « HH:MM » (les absences automatiques n'ont pas d'heure). */
function timeRank(time: string): string {
  return time && time.length >= 5 ? time.slice(0, 5) : '99:99';
}

export default function AttendancesPage() {
  const { records, loading, error, fetchRecords, updateRecordStatus, deleteEvent } = useAttendances();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  // Filtrage différé : la frappe reste instantanée même avec des milliers de
  // pointages, sans bloquer le fil principal.
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canDelete = user?.role === 'super_admin' || user?.role === 'pastor' || user?.role === 'secretary';
  // Ces trois rôles correspondent exactement à l'autorisation administrative
  // prévue par la base : eux seuls peuvent encore corriger un pointage d'une
  // session clôturée.
  const canEditClosed = canDelete;

  const sessions = useMemo<Session[]>(() => {
    const map = new Map<string, Session>();
    records.forEach((r) => {
      if (!map.has(r.eventId)) {
        map.set(r.eventId, {
          eventId: r.eventId,
          eventTitle: r.eventTitle,
          eventDate: r.eventDate,
          records: [],
          presentCount: 0,
          qrCount: 0,
          manualCount: 0,
        });
      }
      map.get(r.eventId)!.records.push(r);
    });
    // Tri chronologique à l'intérieur de chaque session (les pointages étaient
    // affichés dans l'ordre inverse de la base, du plus récent au plus ancien),
    // puis calcul des compteurs une seule fois pour éviter de recalculer
    // plusieurs fois les mêmes filtres à chaque rendu.
    map.forEach((s) => {
      s.records.sort((a, b) => timeRank(a.time).localeCompare(timeRank(b.time)));
      s.presentCount = s.records.filter((r) => presentStatuses.includes(r.status)).length;
      s.qrCount = s.records.filter((r) => r.method === 'QR').length;
      s.manualCount = s.records.filter((r) => r.method === 'Manuel' && r.time).length;
    });
    return Array.from(map.values()).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [records]);

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    let result = sessions;
    if (statusFilter) {
      result = sessions
        .map((s) => ({ ...s, records: s.records.filter((r) => r.status === statusFilter) }))
        .filter((s) => s.records.length > 0);
    }
    if (!term) return result;
    return result.filter(
      (s) =>
        s.eventTitle.toLowerCase().includes(term) ||
        s.records.some((r) => r.memberName.toLowerCase().includes(term)),
    );
  }, [sessions, deferredSearch, statusFilter]);

  // Affichage progressif : seules les premières sessions sont montées, le
  // reste arrive au clic. Évite de construire des centaines de tableaux DOM
  // à l'ouverture de la page.
  const [visibleCount, setVisibleCount] = useState(SESSION_STEP);
  useEffect(() => {
    setVisibleCount(SESSION_STEP);
  }, [deferredSearch, statusFilter]);
  const visibleSessions = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // Tous les compteurs de la page sont calculés en une seule passe.
  const totals = useMemo(() => {
    let present = 0;
    let excused = 0;
    let absent = 0;
    let qr = 0;
    let manual = 0;
    records.forEach((r) => {
      if (presentStatuses.includes(r.status)) present += 1;
      if (r.status === 'Absent en service') excused += 1;
      if (r.status === 'Absent') absent += 1;
      if (r.method === 'QR') qr += 1;
      // Les « Absent » générés automatiquement à la clôture n'ont pas d'heure
      // de pointage : ils ne comptent pas comme des saisies manuelles.
      if (r.method === 'Manuel' && r.time) manual += 1;
    });
    return { present, excused, absent, qr, manual };
  }, [records]);

  const totalPointages = records.length;
  const { present: presentCount, excused: excusedCount, absent: absentCount, qr: qrCount, manual: manualCount } = totals;
  const scannedTotal = qrCount + manualCount;
  const qrRate = scannedTotal > 0 ? Math.round((qrCount / scannedTotal) * 100) : 0;

  const handleStatusChange = async (recordId: string, status: AttendanceStatus) => {
    setActionError(null);
    const res = await updateRecordStatus(recordId, status);
    // Un échec d'écriture était totalement silencieux : le statut revenait à
    // l'ancienne valeur sans que l'utilisateur comprenne pourquoi.
    if (res?.error) setActionError(`Statut non enregistré : ${res.error}`);
  };

  // Les exports reprennent exactement ce qui est affiché à l'écran (recherche +
  // filtre de statut) : avant, le PDF contenait tous les pointages quels que
  // soient les filtres appliqués.
  const filtersLabel = (): string => {
    const parts: string[] = [];
    if (statusFilter) parts.push(`statut « ${statusFilter} »`);
    const term = deferredSearch.trim();
    if (term) parts.push(`recherche « ${term} »`);
    return parts.length > 0 ? ` — Filtres : ${parts.join(', ')}` : '';
  };

  const exportSessions = (source: Session[], title: string, baseSubtitle: string, logLabel: string) => {
    const rows: string[][] = [];
    let presentTotal = 0;
    source.forEach((s) =>
      s.records.forEach((r) => {
        if (presentStatuses.includes(r.status)) presentTotal += 1;
        rows.push([r.memberName, r.memberNumber, r.community, s.eventTitle, formatDateShort(s.eventDate), r.time, r.status, r.scannedByName || '—']);
      }),
    );
    const total = rows.length;
    // « présences » ne compte plus les absents : on distingue pointages et présents.
    const counts = `${total} pointage${total > 1 ? 's' : ''}, dont ${presentTotal} présent${presentTotal > 1 ? 's' : ''} (retards inclus)`;
    exportTableToPdf({
      title,
      subtitle: `${baseSubtitle} — ${counts}${filtersLabel()}`,
      columns: ['Membre', 'Numéro', 'Communauté', 'Événement', 'Date', 'Heure', 'Statut', 'Responsable'],
      rows,
    });
    void logActivity('export', `a exporté ${logLabel} en PDF (${total} ligne${total > 1 ? 's' : ''})`);
  };

  const handleExportAll = () => {
    exportSessions(filtered, 'Historique des présences', 'Pointages classés par événement et par date', "l'historique des présences");
  };

  const handleExportDay = (date: string) => {
    exportSessions(
      filtered.filter((s) => s.eventDate === date),
      `Présences du ${formatDateFr(date)}`,
      'Pointages de la journée',
      `les présences du ${formatDateFr(date)}`,
    );
  };

  // Les compteurs du menu d'export reflètent eux aussi les filtres actifs.
  const countForDate = (date: string) =>
    filtered.filter((s) => s.eventDate === date).reduce((sum, s) => sum + s.records.length, 0);
  const exportableTotal = filtered.reduce((sum, s) => sum + s.records.length, 0);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    const res = await deleteEvent(deleteTarget.eventId, deleteTarget.eventTitle);
    setDeleting(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    setExpandedId(null);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Suivi"
        icon="ri-check-double-line"
        title="Présences"
        description="Historique complet des pointages, classé par événement et par date."
        actions={
          totalPointages > 0 ? (
            <ExportMenu
              onExportDay={handleExportDay}
              onExportAll={handleExportAll}
              countForDate={countForDate}
              totalCount={exportableTotal}
            />
          ) : null
        }
      />

      {actionError && !deleteTarget && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/70 px-4 py-3 text-sm text-accent-800">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-accent-700 hover:bg-accent-200/60"
            title="Fermer"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Présents"
          value={presentCount}
          icon="ri-user-follow-line"
          tone="primary"
          hint={`${absentCount} absent(s) · ${excusedCount} en service`}
        />
        <StatTile label="Événements suivis" value={sessions.length} icon="ri-calendar-event-line" tone="accent" />
        <StatTile
          label="Taux QR"
          value={`${qrRate}%`}
          icon="ri-qr-scan-line"
          tone="secondary"
          hint={`${qrCount} QR · ${manualCount} manuel`}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 p-12 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Chargement des présences...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-background-200 bg-background-50 p-12 text-center">
          <p className="text-sm text-foreground-600">{error}</p>
          <button
            onClick={fetchRecords}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Réessayer
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
            <i className="ri-qr-scan-2-line text-3xl"></i>
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucune présence enregistrée</h2>
          <p className="mt-2 max-w-sm text-sm text-foreground-500">
            Scannez des QR Codes ou ajoutez des membres manuellement depuis le scanner pour les voir apparaître ici.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-md">
              <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
                <i className="ri-search-line text-sm"></i>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un événement ou un membre..."
                className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              {attendanceStatusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {visibleSessions.map((session) => {
              const isOpen = expandedId === session.eventId;
              const qr = session.qrCount;
              const manual = session.manualCount;
              return (
                <div
                  key={session.eventId}
                  className="overflow-hidden rounded-lg border border-background-200 bg-background-50"
                >
                  <div className="flex items-stretch">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : session.eventId)}
                    className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-background-100/50 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-background-100">
                      <span className="text-lg font-bold leading-none text-foreground-900">
                        {session.eventDate ? session.eventDate.slice(8, 10) : '--'}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium uppercase text-foreground-500">
                        {monthShortFr(session.eventDate)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-base font-semibold text-foreground-900">{session.eventTitle}</h3>
                      <p className="mt-0.5 text-xs text-foreground-500">
                        {session.eventDate ? formatDateFr(session.eventDate) : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
                        {session.presentCount} présent{session.presentCount > 1 ? 's' : ''}
                      </span>
                      <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-medium text-secondary-700">
                        {qr} QR · {manual} manuel
                      </span>
                      {session.records[0]?.eventClosed && (
                        <span
                          className="flex items-center gap-1 rounded-full bg-background-200/70 px-3 py-1 text-xs font-medium text-foreground-600"
                          title="Session clôturée : les pointages sont figés"
                        >
                          <span className="flex h-3 w-3 items-center justify-center">
                            <i className="ri-lock-line text-[11px]"></i>
                          </span>
                          Clôturée
                        </span>
                      )}
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-400">
                        <i className={isOpen ? 'ri-arrow-up-s-line text-lg' : 'ri-arrow-down-s-line text-lg'}></i>
                      </span>
                    </div>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(session)}
                      className="flex shrink-0 cursor-pointer items-center border-l border-background-200 px-4 text-foreground-400 transition-colors hover:bg-accent-100 hover:text-accent-700"
                      title="Supprimer cet événement"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  )}
                  </div>

                  {isOpen && (
                    <div className="border-t border-background-200 px-5 py-3">
                      <>
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-background-200 text-left text-xs uppercase text-foreground-400">
                              <th className="py-2 pr-4 font-medium">Membre</th>
                              <th className="py-2 pr-4 font-medium">Numéro</th>
                              <th className="py-2 pr-4 font-medium">Communauté</th>
                              <th className="py-2 pr-4 font-medium">Statut</th>
                              <th className="py-2 pr-4 font-medium">Méthode</th>
                              <th className="py-2 font-medium">Heure</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.records.map((r) => (
                              <tr key={r.id} className="border-b border-background-100 last:border-0">
                                <td className="py-2.5 pr-4 font-medium text-foreground-800">{r.memberName}</td>
                                <td className="py-2.5 pr-4 font-mono text-foreground-500">{r.memberNumber}</td>
                                <td className="py-2.5 pr-4 text-foreground-500">{r.community}</td>
                                <td className="py-2.5 pr-4">
                                  <select
                                    value={r.status}
                                    disabled={Boolean(r.eventClosed) && !canEditClosed}
                                    title={
                                      Boolean(r.eventClosed) && !canEditClosed
                                        ? 'Session clôturée : correction réservée aux administrateurs'
                                        : undefined
                                    }
                                    onChange={(e) => void handleStatusChange(r.id, e.target.value as AttendanceStatus)}
                                    className={`${
                                      Boolean(r.eventClosed) && !canEditClosed
                                        ? 'cursor-not-allowed opacity-70'
                                        : 'cursor-pointer'
                                    } rounded-full px-2.5 py-1 text-xs font-semibold ${attendanceStatusStyle[r.status] ?? 'bg-background-100 text-foreground-500'} focus:outline-none`}
                                  >
                                    {attendanceStatusOptions.map((s) => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2.5 pr-4">
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      r.method === 'QR'
                                        ? 'bg-secondary-100 text-secondary-700'
                                        : 'bg-background-100 text-foreground-500'
                                    }`}
                                  >
                                    {r.method}
                                  </span>
                                </td>
                                <td className="py-2.5 text-foreground-500">{r.time}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>

                        <div className="divide-y divide-background-100 md:hidden">
                          {session.records.map((r) => (
                            <div key={r.id} className="py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-foreground-800">{r.memberName}</p>
                                  <p className="truncate text-xs text-foreground-500">
                                    {r.memberNumber} · {r.community}
                                  </p>
                                </div>
                                <select
                                  value={r.status}
                                  disabled={Boolean(r.eventClosed) && !canEditClosed}
                                  title={
                                    Boolean(r.eventClosed) && !canEditClosed
                                      ? 'Session clôturée : correction réservée aux administrateurs'
                                      : undefined
                                  }
                                  onChange={(e) => void handleStatusChange(r.id, e.target.value as AttendanceStatus)}
                                  className={`${
                                    Boolean(r.eventClosed) && !canEditClosed
                                      ? 'cursor-not-allowed opacity-70'
                                      : 'cursor-pointer'
                                  } rounded-full px-2.5 py-1 text-xs font-semibold ${attendanceStatusStyle[r.status] ?? 'bg-background-100 text-foreground-500'} focus:outline-none`}
                                >
                                  {attendanceStatusOptions.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    r.method === 'QR'
                                      ? 'bg-secondary-100 text-secondary-700'
                                      : 'bg-background-100 text-foreground-500'
                                  }`}
                                >
                                  {r.method}
                                </span>
                                {r.time && <span className="text-xs text-foreground-500">{r.time}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {visibleCount < filtered.length && (
            <div className="flex justify-center">
              <button
                onClick={() => setVisibleCount((c) => c + SESSION_STEP)}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-arrow-down-line"></i>
                Afficher plus d'événements ({filtered.length - visibleCount} restants)
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="rounded-lg border border-background-200 bg-background-50 py-12 text-center text-foreground-400">
              Aucun pointage trouvé.
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDeleteTarget(null)}></div>
          <div className="relative w-full max-w-sm rounded-lg bg-background-50 p-6 shadow-2xl animate-fade-up">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-alert-line text-2xl"></i>
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground-950">Supprimer cet événement ?</h3>
            <p className="mt-2 text-sm text-foreground-500">
              Vous êtes sur le point de supprimer définitivement{' '}
              <strong className="text-foreground-800">{deleteTarget.eventTitle}</strong> ainsi que ses{' '}
              {deleteTarget.records.length} pointage{deleteTarget.records.length > 1 ? 's' : ''}. Cette action est
              irréversible.
            </p>
            {actionError && (
              <p className="mt-3 rounded-lg bg-accent-100/60 px-3 py-2 text-sm text-accent-800">{actionError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setActionError(null);
                }}
                className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
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
      )}
    </div>
  );
}