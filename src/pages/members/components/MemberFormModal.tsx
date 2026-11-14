import { useEffect, useRef, useState } from 'react';
import type { Member, MemberInput, Community, TrainingItem, EvaluationItem } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import {
  maritalStatusOptions,
  memberStatusOptions,
  livingSituationOptions,
  emergencyRelationshipOptions,
  churchRoleOptions,
} from '@/lib/constants';
import { inputClass } from '@/components/base/formStyles';
import { canAccessMedicalData } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { getPrivateDocumentUrl } from '@/lib/storage';
import FormError from '@/components/base/FormError';
import FormField from '@/components/base/FormField';
import FileUploadField from './FileUploadField';
import FollowUpTab from './FollowUpTab';
import Portal from '@/components/base/Portal';

interface MemberFormModalProps {
  open: boolean;
  editingMember: Member | null;
  communities: Community[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: MemberInput) => void;
}

type TabKey = 'identite' | 'contact' | 'situation' | 'affectation' | 'suivi';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'identite', label: 'Identité', icon: 'ri-profile-line' },
  { key: 'contact', label: 'Contact', icon: 'ri-phone-line' },
  { key: 'situation', label: 'Situation', icon: 'ri-heart-line' },
  { key: 'affectation', label: 'Affectation', icon: 'ri-group-line' },
  { key: 'suivi', label: 'Suivi', icon: 'ri-history-line' },
];

interface FormState {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  commune: string;
  profession: string;
  maritalStatus: string;
  livingSituation: string;
  integrationDate: string;
  baptismDate: string;
  communityIds: string[];
  department: string;
  churchRole: string;
  matricule: string;
  leader: string;
  status: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  bloodGroup: string;
  allergies: string;
  talents: string;
  notes: string;
  medicalHistory: string;
  trainings: TrainingItem[];
  evaluations: EvaluationItem[];
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  gender: 'Homme',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  neighborhood: '',
  commune: '',
  profession: '',
  maritalStatus: 'Célibataire',
  livingSituation: 'Vit avec sa famille',
  integrationDate: '',
  baptismDate: '',
  communityIds: [],
  department: '',
  churchRole: '',
  matricule: '',
  leader: '',
  status: 'Actif',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: 'Conjoint(e)',
  bloodGroup: '',
  allergies: '',
  talents: '',
  notes: '',
  medicalHistory: '',
  trainings: [],
  evaluations: [],
};

function SectionHeading({ icon, children }: { icon: string; children: string }) {
  return (
    <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
      <span className="flex h-4 w-4 items-center justify-center text-foreground-400">
        <i className={icon}></i>
      </span>
      {children}
    </h4>
  );
}

