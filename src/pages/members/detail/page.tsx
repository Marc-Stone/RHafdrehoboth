import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { useMembers } from '@/hooks/useMembers';
import { useCommunities } from '@/hooks/useCommunities';
import { useAuth } from '@/hooks/useAuth';
import { canAccessMedicalData } from '@/lib/permissions';
import { getPrivateDocumentUrl } from '@/lib/storage';
import { readAvatarAsDataUrl } from '@/utils/file';
import { formatDateShort } from '@/utils/date';
import type { Member } from '@/lib/types';
import MemberCard from '../components/MemberCard';
import LazyImage from '@/components/base/LazyImage';
import AttendanceHistory from './components/AttendanceHistory';

const statusStyle: Record<Member['status'], string> = {
  Actif: 'bg-primary-100 text-primary-700',
  Inactif: 'bg-secondary-100 text-secondary-700',
  Suspendu: 'bg-accent-100 text-accent-700',
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-foreground-400">{label}</p>
      <p className="mt-0.5 text-sm text-foreground-900">{value || 'Non renseigné'}</p>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-5">
      <h3 className="mb-4 flex items-center gap-1.5 font-heading text-base font-semibold text-foreground-900">
        <span className="flex h-4 w-4 items-center justify-center text-foreground-400">
          <i className={icon}></i>
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function MemberDetailPage() {
  const { number } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // On n'a pas besoin de charger toute la liste des membres sur la fiche :
  // on interroge directement le membre demandé (plus rapide, moins de données).
  const { findMemberByNumber, updateMemberPhoto, removeMemberPhoto, fetchMedicalHistory } = useMembers({ autoLoad: false });
  const { communities } = useCommunities();
  const isLeader = user?.role === 'community_leader';
  const canManageMedical = canAccessMedicalData(user?.role ?? 'attendance_agent');
  const qrRef = useRef<HTMLDivElement>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [medicalHistory, setMedicalHistory] = useState('');
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMedicalHistory('');
    setIdDocUrl(null);
    findMemberByNumber(number ?? '')
      .then((m) => {
        if (!active) return;
        setMember(m);
        if (m && canManageMedical) {
          void fetchMedicalHistory(m.id).then((history) => {
            if (active) setMedicalHistory(history);
          });
          if (m.idDocumentPath) {
            void getPrivateDocumentUrl(m.idDocumentPath).then((url) => {
              if (active && url) setIdDocUrl(url);
            });
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [number, findMemberByNumber, fetchMedicalHistory, canManageMedical]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-foreground-500">
        <div className="flex items-center gap-2">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          <span className="text-sm">Chargement du membre...</span>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
          <i className="ri-user-search-line text-3xl"></i>
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold text-foreground-950">Membre introuvable</h1>
        <p className="mt-2 text-sm text-foreground-500">Ce membre n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => navigate('/members')}
          className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
        >
          <i className="ri-arrow-left-line"></i>
          Retour aux membres
        </button>
      </div>
    );
  }

  const photo = member.photoUrl;
  const communityNames = member.communityIds
    .map((id) => communities.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
  // Repli si la communauté n'est pas encore chargée (ou supprimée) : on affiche
  // au moins la communauté principale renvoyée par la base.
  const displayCommunities =
    communityNames.length > 0
      ? communityNames
      : member.community && member.community !== '—' && member.community !== '-'
        ? [member.community]
        : [];

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR-${member.number}.png`;
      link.click();
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const dataUrl = await readAvatarAsDataUrl(file);
      const res = await updateMemberPhoto(member.id, member.number, dataUrl);
      if (res.error) {
        setPhotoError(res.error);
      } else {
        const refreshed = await findMemberByNumber(member.number);
        if (refreshed) setMember(refreshed);
      }
    } catch {
      setPhotoError("Impossible de lire cette image.");
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoError('');
    const res = await removeMemberPhoto(member.id, member.number);
    if (res.error) {
      setPhotoError(res.error);
    } else {
      const refreshed = await findMemberByNumber(member.number);
      if (refreshed) setMember(refreshed);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/members')}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-background-200 text-foreground-600 hover:bg-background-100"
          >
            <i className="ri-arrow-left-line text-lg"></i>
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <LazyImage
                src={photo}
                alt={`${member.firstName} ${member.lastName}`}
                containerClassName="h-12 w-12 rounded-full border border-background-200 bg-accent-100"
                fallback={
                  <span className="text-lg font-bold text-accent-700">
                    {member.firstName.charAt(0)}
                    {member.lastName.charAt(0)}
                  </span>
                }
              />
              {!isLeader && (
                <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-background-50 bg-primary-500 text-background-50 hover:bg-primary-600">
                  <i className="ri-camera-line text-xs"></i>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-foreground-950">
                {member.firstName} {member.lastName}
              </h1>
              <p className="text-sm text-foreground-500">
                {member.number} · {member.community}
              </p>
              {photo && !isLeader && (
                <button
                  onClick={handleRemovePhoto}
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700"
                >
                  <i className="ri-delete-bin-line"></i>
                  Retirer la photo
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadQR}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-download-line"></i>
            Télécharger le QR
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-printer-line"></i>
            Imprimer la carte
          </button>
        </div>
      </div>

      {photoError && (
        <div className="rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <i className="ri-error-warning-line"></i>
            </span>
            <p>{photoError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Identité" icon="ri-profile-line">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoItem label="Sexe" value={member.gender} />
              <InfoItem label="Date de naissance" value={member.birthDate ? formatDateShort(member.birthDate) : ''} />
              <InfoItem label="Statut" value={member.status} />
              <InfoItem label="Situation matrimoniale" value={member.maritalStatus} />
              <InfoItem label="Profession" value={member.profession} />
              <InfoItem label="Date de baptême" value={member.baptismDate ? formatDateShort(member.baptismDate) : ''} />
            </div>
          </SectionCard>

          <SectionCard title="Contact" icon="ri-phone-line">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label="Téléphone" value={member.phone} />
              <InfoItem label="Email" value={member.email} />
              <InfoItem label="Adresse" value={member.address} />
              <InfoItem label="Quartier" value={member.neighborhood} />
              <InfoItem label="Commune" value={member.commune} />
              <InfoItem label="Groupe sanguin" value={member.bloodGroup} />
            </div>
            <div className="mt-4 border-t border-background-100 pt-4">
              <p className="mb-2 text-xs font-medium text-foreground-400">Contact d'urgence</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InfoItem label="Nom" value={member.emergencyContactName} />
                <InfoItem label="Téléphone" value={member.emergencyContactPhone} />
                <InfoItem label="Lien de parenté" value={member.emergencyContactRelationship} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Situation personnelle" icon="ri-heart-line">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label="Situation de vie" value={member.livingSituation} />
              <InfoItem label="Allergies / santé" value={member.allergies} />
              <InfoItem label="Talents / ministères" value={member.talents} />
              <InfoItem label="Remarques" value={member.notes} />
            </div>
            {canManageMedical && (
              <div className="mt-4 border-t border-background-100 pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground-400">
                  <i className="ri-lock-line"></i>
                  Antécédents médicaux (donnée sensible)
                </p>
                <p className="text-sm text-foreground-900">
                  {medicalHistory || 'Non renseigné'}
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Affectation" icon="ri-group-line">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-foreground-400">Communautés</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {displayCommunities.length > 0 ? (
                    displayCommunities.map((name) => (
                      <span key={name} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-foreground-500">Non renseigné</span>
                  )}
                </div>
              </div>
              <InfoItem label="Rôle dans l'église" value={member.churchRole} />
              <InfoItem label="Département / service" value={member.department} />
              <InfoItem label="Responsable" value={member.leader} />
              <InfoItem label="Date d'entrée en service" value={member.integrationDate ? formatDateShort(member.integrationDate) : ''} />
              <InfoItem label="Numéro matricule" value={member.matricule} />
            </div>
          </SectionCard>

          {canManageMedical && member.idDocumentPath && (
            <SectionCard title="Pièce d'identité" icon="ri-file-user-line">
              <p className="mb-3 text-xs text-foreground-400">
                Document stocké de façon sécurisée — jamais affiché publiquement.
              </p>
              {idDocUrl ? (
                <a
                  href={idDocUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-100"
                >
                  <i className="ri-external-link-line"></i>
                  Consulter le document
                </a>
              ) : (
                <p className="text-sm text-foreground-500">Chargement du document...</p>
              )}
            </SectionCard>
          )}

          {(member.trainings.length > 0 || member.evaluations.length > 0) && (
            <SectionCard title="Formations & évaluations" icon="ri-award-line">
              {member.trainings.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-foreground-400">Formations suivies</p>
                  <div className="space-y-1.5">
                    {member.trainings.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <i className="ri-book-open-line text-foreground-400"></i>
                        <span className="text-foreground-800">{t.title || 'Sans titre'}</span>
                        {t.date && <span className="text-xs text-foreground-400">{formatDateShort(t.date)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {member.evaluations.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-foreground-400">Évaluations annuelles</p>
                  <div className="space-y-1.5">
                    {member.evaluations.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-2 text-sm">
                        <i className="ri-star-line text-foreground-400"></i>
                        <span className="font-medium text-foreground-800">{ev.year}</span>
                        <span className="text-foreground-600">{ev.result || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-background-200 bg-background-50 p-5 text-center">
            <h3 className="mb-4 font-heading text-base font-semibold text-foreground-900">QR Code personnel</h3>
            <div ref={qrRef} className="inline-block rounded-xl border border-background-200 bg-white p-3">
              <QRCodeCanvas value={member.number} size={160} level="M" includeMargin bgColor="#ffffff" fgColor="#1c1917" />
            </div>
            <p className="mt-3 text-xs text-foreground-400">
              Identifiant unique : <span className="font-mono text-foreground-600">{member.number}</span>
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-heading text-base font-semibold text-foreground-900">Carte de membre (A6)</h3>
            <MemberCard member={member} />
          </div>
        </div>
      </div>

      <AttendanceHistory member={member} />
    </div>
  );
}