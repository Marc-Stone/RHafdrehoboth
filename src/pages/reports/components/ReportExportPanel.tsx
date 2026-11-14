import { useEffect, useMemo, useState } from 'react';
import type { AttendanceRecord, ChurchEvent, ChurchSettings, Community, Member } from '@/lib/types';
import { attendanceStatusOptions } from '@/lib/constants';
import {
  REPORT_PERIOD_OPTIONS,
  buildReport,
  buildReportFileName,
  defaultReportFilters,
  resolveRange,
  todayISO,
  type ReportFilters,
  type ReportFormat,
  type ReportPeriodType,
} from '@/lib/reports';
import { logActivity } from '@/lib/activity';
import { formatDateFr } from '@/utils/date';

interface ReportExportPanelProps {
  open: boolean;
  onClose: () => void;
  records: AttendanceRecord[];
  members: Member[];
  events: ChurchEvent[];
  communities: Community[];
  settings: ChurchSettings;
  logoUrl: string | null;
  generatedBy: string;
  userRole: string;
  userCommunityIds: string[];
  initialDate: string;
  /** Période par défaut de l'export (reprend la période affichée). */
  initialPeriod?: ReportPeriodType;
  /** Communauté déjà sélectionnée sur la page Rapports. */
  initialCommunityId?: string;
}

const fieldClass =
  'w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

