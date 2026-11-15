import { useEffect, useMemo, useState } from 'react';
import { useActivity } from '@/hooks/useActivity';
import type { ActivityAction } from '@/lib/types';
import { formatDateFr } from '@/utils/date';
import { exportTableToPdf } from '@/utils/exportPdf';
import { logActivity } from '@/lib/activity';
import PageHeader from '@/components/base/PageHeader';

const actionMeta: Record<ActivityAction, { icon: string; color: string }> = {
  pointage: { icon: 'ri-qr-scan-2-line', color: 'bg-primary-100 text-primary-700' },
  ajout: { icon: 'ri-user-add-line', color: 'bg-accent-100 text-accent-700' },
  modification: { icon: 'ri-edit-line', color: 'bg-secondary-100 text-secondary-700' },
  suppression: { icon: 'ri-delete-bin-line', color: 'bg-accent-100 text-accent-700' },
  connexion: { icon: 'ri-login-box-line', color: 'bg-primary-100 text-primary-700' },
  déconnexion: { icon: 'ri-logout-box-r-line', color: 'bg-background-100 text-foreground-600' },
  export: { icon: 'ri-file-download-line', color: 'bg-secondary-100 text-secondary-700' },
  refus: { icon: 'ri-close-circle-line', color: 'bg-accent-100 text-accent-700' },
};

const actionLabels: Record<ActivityAction, string> = {
  pointage: 'Pointage',
  ajout: 'Ajout',
  modification: 'Modification',
  suppression: 'Suppression',
  connexion: 'Connexion',
  déconnexion: 'Déconnexion',
  export: 'Export',
  refus: 'Connexion refusée',
};

const actionOptions: ActivityAction[] = [
  'pointage',
  'ajout',
  'modification',
  'suppression',
  'connexion',
  'déconnexion',
  'export',
  'refus',
];

export default function ActivityPage() {
  const { logs, loading, error, fetchLogs, clearLogs } = useActivity();
  const [search, setSearch] = useState('');
  // Affichage progressif : seules les 40 premières entrées sont montées, le
  // reste arrive au clic (le journal monte vite à plusieurs centaines de lignes).
  const ACTIVITY_STEP = 40;
  const [visibleCount, setVisibleCount] = useState(ACTIVITY_STEP);
  const [actionFilter, setActionFilter] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
    [logs],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sorted.filter((log) => {
      const matchesSearch =
        !term ||
        log.user.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term);
      const matchesAction = !actionFilter || log.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [sorted, search, actionFilter]);

  useEffect(() => {
    setVisibleCount(ACTIVITY_STEP);
  }, [search, actionFilter]);

  const visibleLogs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const handleExport = () => {
    // Le sous-titre décrit ce qui est réellement exporté (avant : toujours
    // « Les 200 dernières actions », même après une recherche ou un filtre).
    const parts: string[] = [];
    if (actionFilter) parts.push(`action « ${actionLabels[actionFilter as ActivityAction] ?? actionFilter} »`);
    if (search.trim()) parts.push(`recherche « ${search.trim()} »`);
    const count = `${filtered.length} action${filtered.length > 1 ? 's' : ''}`;
    const subtitle =
      parts.length > 0
        ? `${count} parmi les 200 dernières — Filtres : ${parts.join(', ')}`
        : `${count} (les 200 dernières enregistrées dans l'application)`;
    exportTableToPdf({
      title: "Journal d'activité",
      subtitle,
      columns: ['Utilisateur', 'Rôle', 'Action', 'Détails', 'Date', 'Heure'],
      rows: filtered.map((log) => [
        log.user,
        log.role,
        actionLabels[log.action],
        log.details,
        formatDateFr(log.date),
        log.time,
      ]),
    });
    // L'export du journal est lui-même journalisé, puis la liste est rafraîchie
    // pour que la nouvelle entrée apparaisse immédiatement.
    void logActivity('export', `a exporté le journal d'activité en PDF (${count})`).then(() => fetchLogs());
  };

  const handleClear = async () => {
    setClearing(true);
    setClearError(null);
    const result = await clearLogs();
    if (result.error) {
      setClearError(result.error);
    } else {
      setConfirmOpen(false);
    }
    setClearing(false);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Système"
        icon="ri-history-line"
        title="Journal d'activité"
        description="Les 200 dernières actions réalisées dans l'application."
        tone="secondary"
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-600">
            <i className="ri-list-check-2 text-sm text-foreground-400"></i>
            {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={handleExport}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-download-2-line"></i>
                Exporter en PDF
              </button>
            )}
            {logs.length > 0 && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-accent-300 bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-700 transition-colors hover:bg-accent-100"
              >
                <i className="ri-delete-bin-6-line"></i>
                Vider l'historique
              </button>
            )}
          </div>
        }
      />

      {logs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur ou une action..."
              className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="">Toutes les actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {actionLabels[a]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            <span className="text-sm">Chargement du journal...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <p className="text-sm text-foreground-600">{error}</p>
            <button
              onClick={fetchLogs}
              className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              Réessayer
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
              <i className="ri-history-line text-3xl"></i>
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucune activité</h2>
            <p className="mt-2 max-w-sm text-sm text-foreground-500">
              Les actions importantes (ajout, modification, suppression, pointage...) apparaîtront ici.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-background-200 px-5 py-3">
              <p className="text-xs font-medium text-foreground-400">{filtered.length} entrée(s)</p>
            </div>
            <div className="divide-y divide-background-100">
              {visibleLogs.map((log) => {
                const meta = actionMeta[log.action] ?? actionMeta.modification;
                return (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                      <i className={`${meta.icon} text-lg`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground-800">
                        <span className="font-semibold text-foreground-900">{log.user}</span> {log.details}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-400">
                        <span className="font-medium text-foreground-500">{log.role}</span>
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-calendar-line"></i>
                          {formatDateFr(log.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          {log.time}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-600">
                      {actionLabels[log.action]}
                    </span>
                  </div>
                );
              })}
            </div>
            {visibleCount < filtered.length && (
              <div className="flex justify-center border-t border-background-100 px-5 py-4">
                <button
                  onClick={() => setVisibleCount((c) => c + ACTIVITY_STEP)}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
                >
                  <i className="ri-arrow-down-line"></i>
                  Afficher plus d'entrées ({filtered.length - visibleCount} restantes)
                </button>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-foreground-400">Aucune activité trouvée.</div>
            )}
          </>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                <i className="ri-alert-line text-xl"></i>
              </div>
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground-900">Vider l'historique ?</h2>
                <p className="mt-1 text-sm text-foreground-600">
                  Cette action supprimera définitivement toutes les entrées du journal d'activité. Elle est irréversible.
                </p>
              </div>
            </div>
            {clearError && (
              <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{clearError}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
              >
                Annuler
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Suppression...
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-6-line"></i>
                    Vider définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}