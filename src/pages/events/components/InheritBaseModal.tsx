import { useEffect } from 'react';
import Portal from '@/components/base/Portal';
import type { ChurchEvent } from '@/lib/types';
import type { InheritSummary } from '@/lib/sessionInheritance';

interface InheritBaseModalProps {
  target: ChurchEvent | null;
  source: ChurchEvent | null;
  summary: InheritSummary | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function TimeRange({ event }: { event: ChurchEvent }) {
  if (!event.startTime && !event.endTime) {
    return <span className="text-xs text-foreground-400">Aucun horaire renseigné</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-foreground-500">
      <i className="ri-time-line text-foreground-400"></i>
      {event.startTime || '—'}
      {event.endTime ? ` – ${event.endTime}` : ''}
    </span>
  );
}

function CountTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-500">
        <i className={`${icon} text-foreground-400`}></i>
        {label}
      </span>
      <p className="mt-1 font-heading text-lg font-bold leading-none text-foreground-900">{value}</p>
    </div>
  );
}

export default function InheritBaseModal({
  target,
  source,
  summary,
  loading,
  submitting,
  error,
  onClose,
  onConfirm,
}: InheritBaseModalProps) {
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, submitting, onClose]);

  if (!target || !source) return null;

  const nothingToAdd = summary !== null && summary.toAdd === 0;
  const canConfirm = !loading && !submitting && summary !== null && summary.toAdd > 0;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="absolute inset-0 bg-black/40 animate-fade-in"
          onClick={() => {
            if (!submitting) onClose();
          }}
        ></div>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inherit-base-title"
          className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50 animate-fade-up"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-background-200 px-6 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <i className="ri-arrow-down-double-line text-xl"></i>
              </span>
              <div>
                <h3 id="inherit-base-title" className="font-heading text-base font-bold text-foreground-950">
                  Reprendre la base précédente
                </h3>
                <p className="mt-0.5 text-xs text-foreground-500">
                  Les résultats d'une session servent de point de départ à la suivante.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!submitting) onClose();
              }}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100"
              title="Fermer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <div className="rounded-lg border border-background-200 bg-background-100/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">Session source</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground-900">{source.title}</p>
                <TimeRange event={source} />
              </div>
              <div className="flex justify-center text-foreground-300">
                <i className="ri-arrow-down-line"></i>
              </div>
              <div className="rounded-lg border border-primary-200 bg-primary-100/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Session à compléter</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground-900">{target.title}</p>
                <TimeRange event={target} />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 py-8 text-sm text-foreground-500">
                <i className="ri-loader-4-line animate-spin text-lg"></i>
                Lecture des résultats de la session source…
              </div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <CountTile label="Présents" value={summary.present} icon="ri-user-follow-line" />
                  <CountTile label="Retards" value={summary.late} icon="ri-time-line" />
                  <CountTile label="En service" value={summary.excused} icon="ri-user-star-line" />
                  <CountTile label="Absents" value={summary.absent} icon="ri-user-unfollow-line" />
                </div>

                {summary.sourceTotal === 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 px-3 py-2.5 text-xs text-accent-800">
                    <i className="ri-error-warning-line mt-0.5"></i>
                    <span>
                      La session source n'a encore aucun résultat. Pointez d'abord « {source.title} », puis revenez
                      reprendre sa base.
                    </span>
                  </div>
                ) : nothingToAdd ? (
                  <div className="flex items-start gap-2 rounded-lg border border-background-200 bg-background-100 px-3 py-2.5 text-xs text-foreground-600">
                    <i className="ri-information-line mt-0.5"></i>
                    <span>
                      Les {summary.sourceTotal} membres de la session source sont déjà enregistrés sur cette session.
                      Aucun ajout ne sera effectué.
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-xs text-foreground-600">
                    <p>
                      <strong className="text-foreground-900">{summary.toAdd} membre(s)</strong> seront ajoutés avec
                      leur statut d'origine.
                    </p>
                    {summary.targetExisting > 0 && (
                      <p className="mt-1 text-foreground-500">
                        {summary.targetExisting} membre(s) déjà enregistrés sur cette session seront conservés tels quels.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg border border-secondary-200 bg-secondary-100/50 px-3 py-2.5 text-xs text-secondary-900">
                  <i className="ri-information-line mt-0.5"></i>
                  <span>
                    Les horaires de cette session ne changent pas et aucune heure de pointage n'est copiée. Après la
                    reprise, chaque session reste indépendante : vous pouvez pointer, retirer ou corriger les statuts
                    séparément. Les lignes reprises comptent normalement dans les statistiques de présence : seule leur
                    méthode d'enregistrement porte la mention « Repris ».
                  </span>
                </div>
              </>
            ) : null}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/70 px-3 py-2.5 text-xs text-accent-800">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-background-200 px-6 py-4">
            <button
              onClick={onClose}
              disabled={submitting}
              className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Reprise...
                </>
              ) : (
                <>
                  <i className="ri-arrow-down-double-line"></i>
                  {summary && summary.toAdd > 0 ? `Reprendre ${summary.toAdd} membre(s)` : 'Reprendre la base'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}