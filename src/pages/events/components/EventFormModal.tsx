import { useEffect, useRef, useState } from 'react';
import type { ChurchEvent, EventInput, EventSessionInput } from '@/lib/types';
import type { Community } from '@/lib/types';
import { inputClass } from '@/components/base/formStyles';
import FormError from '@/components/base/FormError';
import FormField from '@/components/base/FormField';
import Portal from '@/components/base/Portal';

interface EventFormModalProps {
  open: boolean;
  editingEvent: ChurchEvent | null;
  editingSessions: ChurchEvent[];
  communities: Community[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: EventInput) => void;
}

interface SessionFormEntry {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  presentEndTime: string;
  absentStartTime: string;
  communityId: string;
}

interface EventFormState {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  presentEndTime: string;
  absentStartTime: string;
  location: string;
  communityId: string;
  description: string;
}

/** Fabrique un formulaire vierge : évite de partager une même référence
 * d'objet entre deux ouvertures (source de valeurs résiduelles). */
function createEmptyForm(): EventFormState {
  return {
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    presentEndTime: '',
    absentStartTime: '',
    location: '',
    communityId: '',
    description: '',
  };
}

const newSession = (): SessionFormEntry => ({
  title: '',
  startTime: '',
  endTime: '',
  presentEndTime: '',
  absentStartTime: '',
  communityId: '',
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeErrors(s: {
  startTime: string;
  endTime: string;
  presentEndTime: string;
  absentStartTime: string;
}): Record<string, string> {
  const errs: Record<string, string> = {};
  if (s.startTime && s.presentEndTime && timeToMinutes(s.presentEndTime) < timeToMinutes(s.startTime)) {
    errs.presentEndTime = "Doit être après l'heure de début";
  }
  if (s.presentEndTime && s.absentStartTime && timeToMinutes(s.absentStartTime) < timeToMinutes(s.presentEndTime)) {
    errs.absentStartTime = "Doit être après l'heure de fin des présents";
  }
  if (s.endTime && s.absentStartTime && timeToMinutes(s.absentStartTime) > timeToMinutes(s.endTime)) {
    errs.absentStartTime = "Doit être avant l'heure de fin";
  }
  return errs;
}

function SectionTitle({ icon, children }: { icon: string; children: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">
      <span className="flex h-5 w-5 items-center justify-center text-foreground-400">
        <i className={icon}></i>
      </span>
      {children}
    </h3>
  );
}

function TimeInputs({
  entry,
  error,
  onChange,
}: {
  entry: SessionFormEntry;
  error: Record<string, string>;
  onChange: (key: keyof SessionFormEntry, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Heure de début" icon="ri-play-circle-line">
        <input type="time" className={inputClass(false)} value={entry.startTime} onChange={(e) => onChange('startTime', e.target.value)} />
      </FormField>
      <FormField label="Heure de fin" icon="ri-stop-circle-line">
        <input type="time" className={inputClass(false)} value={entry.endTime} onChange={(e) => onChange('endTime', e.target.value)} />
      </FormField>
      <FormField
        label="Fin des présents"
        icon="ri-user-follow-line"
        error={error.presentEndTime}
        hint="Après cette heure, un pointage est compté comme retard"
      >
        <input type="time" className={inputClass(!!error.presentEndTime)} value={entry.presentEndTime} onChange={(e) => onChange('presentEndTime', e.target.value)} />
      </FormField>
      <FormField
        label="Début des absents"
        icon="ri-user-unfollow-line"
        error={error.absentStartTime}
        hint="Après cette heure, un pointage est compté comme absence"
      >
        <input type="time" className={inputClass(!!error.absentStartTime)} value={entry.absentStartTime} onChange={(e) => onChange('absentStartTime', e.target.value)} />
      </FormField>
    </div>
  );
}

export default function EventFormModal({
  open,
  editingEvent,
  editingSessions,
  communities,
  submitting,
  error,
  onClose,
  onSave,
}: EventFormModalProps) {
  const [form, setForm] = useState<EventFormState>(createEmptyForm);
  const [isMulti, setIsMulti] = useState(false);
  const [sessions, setSessions] = useState<SessionFormEntry[]>([newSession()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>[]>([]);

  const openCountRef = useRef(0);
  const prevOpenRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  if (open && !prevOpenRef.current) openCountRef.current += 1;
  prevOpenRef.current = open;
  const openCount = openCountRef.current;

  useEffect(() => {
    if (!open) return;
    if (editingEvent) {
      setForm({
        title: editingEvent.title,
        date: editingEvent.date,
        startTime: editingEvent.startTime,
        endTime: editingEvent.endTime,
        presentEndTime: editingEvent.presentEndTime,
        absentStartTime: editingEvent.absentStartTime,
        location: editingEvent.location,
        communityId: editingEvent.communityId ?? '',
        description: editingEvent.description,
      });
      const multi = editingEvent.isContainer;
      setIsMulti(multi);
      if (multi) {
        setSessions(
          editingSessions.length > 0
            ? editingSessions.map((s) => ({
                id: s.id,
                title: s.title,
                startTime: s.startTime,
                endTime: s.endTime,
                presentEndTime: s.presentEndTime,
                absentStartTime: s.absentStartTime,
                communityId: s.communityId ?? '',
              }))
            : [newSession()],
        );
      } else {
        setSessions([newSession()]);
      }
    } else {
      setForm(createEmptyForm());
      setIsMulti(false);
      setSessions([newSession()]);
    }
    setErrors({});
    setSessionErrors([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openCount, editingEvent]);

  // Échap ferme la fenêtre, sauf pendant l'enregistrement.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  // Un message d'erreur affiché en haut du formulaire deviendrait invisible
  // si la fenêtre était laissée sur une position de défilement basse.
  useEffect(() => {
    if (error && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  if (!open) return null;

  const requestClose = () => {
    if (submitting) return;
    onClose();
  };

  const update = (key: keyof EventFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // L'erreur du champ disparaît dès qu'on le corrige (avant, le contour
    // d'erreur restait affiché jusqu'au nouvel enregistrement).
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateSession = (index: number, key: keyof SessionFormEntry, value: string) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
    setSessionErrors((prev) => {
      const current = prev[index];
      if (!current || !current[key]) return prev;
      const next = [...prev];
      next[index] = { ...current };
      delete next[index][key];
      return next;
    });
  };

  const addSession = () => {
    setSessions((prev) => [...prev, newSession()]);
  };

  const removeSession = (index: number) => {
    setSessions((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Le titre est requis';
    if (!form.date) newErrors.date = 'La date est requise';

    const newSessionErrors: Record<string, string>[] = [];

    if (isMulti) {
      if (sessions.length === 0) {
        newErrors.sessions = 'Ajoutez au moins une session';
      }
      sessions.forEach((s, i) => {
        const se: Record<string, string> = {};
        if (!s.title.trim()) se.title = 'Le titre est requis';
        Object.assign(se, timeErrors(s));
        newSessionErrors[i] = se;
      });
    } else {
      Object.assign(newErrors, timeErrors(form));
    }

    const hasSessionErrors = newSessionErrors.some((se) => se && Object.keys(se).length > 0);
    if (Object.keys(newErrors).length > 0 || hasSessionErrors) {
      setErrors(newErrors);
      setSessionErrors(newSessionErrors);
      return;
    }

    const sessionsInput: EventSessionInput[] = isMulti
      ? sessions.map((s) => ({
          id: s.id,
          title: s.title.trim(),
          startTime: s.startTime,
          endTime: s.endTime,
          presentEndTime: s.presentEndTime,
          absentStartTime: s.absentStartTime,
          communityId: s.communityId || null,
        }))
      : [];

    onSave({
      title: form.title.trim(),
      date: form.date,
      startTime: isMulti ? '' : form.startTime,
      endTime: isMulti ? '' : form.endTime,
      presentEndTime: isMulti ? '' : form.presentEndTime,
      absentStartTime: isMulti ? '' : form.absentStartTime,
      location: form.location.trim(),
      description: form.description.trim(),
      communityId: form.communityId || null,
      isContainer: isMulti,
      sessions: sessionsInput,
    });
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-end p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={requestClose}></div>
      <div
        className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-background-200 bg-background-50 animate-fade-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-background-200 px-6 py-4">
          <h2 id="event-form-title" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={editingEvent ? 'ri-edit-line' : 'ri-add-line'}></i>
            </span>
            {editingEvent ? "Modifier l'événement" : 'Nouvel événement'}
          </h2>
          <button
            onClick={requestClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100"
            title="Fermer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 space-y-6 overflow-y-auto px-6 py-5">
          <FormError message={error} />

          {/* Informations générales */}
          <section className="space-y-4">
            <SectionTitle icon="ri-information-line">Informations générales</SectionTitle>

            <FormField label="Titre" icon="ri-calendar-event-line" required error={errors.title}>
              <input
                className={inputClass(!!errors.title)}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Ex : Culte du dimanche"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Lieu" icon="ri-map-pin-line">
                <input
                  className={inputClass(false)}
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="Salle ou lieu de réunion"
                />
              </FormField>
              <FormField label="Date" icon="ri-calendar-line" required error={errors.date}>
                <input
                  type="date"
                  className={inputClass(!!errors.date)}
                  value={form.date}
                  onChange={(e) => update('date', e.target.value)}
                />
              </FormField>
            </div>

            <FormField
              label="Communauté cible"
              icon="ri-group-line"
              hint={isMulti ? "Communauté par défaut des sessions qui n'en définissent pas" : undefined}
            >
              <select className={inputClass(false)} value={form.communityId} onChange={(e) => update('communityId', e.target.value)}>
                <option value="">Toute l'église</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          </section>

          {/* Type d'événement */}
          <section className="space-y-4">
            <SectionTitle icon="ri-stack-line">Structure de l'événement</SectionTitle>
            <button
              type="button"
              onClick={() => setIsMulti((v) => !v)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors ${
                isMulti ? 'border-primary-300 bg-primary-100/50' : 'border-background-200 bg-background-50 hover:bg-background-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isMulti ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-500'}`}>
                  <i className={isMulti ? 'ri-stack-line text-xl' : 'ri-calendar-event-line text-xl'}></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground-900">Événement en plusieurs parties</p>
                  <p className="text-xs text-foreground-500">
                    {isMulti
                      ? 'Chaque session a ses horaires et sa propre liste de présence'
                      : 'Un seul service avec une seule liste de présence'}
                  </p>
                </div>
              </div>
              <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isMulti ? 'bg-primary-500' : 'bg-background-200'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform ${isMulti ? 'translate-x-5' : 'translate-x-0.5'}`}></span>
              </span>
            </button>
            {isMulti && (
              <p className="flex items-start gap-2 rounded-lg border border-background-200 bg-background-100/60 px-3 py-2 text-xs text-foreground-600">
                <i className="ri-information-line mt-0.5"></i>
                <span>
                  Chaque session garde ses propres horaires : modifier l'une ne change jamais ceux de l'autre. Depuis
                  la liste des événements, le bouton « Reprendre » recopie les résultats d'une session précédente comme
                  base de travail pour la suivante.
                </span>
              </p>
            )}
            {!isMulti && editingEvent?.isContainer && editingSessions.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 px-3 py-2 text-xs text-accent-800">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>
                  En désactivant ce mode, les {editingSessions.length} session
                  {editingSessions.length === 1 ? '' : 's'} existante
                  {editingSessions.length === 1 ? '' : 's'} seront supprimées : l'événement redeviendra simple.
                </span>
              </p>
            )}
          </section>

          {isMulti ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionTitle icon="ri-play-list-2-line">{`Sessions (${sessions.length})`}</SectionTitle>
                <button
                  type="button"
                  onClick={addSession}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                >
                  <i className="ri-add-line"></i>
                  Ajouter une session
                </button>
              </div>
              {errors.sessions && <FormError message={errors.sessions} />}

              <div className="space-y-3">
                {sessions.map((s, i) => (
                  <div key={s.id ?? i} className="rounded-lg border border-background-200 bg-background-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-semibold text-foreground-600">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                          {i + 1}
                        </span>
                        Session
                      </span>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSession(i)}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-accent-100 hover:text-accent-700"
                          title="Retirer cette session"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      )}
                    </div>
                    <FormField label="Nom de la session" icon="ri-calendar-event-line" required error={sessionErrors[i]?.title}>
                      <input
                        className={inputClass(!!sessionErrors[i]?.title)}
                        value={s.title}
                        onChange={(e) => updateSession(i, 'title', e.target.value)}
                        placeholder="Ex : 1er culte"
                      />
                    </FormField>
                    <div className="mt-3">
                      <TimeInputs entry={s} error={sessionErrors[i] ?? {}} onChange={(key, value) => updateSession(i, key, value)} />
                    </div>
                    <div className="mt-3">
                      <FormField label="Communauté cible" icon="ri-group-line" hint="Laissez vide pour hériter de la communauté de l'événement">
                        <select
                          className={inputClass(false)}
                          value={s.communityId}
                          onChange={(e) => updateSession(i, 'communityId', e.target.value)}
                        >
                          <option value="">Par défaut (communauté de l'événement)</option>
                          {communities.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <SectionTitle icon="ri-time-line">Date et horaires</SectionTitle>

              <div className="rounded-lg border border-background-200 bg-background-50 p-4">
                <p className="mb-3 text-xs font-medium text-foreground-500">Horaires de l'événement</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Heure de début" icon="ri-play-circle-line">
                    <input type="time" className={inputClass(false)} value={form.startTime} onChange={(e) => update('startTime', e.target.value)} />
                  </FormField>
                  <FormField label="Heure de fin" icon="ri-stop-circle-line">
                    <input type="time" className={inputClass(false)} value={form.endTime} onChange={(e) => update('endTime', e.target.value)} />
                  </FormField>
                </div>
              </div>

              <div className="rounded-lg border border-background-200 bg-background-50 p-4">
                <p className="mb-1 text-xs font-medium text-foreground-500">Horaires de pointage</p>
                <p className="mb-3 text-xs text-foreground-400">
                  Ces horaires servent à déterminer automatiquement le statut des présences.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Fin des présents"
                    icon="ri-user-follow-line"
                    error={errors.presentEndTime}
                    hint="Après cette heure, un pointage est compté comme retard"
                  >
                    <input
                      type="time"
                      className={inputClass(!!errors.presentEndTime)}
                      value={form.presentEndTime}
                      onChange={(e) => update('presentEndTime', e.target.value)}
                    />
                  </FormField>
                  <FormField
                    label="Début des absents"
                    icon="ri-user-unfollow-line"
                    error={errors.absentStartTime}
                    hint="Après cette heure, un pointage est compté comme absence"
                  >
                    <input
                      type="time"
                      className={inputClass(!!errors.absentStartTime)}
                      value={form.absentStartTime}
                      onChange={(e) => update('absentStartTime', e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </section>
          )}

          {/* Description */}
          <section className="space-y-4">
            <SectionTitle icon="ri-file-text-line">Description</SectionTitle>
            <FormField label="Description">
              <textarea
                className={`${inputClass(false)} resize-none`}
                rows={2}
                maxLength={500}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Décrivez le déroulement de cet événement..."
              />
              <p className="mt-1 text-right text-xs text-foreground-400">{form.description.length}/500</p>
            </FormField>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-background-200 px-6 py-4">
          <button
            onClick={requestClose}
            disabled={submitting}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                Enregistrement...
              </>
            ) : (
              <>
                <i className="ri-check-line"></i>
                {editingEvent ? 'Enregistrer' : "Créer l'événement"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}