export default function MemberFormModal({
  open,
  editingMember,
  communities,
  submitting,
  error,
  onClose,
  onSave,
}: MemberFormModalProps) {
  const { user } = useAuth();
  const canManageMedical = canAccessMedicalData(user?.role ?? 'attendance_agent');

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabKey>('identite');
  // Empêche d'enregistrer avant d'avoir chargé les antécédents médicaux réels
  // (sinon un enregistrement écraserait la donnée existante par une chaîne vide).
  const [medicalReady, setMedicalReady] = useState(true);
  // Échec de chargement : sans ce garde-fou, un simple problème réseau
  // laissait le champ vide et « Enregistrer » effaçait la donnée sensible.
  const [medicalError, setMedicalError] = useState<string | null>(null);
  const [medicalReload, setMedicalReload] = useState(0);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);
  const [idDocChanged, setIdDocChanged] = useState(false);
  const [idDocRemoved, setIdDocRemoved] = useState(false);

  const openCountRef = useRef(0);
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    openCountRef.current += 1;
  }
  prevOpenRef.current = open;
  const openCount = openCountRef.current;

  useEffect(() => {
    if (!open) return;
    setTab('identite');
    setErrors({});
    setMedicalError(null);
    setPhotoChanged(false);
    setPhotoRemoved(false);
    setIdDocChanged(false);
    setIdDocRemoved(false);

    if (editingMember) {
      setForm({
        firstName: editingMember.firstName,
        lastName: editingMember.lastName,
        gender: editingMember.gender,
        birthDate: editingMember.birthDate ?? '',
        phone: editingMember.phone,
        email: editingMember.email,
        address: editingMember.address,
        neighborhood: editingMember.neighborhood,
        commune: editingMember.commune,
        profession: editingMember.profession,
        maritalStatus: editingMember.maritalStatus,
        livingSituation: editingMember.livingSituation,
        integrationDate: editingMember.integrationDate ?? '',
        baptismDate: editingMember.baptismDate ?? '',
        communityIds: editingMember.communityIds.length > 0 ? editingMember.communityIds : editingMember.communityId ? [editingMember.communityId] : [],
        department: editingMember.department,
        churchRole: editingMember.churchRole,
        matricule: editingMember.matricule,
        leader: editingMember.leader,
        status: editingMember.status,
        emergencyContactName: editingMember.emergencyContactName,
        emergencyContactPhone: editingMember.emergencyContactPhone,
        emergencyContactRelationship: editingMember.emergencyContactRelationship,
        bloodGroup: editingMember.bloodGroup,
        allergies: editingMember.allergies,
        talents: editingMember.talents,
        notes: editingMember.notes,
        medicalHistory: editingMember.medicalHistory,
        trainings: editingMember.trainings,
        evaluations: editingMember.evaluations,
      });
      setPhotoPreview(editingMember.photoUrl);

      // Chargement des antécédents médicaux réels (table séparée, RLS restreint).
      // Sans cela, `medicalHistory` resterait vide et l'enregistrement effacerait
      // la donnée sensible existante.
      if (canManageMedical) {
        setMedicalReady(false);
        setMedicalError(null);
        void Promise.resolve(
          supabase
            .from('member_medical')
            .select('medical_history')
            .eq('member_id', editingMember.id)
            .maybeSingle(),
        )
          .then(({ data, error: medErr }) => {
            if (medErr) {
              setMedicalError(
                "Impossible de charger les antécédents médicaux. L'enregistrement est bloqué pour ne pas les effacer.",
              );
              return;
            }
            const history = (data as { medical_history: string | null } | null)?.medical_history ?? '';
            if (history) {
              setForm((prev) => ({ ...prev, medicalHistory: history }));
            }
            setMedicalReady(true);
          })
          .catch(() => {
            setMedicalError(
              "Impossible de charger les antécédents médicaux. L'enregistrement est bloqué pour ne pas les effacer.",
            );
          });
      } else {
        setMedicalReady(true);
      }

      // Chargement de l'aperçu de la pièce d'identité (URL signée temporaire).
      setIdDocPreview(null);
      if (editingMember.idDocumentPath) {
        void getPrivateDocumentUrl(editingMember.idDocumentPath).then((url) => {
          if (url) setIdDocPreview(url);
        });
      }
    } else {
      setForm(emptyForm);
      setPhotoPreview(null);
      setIdDocPreview(null);
      setMedicalReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openCount, editingMember, medicalReload]);

  if (!open) return null;

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCommunity = (id: string) => {
    setForm((prev) => {
      const has = prev.communityIds.includes(id);
      return {
        ...prev,
        communityIds: has ? prev.communityIds.filter((c) => c !== id) : [...prev.communityIds, id],
      };
    });
  };

  const handleSubmit = () => {
    // Ne jamais enregistrer tant que les antécédents médicaux ne sont pas chargés.
    if (editingMember && canManageMedical && !medicalReady) return;
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = 'Le prénom est requis';
    if (!form.lastName.trim()) newErrors.lastName = 'Le nom est requis';
    if (form.communityIds.length === 0) newErrors.communityIds = 'Sélectionnez au moins une communauté';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorTab =
        newErrors.firstName || newErrors.lastName ? 'identite' : 'affectation';
      setTab(firstErrorTab);
      return;
    }

    onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      birthDate: form.birthDate || null,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      neighborhood: form.neighborhood.trim(),
      commune: form.commune.trim(),
      profession: form.profession.trim(),
      maritalStatus: form.maritalStatus,
      livingSituation: form.livingSituation,
      integrationDate: form.integrationDate || null,
      baptismDate: form.baptismDate || null,
      communityIds: form.communityIds,
      department: form.department.trim(),
      churchRole: form.churchRole.trim(),
      matricule: form.matricule.trim(),
      leader: form.leader.trim(),
      status: form.status as Member['status'],
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactPhone: form.emergencyContactPhone.trim(),
      emergencyContactRelationship: form.emergencyContactRelationship,
      bloodGroup: form.bloodGroup.trim(),
      allergies: form.allergies.trim(),
      talents: form.talents.trim(),
      notes: form.notes.trim(),
      medicalHistory: form.medicalHistory.trim(),
      trainings: form.trainings,
      evaluations: form.evaluations,
      saveMedical: canManageMedical,
      photoDataUrl: photoChanged ? photoPreview : null,
      photoRemoved,
      idDocumentDataUrl: idDocChanged ? idDocPreview : null,
      idDocumentRemoved: idDocRemoved,
    });
  };

  const activeIndex = TABS.findIndex((t) => t.key === tab);

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-end p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose}></div>
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background-50 shadow-2xl animate-fade-up">
        {/* En-tête */}
        <div className="flex shrink-0 items-center justify-between border-b border-background-200 px-5 py-3.5 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={editingMember ? 'ri-user-line' : 'ri-user-add-line'}></i>
            </span>
            <div>
              <h2 className="font-heading text-base font-bold text-foreground-950">
                {editingMember ? 'Modifier le membre' : 'Ajouter un membre'}
              </h2>
              <p className="text-xs text-foreground-500">
                {editingMember ? editingMember.number : 'Numéro généré automatiquement'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Onglets */}
        <div className="shrink-0 border-b border-background-200 bg-background-50">
          <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 md:px-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-primary-500 text-background-50'
                    : 'text-foreground-600 hover:bg-background-100'
                }`}
              >
                <i className={`${t.icon} text-sm`}></i>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div key={tab} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 md:px-6 animate-fade-in">
          <FormError message={error} />

          {medicalError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                <i className="ri-error-warning-line"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p>{medicalError}</p>
                <button
                  type="button"
                  onClick={() => setMedicalReload((n) => n + 1)}
                  className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 px-2.5 py-1 text-xs font-semibold text-accent-800 hover:bg-accent-100"
                >
                  <i className="ri-refresh-line"></i>
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {tab === 'identite' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-lg bg-background-100/60 px-3 py-2.5 text-xs text-foreground-600">
                <span className="flex h-4 w-4 items-center justify-center text-foreground-400">
                  <i className="ri-fingerprint-line"></i>
                </span>
                <span>
                  Numéro de membre :{' '}
                  <strong className="font-mono font-medium text-foreground-800">
                    {editingMember ? editingMember.number : 'généré automatiquement'}
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Prénom" icon="ri-user-line" required error={errors.firstName}>
                  <input
                    className={inputClass(!!errors.firstName)}
                    value={form.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    placeholder="Prénom"
                  />
                </FormField>
                <FormField label="Nom" icon="ri-user-line" required error={errors.lastName}>
                  <input
                    className={inputClass(!!errors.lastName)}
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    placeholder="Nom"
                  />
                </FormField>
                <FormField label="Sexe" icon="ri-women-line">
                  <select className={inputClass(false)} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="Homme">Homme</option>
                    <option value="Femme">Femme</option>
                  </select>
                </FormField>
                <FormField label="Date de naissance" icon="ri-cake-line">
                  <input type="date" className={inputClass(false)} value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FileUploadField
                  label="Photo d'identité"
                  icon="ri-camera-line"
                  mode="avatar"
                  hint="Photo récente, format image."
                  preview={photoPreview}
                  onFile={(dataUrl) => {
                    setPhotoPreview(dataUrl);
                    setPhotoChanged(true);
                    setPhotoRemoved(false);
                  }}
                  onRemove={() => {
                    setPhotoPreview(null);
                    setPhotoChanged(false);
                    setPhotoRemoved(true);
                  }}
                />
                <FileUploadField
                  label="Pièce d'identité"
                  icon="ri-file-user-line"
                  mode="document"
                  hint="Stockée de façon sécurisée (jamais publique)."
                  preview={idDocPreview}
                  onFile={(dataUrl) => {
                    setIdDocPreview(dataUrl);
                    setIdDocChanged(true);
                    setIdDocRemoved(false);
                  }}
                  onRemove={() => {
                    setIdDocPreview(null);
                    setIdDocChanged(false);
                    setIdDocRemoved(true);
                  }}
                />
              </div>
            </div>
          )}

          {tab === 'contact' && (
            <div className="space-y-5">
              <div>
                <SectionHeading icon="ri-phone-line">Coordonnées</SectionHeading>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Téléphone" icon="ri-phone-line">
                    <input className={inputClass(false)} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+225 07 00 00 00 00" />
                  </FormField>
                  <FormField label="Email" icon="ri-mail-line">
                    <input type="email" className={inputClass(false)} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="prenom.nom@eglise.org" />
                  </FormField>
                  <FormField label="Adresse" icon="ri-map-pin-line" className="sm:col-span-2">
                    <input className={inputClass(false)} value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Rue, avenue..." />
                  </FormField>
                  <FormField label="Quartier" icon="ri-home-line">
                    <input className={inputClass(false)} value={form.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} placeholder="Quartier" />
                  </FormField>
                  <FormField label="Commune" icon="ri-building-line">
                    <input className={inputClass(false)} value={form.commune} onChange={(e) => update('commune', e.target.value)} placeholder="Commune" />
                  </FormField>
                </div>
              </div>

              <div>
                <SectionHeading icon="ri-contacts-line">Contact d'urgence</SectionHeading>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Nom du contact" icon="ri-user-line">
                    <input className={inputClass(false)} value={form.emergencyContactName} onChange={(e) => update('emergencyContactName', e.target.value)} placeholder="Nom du contact" />
                  </FormField>
                  <FormField label="Téléphone du contact" icon="ri-phone-line">
                    <input className={inputClass(false)} value={form.emergencyContactPhone} onChange={(e) => update('emergencyContactPhone', e.target.value)} placeholder="Téléphone du contact" />
                  </FormField>
                  <FormField label="Lien de parenté" icon="ri-links-line" className="sm:col-span-2">
                    <select className={inputClass(false)} value={form.emergencyContactRelationship} onChange={(e) => update('emergencyContactRelationship', e.target.value)}>
                      {emergencyRelationshipOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {tab === 'situation' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Profession" icon="ri-briefcase-line">
                <input className={inputClass(false)} value={form.profession} onChange={(e) => update('profession', e.target.value)} placeholder="Profession" />
              </FormField>
              <FormField label="Situation matrimoniale" icon="ri-hearts-line">
                <select className={inputClass(false)} value={form.maritalStatus} onChange={(e) => update('maritalStatus', e.target.value)}>
                  {maritalStatusOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Situation de vie" icon="ri-home-heart-line">
                <select className={inputClass(false)} value={form.livingSituation} onChange={(e) => update('livingSituation', e.target.value)}>
                  {livingSituationOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Date de baptême" icon="ri-water-flash-line">
                <input type="date" className={inputClass(false)} value={form.baptismDate} onChange={(e) => update('baptismDate', e.target.value)} />
              </FormField>
              <FormField label="Groupe sanguin" icon="ri-drop-line">
                <input className={inputClass(false)} value={form.bloodGroup} onChange={(e) => update('bloodGroup', e.target.value)} placeholder="A+, O-, ..." />
              </FormField>
              <FormField label="Allergies / santé" icon="ri-hospital-line">
                <input className={inputClass(false)} value={form.allergies} onChange={(e) => update('allergies', e.target.value)} placeholder="Allergies, traitements..." />
              </FormField>
              <FormField label="Talents / ministères" icon="ri-magic-line">
                <input className={inputClass(false)} value={form.talents} onChange={(e) => update('talents', e.target.value)} placeholder="Chant, enseignement..." />
              </FormField>
              <FormField label="Remarques" icon="ri-sticky-note-line" className="sm:col-span-2">
                <textarea rows={2} className={inputClass(false)} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Notes libres" />
              </FormField>

              {canManageMedical && (
                <FormField
                  label="Antécédents médicaux"
                  icon="ri-health-book-line"
                  hint="Donnée sensible : accessible uniquement aux rôles autorisés et journalisée."
                  className="sm:col-span-2"
                >
                  <textarea
                    rows={3}
                    className={inputClass(false)}
                    value={form.medicalHistory}
                    onChange={(e) => update('medicalHistory', e.target.value)}
                    placeholder="Antécédents médicaux, traitements en cours..."
                  />
                </FormField>
              )}
            </div>
          )}

          {tab === 'affectation' && (
            <div className="space-y-5">
              <div>
                <SectionHeading icon="ri-group-line">Communautés</SectionHeading>
                {errors.communityIds && (
                  <p className="mb-2 flex items-center gap-1 text-xs text-accent-600">
                    <i className="ri-error-warning-line"></i>
                    {errors.communityIds}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {communities.map((c) => {
                    const checked = form.communityIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                          checked
                            ? 'border-primary-400 bg-primary-100/60'
                            : 'border-background-200 bg-background-50 hover:bg-background-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCommunity(c.id)}
                          className="h-4 w-4 cursor-pointer rounded accent-[oklch(var(--primary-500))]"
                        />
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background-100 text-foreground-500">
                          <i className={`${c.icon || 'ri-group-line'} text-sm`}></i>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground-800">
                          {c.name}
                        </span>
                        {checked && (
                          <i className="ri-check-line shrink-0 text-primary-600"></i>
                        )}
                      </label>
                    );
                  })}
                </div>
                {communities.length === 0 && (
                  <p className="text-xs text-foreground-400">Aucune communauté disponible.</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Rôle dans l'église" icon="ri-shield-star-line">
                  <input
                    className={inputClass(false)}
                    list="church-role-options"
                    value={form.churchRole}
                    onChange={(e) => update('churchRole', e.target.value)}
                    placeholder="Ex. Pasteur, Diacre, Leader..."
                  />
                  <datalist id="church-role-options">
                    {churchRoleOptions.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </FormField>
                <FormField label="Département / service" icon="ri-briefcase-2-line">
                  <input className={inputClass(false)} value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="Ex. Accueil, Chorale..." />
                </FormField>
                <FormField label="Responsable" icon="ri-user-star-line">
                  <input className={inputClass(false)} value={form.leader} onChange={(e) => update('leader', e.target.value)} placeholder="Nom du responsable" />
                </FormField>
                <FormField label="Date d'entrée en service" icon="ri-calendar-check-line">
                  <input type="date" className={inputClass(false)} value={form.integrationDate} onChange={(e) => update('integrationDate', e.target.value)} />
                </FormField>
                <FormField label="Numéro matricule" icon="ri-barcode-line">
                  <input className={inputClass(false)} value={form.matricule} onChange={(e) => update('matricule', e.target.value)} placeholder="Matricule" />
                </FormField>
                <FormField label="Statut" icon="ri-shield-line">
                  <select className={inputClass(false)} value={form.status} onChange={(e) => update('status', e.target.value)}>
                    {memberStatusOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>
          )}

          {tab === 'suivi' && (
            <FollowUpTab
              member={editingMember}
              trainings={form.trainings}
              evaluations={form.evaluations}
              onTrainingsChange={(items) => setForm((prev) => ({ ...prev, trainings: items }))}
              onEvaluationsChange={(items) => setForm((prev) => ({ ...prev, evaluations: items }))}
            />
          )}
        </div>

        {/* Pied de page */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-background-200 px-5 py-3.5 md:px-6">
          <span className="hidden text-xs text-foreground-400 sm:block">
            Étape {activeIndex + 1} sur {TABS.length}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (editingMember !== null && canManageMedical && !medicalReady)}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Enregistrement...
                </>
              ) : (
                <>
                  <i className="ri-check-line"></i>
                  {editingMember ? 'Enregistrer' : 'Ajouter le membre'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}