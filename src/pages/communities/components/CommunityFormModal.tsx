import { useEffect, useRef, useState } from 'react';
import type { Community } from '@/lib/types';
import { communityTypes } from '@/lib/constants';
import type { CommunityInput } from '@/hooks/useCommunities';
import { inputClass } from '@/components/base/formStyles';
import FormError from '@/components/base/FormError';
import FormField from '@/components/base/FormField';
import Portal from '@/components/base/Portal';

interface CommunityFormModalProps {
  open: boolean;
  editingCommunity: Community | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: CommunityInput) => void;
}

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const iconOptions = [
  'ri-mic-line',
  'ri-heart-3-line',
  'ri-flashlight-line',
  'ri-emotion-happy-line',
  'ri-women-line',
  'ri-men-line',
  'ri-door-open-line',
  'ri-tools-line',
  'ri-vidicon-line',
  'ri-megaphone-line',
  'ri-book-2-line',
  'ri-music-2-line',
  'ri-hand-heart-line',
  'ri-group-line',
];

const emptyForm = {
  name: '',
  type: 'Groupe',
  description: '',
  meetingDay: 'Dimanche',
  meetingTime: '',
  meetingLocation: '',
  icon: 'ri-group-line',
};

export default function CommunityFormModal({
  open,
  editingCommunity,
  submitting,
  error,
  onClose,
  onSave,
}: CommunityFormModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCountRef = useRef(0);
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) openCountRef.current += 1;
  prevOpenRef.current = open;
  const openCount = openCountRef.current;

  useEffect(() => {
    if (!open) return;
    if (editingCommunity) {
      setForm({
        name: editingCommunity.name,
        type: editingCommunity.type,
        description: editingCommunity.description,
        meetingDay: editingCommunity.meetingDay,
        meetingTime: editingCommunity.meetingTime,
        meetingLocation: editingCommunity.meetingLocation,
        icon: editingCommunity.icon,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [open, openCount, editingCommunity]);

  if (!open) return null;

  const update = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Le nom est requis';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      meetingDay: form.meetingDay,
      meetingTime: form.meetingTime,
      meetingLocation: form.meetingLocation.trim(),
      icon: form.icon,
    });
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-end p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose}></div>
      <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background-50 shadow-2xl animate-fade-up">
        <div className="flex shrink-0 items-center justify-between border-b border-background-200 px-6 py-4">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={editingCommunity ? 'ri-edit-line' : 'ri-add-line'}></i>
            </span>
            {editingCommunity ? 'Modifier la communauté' : 'Nouvelle communauté'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-4">
          <FormError message={error} />

          <FormField label="Nom" icon="ri-group-line" required error={errors.name}>
            <input className={inputClass(!!errors.name)} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex : Chorale" />
          </FormField>

          <FormField label="Type" icon="ri-shapes-line">
            <select className={inputClass(false)} value={form.type} onChange={(e) => update('type', e.target.value)}>
              {communityTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Description" icon="ri-file-text-line">
            <textarea
              className={`${inputClass(false)} resize-none`}
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Décrivez la mission de cette communauté..."
            />
            <p className="mt-1 text-right text-xs text-foreground-400">{form.description.length}/500</p>
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Jour de réunion" icon="ri-calendar-line">
              <select className={inputClass(false)} value={form.meetingDay} onChange={(e) => update('meetingDay', e.target.value)}>
                {daysOfWeek.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Heure" icon="ri-time-line">
              <input type="time" className={inputClass(false)} value={form.meetingTime} onChange={(e) => update('meetingTime', e.target.value)} />
            </FormField>
            <FormField label="Lieu" icon="ri-map-pin-line">
              <input className={inputClass(false)} value={form.meetingLocation} onChange={(e) => update('meetingLocation', e.target.value)} placeholder="Salle..." />
            </FormField>
          </div>

          <FormField label="Icône" icon="ri-palette-line">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => update('icon', icon)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                    form.icon === icon
                      ? 'border-primary-400 bg-primary-100 text-primary-700'
                      : 'border-background-200 text-foreground-500 hover:bg-background-100'
                  }`}
                >
                  <i className={`${icon} text-lg`}></i>
                </button>
              ))}
            </div>
          </FormField>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-background-200 px-6 py-4">
          <button
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
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
                {editingCommunity ? 'Enregistrer' : 'Créer la communauté'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}