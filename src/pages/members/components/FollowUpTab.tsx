import { useMemo } from 'react';
import { useMemberAttendances } from '@/hooks/useMemberAttendances';
import type { Member, TrainingItem, EvaluationItem } from '@/lib/types';
import { attendanceStatusStyle } from '@/lib/constants';
import { formatDateFr } from '@/utils/date';
import { inputClass } from '@/components/base/formStyles';

function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface FollowUpTabProps {
  member: Member | null;
  trainings: TrainingItem[];
  evaluations: EvaluationItem[];
  onTrainingsChange: (items: TrainingItem[]) => void;
  onEvaluationsChange: (items: EvaluationItem[]) => void;
}

export default function FollowUpTab({
  member,
  trainings,
  evaluations,
  onTrainingsChange,
  onEvaluationsChange,
}: FollowUpTabProps) {
  // Chargement ciblé : uniquement les présences de CE membre, pas celles de
  // toute l'église (évite un chargement lourd à chaque ouverture du formulaire).
  const { records, loading: attendanceLoading } = useMemberAttendances(member?.id);

  const attendances = useMemo(
    () => [...records].sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [records],
  );

  const updateTraining = (id: string, patch: Partial<TrainingItem>) => {
    onTrainingsChange(trainings.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTraining = (id: string) => {
    onTrainingsChange(trainings.filter((t) => t.id !== id));
  };
  const addTraining = () => {
    onTrainingsChange([...trainings, { id: uid(), title: '', date: '', note: '' }]);
  };

  const updateEvaluation = (id: string, patch: Partial<EvaluationItem>) => {
    onEvaluationsChange(evaluations.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeEvaluation = (id: string) => {
    onEvaluationsChange(evaluations.filter((e) => e.id !== id));
  };
  const addEvaluation = () => {
    const year = String(new Date().getFullYear());
    onEvaluationsChange([...evaluations, { id: uid(), year, result: '', note: '' }]);
  };

  return (
    <div className="space-y-6">
      {/* Historique des présences (lecture seule, issu du pointage) */}
      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
          <span className="flex h-4 w-4 items-center justify-center text-foreground-400">
            <i className="ri-calendar-check-line"></i>
          </span>
          Historique des présences
        </h4>
        <p className="mb-3 text-xs text-foreground-400">
          Généré automatiquement depuis le système de pointage — aucune saisie manuelle.
        </p>

        {!member ? (
          <div className="rounded-lg border border-dashed border-background-200 bg-background-50 px-4 py-6 text-center text-sm text-foreground-400">
            L'historique apparaîtra dès que le membre sera créé et pointé lors d'événements.
          </div>
        ) : attendanceLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-background-200 bg-background-50 px-4 py-6 text-sm text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement des présences...
          </div>
        ) : attendances.length === 0 ? (
          <div className="rounded-lg border border-dashed border-background-200 bg-background-50 px-4 py-6 text-center text-sm text-foreground-400">
            Aucune présence enregistrée pour ce membre.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-background-100/60 px-3 py-2 text-xs text-foreground-600">
              <i className="ri-check-double-line text-foreground-500"></i>
              <span>
                {attendances.length} pointage{attendances.length > 1 ? 's' : ''} au total — dernier :{' '}
                <strong className="font-medium text-foreground-800">
                  {attendances[0].eventDate ? formatDateFr(attendances[0].eventDate) : '—'}
                </strong>
              </span>
            </div>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {attendances.slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-background-200 px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md bg-background-100">
                    <span className="text-xs font-bold leading-none text-foreground-900">
                      {a.eventDate ? a.eventDate.slice(8, 10) : '--'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground-800">{a.eventTitle}</p>
                    <p className="truncate text-[11px] text-foreground-400">{a.time}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      attendanceStatusStyle[a.status] ?? 'bg-background-100 text-foreground-500'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Formations suivies */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
            <span className="flex h-4 w-4 items-center justify-center text-foreground-400">
              <i className="ri-book-open-line"></i>
            </span>
            Formations suivies
          </h4>
          <button
            type="button"
            onClick={addTraining}
            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-200 px-2.5 py-1 text-xs font-medium text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-add-line"></i>
            Ajouter
          </button>
        </div>

        {trainings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-background-200 bg-background-50 px-4 py-4 text-center text-xs text-foreground-400">
            Aucune formation enregistrée.
          </p>
        ) : (
          <div className="space-y-2">
            {trainings.map((t) => (
              <div key={t.id} className="rounded-lg border border-background-200 bg-background-50 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]">
                  <input
                    className={inputClass(false)}
                    value={t.title}
                    onChange={(e) => updateTraining(t.id, { title: e.target.value })}
                    placeholder="Intitulé de la formation"
                  />
                  <input
                    type="date"
                    className={inputClass(false)}
                    value={t.date}
                    onChange={(e) => updateTraining(t.id, { date: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeTraining(t.id)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-accent-100 hover:text-accent-700"
                    title="Supprimer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
                <input
                  className={`${inputClass(false)} mt-2`}
                  value={t.note}
                  onChange={(e) => updateTraining(t.id, { note: e.target.value })}
                  placeholder="Note (optionnel)"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Évaluations annuelles */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
            <span className="flex h-4 w-4 items-center justify-center text-foreground-400">
              <i className="ri-star-line"></i>
            </span>
            Évaluations annuelles
          </h4>
          <button
            type="button"
            onClick={addEvaluation}
            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-200 px-2.5 py-1 text-xs font-medium text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-add-line"></i>
            Ajouter
          </button>
        </div>

        {evaluations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-background-200 bg-background-50 px-4 py-4 text-center text-xs text-foreground-400">
            Aucune évaluation enregistrée.
          </p>
        ) : (
          <div className="space-y-2">
            {evaluations.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-background-200 bg-background-50 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[120px_1fr_auto]">
                  <input
                    className={inputClass(false)}
                    value={ev.year}
                    onChange={(e) => updateEvaluation(ev.id, { year: e.target.value })}
                    placeholder="Année"
                  />
                  <input
                    className={inputClass(false)}
                    value={ev.result}
                    onChange={(e) => updateEvaluation(ev.id, { result: e.target.value })}
                    placeholder="Résultat / appréciation"
                  />
                  <button
                    type="button"
                    onClick={() => removeEvaluation(ev.id)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-accent-100 hover:text-accent-700"
                    title="Supprimer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
                <input
                  className={`${inputClass(false)} mt-2`}
                  value={ev.note}
                  onChange={(e) => updateEvaluation(ev.id, { note: e.target.value })}
                  placeholder="Note (optionnel)"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}