export default function ReportExportPanel({
  open,
  onClose,
  records,
  members,
  events,
  communities,
  settings,
  logoUrl,
  generatedBy,
  userRole,
  userCommunityIds,
  initialDate,
  initialPeriod = 'day',
  initialCommunityId = '',
}: ReportExportPanelProps) {
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [filters, setFilters] = useState<ReportFilters>(() =>
    defaultReportFilters(initialDate, initialPeriod, initialCommunityId),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // À chaque ouverture, l'export repart de la période et de la communauté
    // affichées sur la page Rapports (sinon le fichier ne correspondait pas
    // à ce que l'utilisateur venait de consulter).
    setFilters(defaultReportFilters(initialDate, initialPeriod, initialCommunityId));
    setError(null);
  }, [open, initialDate, initialPeriod, initialCommunityId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const restrictCommunityIds =
    userRole === 'community_leader' && userCommunityIds.length > 0 ? userCommunityIds : null;

  const availableCommunities = useMemo(
    () => (restrictCommunityIds ? communities.filter((c) => restrictCommunityIds.includes(c.id)) : communities),
    [communities, restrictCommunityIds],
  );

  // Événements de premier niveau : événements uniques et conteneurs.
  const eventOptions = useMemo(
    () =>
      events
        .filter((e) => !e.parentEventId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [events],
  );

  const sessionOptions = useMemo(
    () =>
      filters.eventId
        ? events.filter((e) => e.parentEventId === filters.eventId)
        : [],
    [events, filters.eventId],
  );

  const memberOptions = useMemo(() => {
    const scoped =
      restrictCommunityIds && userRole === 'community_leader'
        ? members.filter((m) => m.communityIds.some((id) => restrictCommunityIds.includes(id)))
        : members;
    return [...scoped].sort(
      (a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'),
    );
  }, [members, restrictCommunityIds, userRole]);

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      if (r.scannedBy && r.scannedByName) map.set(r.scannedBy, r.scannedByName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [records]);

  const data = useMemo(
    () =>
      buildReport({
        records,
        members,
        events,
        communities,
        settings,
        logoUrl,
        generatedBy,
        filters,
        restrictCommunityIds,
      }),
    [records, members, events, communities, settings, logoUrl, generatedBy, filters, restrictCommunityIds],
  );

  if (!open) return null;

  const update = (patch: Partial<ReportFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const selectPeriod = (value: ReportPeriodType) => {
    if (value === 'day') {
      const today = todayISO();
      update({ periodType: value, date: today, startDate: today, endDate: today });
    } else if (value === 'custom') {
      const range = resolveRange({ ...filters, periodType: 'day' });
      update({ periodType: value, startDate: range.start, endDate: range.end });
    } else {
      update({ periodType: value });
    }
  };

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const handleGenerate = async () => {
    if (!data.hasData) return;
    setGenerating(true);
    setError(null);
    try {
      const fileName = buildReportFileName(data, format);
      if (format === 'pdf') {
        // Les bibliothèques d'export (PDF, Excel) sont volumineuses : elles ne
        // sont téléchargées qu'au moment où l'utilisateur génère réellement
        // un fichier, afin que la page Rapports reste rapide à ouvrir.
        const { exportReportPdf } = await import('@/utils/exportReportPdf');
        await exportReportPdf(data, fileName);
      } else {
        const { exportReportExcel } = await import('@/utils/exportReportExcel');
        exportReportExcel(data, fileName);
      }
      await logActivity('export', `a exporté le rapport « ${data.title} » (${data.periodLabel})`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'export a échoué. Veuillez réessayer.");
    } finally {
      setGenerating(false);
    }
  };

  const summaryCards = [
    { label: 'Membres concernés', value: data.summary.membersConcerned, icon: 'ri-group-line' },
    { label: 'Présents', value: data.summary.presents, icon: 'ri-user-follow-line' },
    { label: 'Retards', value: data.summary.lates, icon: 'ri-time-line' },
    { label: 'Absents', value: data.summary.absents, icon: 'ri-user-unfollow-line' },
    { label: 'En service', value: data.summary.excused, icon: 'ri-briefcase-line' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose}></div>
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-background-50 shadow-2xl animate-fade-up sm:max-w-2xl sm:rounded-xl">
        {/* En-tête */}
        <div className="flex items-start justify-between border-b border-background-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-file-chart-2-line text-xl"></i>
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground-950">Exporter le rapport</h2>
              <p className="mt-0.5 text-xs text-foreground-500">
                Choisissez la période, les filtres et le format, puis vérifiez l'aperçu.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-400 hover:bg-background-100 hover:text-foreground-700"
            title="Fermer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Contenu défilable */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Format */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">Format du fichier</p>
            <div className="inline-flex items-center gap-1 rounded-full border border-background-200 bg-background-100 p-1">
              {(['pdf', 'excel'] as ReportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    format === f ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:bg-background-200/60'
                  }`}
                >
                  <i className={f === 'pdf' ? 'ri-file-pdf-2-line' : 'ri-file-excel-2-line'}></i>
                  {f === 'pdf' ? 'PDF' : 'Excel'}
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">Période</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => selectPeriod(opt.value)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    filters.periodType === opt.value
                      ? 'border-primary-500 bg-primary-500 text-background-50'
                      : 'border-background-200 text-foreground-600 hover:bg-background-100'
                  }`}
                >
                  <i className={opt.icon}></i>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filters.periodType === 'custom' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground-700">Date de début</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => update({ startDate: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground-700">Date de fin</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => update({ endDate: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-foreground-700">
                    {filters.periodType === 'day' ? 'Date' : 'Date de référence'}
                  </label>
                  <input
                    type="date"
                    value={filters.date}
                    disabled={filters.periodType === 'day'}
                    onChange={(e) => update({ date: e.target.value })}
                    className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-70`}
                  />
                </div>
              )}
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-foreground-500">
              <i className="ri-calendar-line"></i>
              {data.periodLabel}
            </p>
          </div>

          {/* Filtres */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">Filtres</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground-700">Événement</label>
                <select
                  value={filters.eventId}
                  onChange={(e) => update({ eventId: e.target.value, sessionId: '' })}
                  className={fieldClass}
                >
                  <option value="">Tous les événements</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} — {formatDateFr(ev.date)}
                    </option>
                  ))}
                </select>
              </div>

              {sessionOptions.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground-700">Partie / session</label>
                  <select
                    value={filters.sessionId}
                    onChange={(e) => update({ sessionId: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Toutes les sessions</option>
                    {sessionOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                        {s.startTime ? ` (${s.startTime})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground-700">Membre</label>
                <select
                  value={filters.memberId}
                  onChange={(e) => update({ memberId: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Tous les membres</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.lastName} {m.firstName} — {m.number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground-700">Sexe</label>
                <select
                  value={filters.gender}
                  onChange={(e) => update({ gender: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Tous</option>
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
              </div>

              {agentOptions.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-foreground-700">
                    Responsable du pointage
                  </label>
                  <select
                    value={filters.scannedById}
                    onChange={(e) => update({ scannedById: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Tous les responsables</option>
                    {agentOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Communautés */}
            {availableCommunities.length > 0 && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-foreground-700">
                  Communautés <span className="text-foreground-400">({filters.communityIds.length || 'toutes'})</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCommunities.map((c) => {
                    const active = filters.communityIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => update({ communityIds: toggleIn(filters.communityIds, c.id) })}
                        className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-secondary-500 bg-secondary-500 text-background-50'
                            : 'border-background-200 text-foreground-600 hover:bg-background-100'
                        }`}
                      >
                        {active && <i className="ri-check-line"></i>}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Statuts */}
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-medium text-foreground-700">
                Statut de présence <span className="text-foreground-400">({filters.statuses.length || 'tous'})</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {attendanceStatusOptions.map((s) => {
                  const active = filters.statuses.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => update({ statuses: toggleIn(filters.statuses, s) })}
                      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-accent-500 bg-accent-500 text-background-50'
                          : 'border-background-200 text-foreground-600 hover:bg-background-100'
                      }`}
                    >
                      {active && <i className="ri-check-line"></i>}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {(filters.eventId ||
              filters.sessionId ||
              filters.memberId ||
              filters.gender ||
              filters.scannedById ||
              filters.communityIds.length > 0 ||
              filters.statuses.length > 0) && (
              <button
                onClick={() =>
                  update({
                    eventId: '',
                    sessionId: '',
                    memberId: '',
                    gender: '',
                    scannedById: '',
                    communityIds: [],
                    statuses: [],
                  })
                }
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <i className="ri-refresh-line"></i>
                Réinitialiser les filtres
              </button>
            )}
          </div>

          {/* Aperçu */}
          <div className="rounded-lg border border-background-200 bg-background-100/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Aperçu du rapport</p>
              <span className="text-xs text-foreground-500">
                {data.summary.pointages} pointage{data.summary.pointages > 1 ? 's' : ''}
              </span>
            </div>

            {!data.hasData ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <i className="ri-error-warning-line"></i>
                </span>
                <p>Aucune présence trouvée pour les critères sélectionnés.</p>
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div key={card.label} className="rounded-lg border border-background-200 bg-background-50 p-3">
                      <span className="flex h-6 w-6 items-center justify-center text-foreground-400">
                        <i className={card.icon}></i>
                      </span>
                      <p className="mt-1 text-lg font-bold text-foreground-950">{card.value}</p>
                      <p className="text-[11px] text-foreground-500">{card.label}</p>
                    </div>
                  ))}
                  <div className="rounded-lg border border-accent-200 bg-accent-100/60 p-3">
                    <span className="flex h-6 w-6 items-center justify-center text-accent-700">
                      <i className="ri-line-chart-line"></i>
                    </span>
                    <p className="mt-1 text-lg font-bold text-accent-800">{data.summary.rate} %</p>
                    <p className="text-[11px] text-accent-700">Taux de présence</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.activeFilters.map((f) => (
                    <span
                      key={f.label}
                      className="inline-flex items-center gap-1 rounded-full bg-background-200/70 px-2.5 py-1 text-[11px] font-medium text-foreground-700"
                    >
                      <span className="text-foreground-500">{f.label} :</span>
                      {f.value}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <i className="ri-error-warning-line"></i>
              </span>
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-3 border-t border-background-200 px-5 py-4">
          <button
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Annuler
          </button>
          <button
            onClick={handleGenerate}
            disabled={!data.hasData || generating}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                Génération...
              </>
            ) : (
              <>
                <i className="ri-download-2-line"></i>
                Générer le {format === 'pdf' ? 'PDF' : 'Excel'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}