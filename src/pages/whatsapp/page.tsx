import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMembers } from '@/hooks/useMembers';
import { useCommunities } from '@/hooks/useCommunities';
import { useSettings } from '@/hooks/useSettings';
import { phoneForWhatsApp } from '@/utils/phone';
import PageHeader from '@/components/base/PageHeader';

interface MessageTemplate {
  key: string;
  label: string;
  text: string;
}

const TEMPLATES: MessageTemplate[] = [
  {
    key: 'rappel',
    label: 'Rappel de réunion',
    text: 'Bonjour, rappel : notre prochaine réunion de la communauté {communaute} aura lieu comme prévu. Merci de confirmer votre présence.',
  },
  {
    key: 'convocation',
    label: 'Convocation',
    text: 'Bonjour, vous êtes convoqué(e) à la réunion de la communauté {communaute} de {eglise}. Votre présence est attendue.',
  },
  {
    key: 'horaire',
    label: "Changement d'horaire",
    text: 'Bonjour, veuillez noter un changement d\'horaire pour la communauté {communaute}. Merci de vous renseigner auprès de votre responsable.',
  },
  {
    key: 'annonce',
    label: 'Annonce importante',
    text: 'Annonce importante de {eglise} à destination de la communauté {communaute} :',
  },
  {
    key: 'encouragement',
    label: 'Encouragement',
    text: 'Bonjour, que la paix soit avec vous ! Continuez à servir avec foi. La communauté {communaute} compte sur vous.',
  },
  {
    key: 'remerciement',
    label: 'Remerciement',
    text: 'Merci pour votre engagement au sein de la communauté {communaute}. Que Dieu vous bénisse.',
  },
  {
    key: 'presence',
    label: 'Demande de présence',
    text: 'Bonjour, votre présence est sollicitée à la prochaine rencontre de la communauté {communaute}. Merci de confirmer.',
  },
];

export default function WhatsAppPage() {
  const { user } = useAuth();
  const { members } = useMembers();
  const { communities } = useCommunities();
  const { settings } = useSettings();

  // Mémorisé : `?? []` créait un nouveau tableau à chaque rendu et forçait le
  // recalcul de tous les filtres dépendants.
  const communityIds = useMemo(() => user?.communityIds ?? [], [user?.communityIds]);
  const communityNames = communityIds
    .map((cid) => communities.find((c) => c.id === cid)?.name)
    .filter((n): n is string => Boolean(n));
  const communityName = communityNames.length > 0 ? communityNames.join(', ') : 'votre communauté';
  const churchName = settings.churchName || 'notre église';

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [showRecipients, setShowRecipients] = useState(false);

  // Isolation par communauté (double sécurité, en plus des RLS).
  const myMembers = useMemo(
    () => members.filter((m) => m.communityIds.some((cid) => communityIds.includes(cid))),
    [members, communityIds],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return myMembers;
    return myMembers.filter(
      (m) =>
        m.firstName.toLowerCase().includes(term) ||
        m.lastName.toLowerCase().includes(term) ||
        m.phone.toLowerCase().includes(term) ||
        m.number.toLowerCase().includes(term),
    );
  }, [myMembers, search]);

  const selectedMembers = useMemo(
    () => myMembers.filter((m) => selected.has(m.id)),
    [myMembers, selected],
  );

  const selectableWithPhone = filtered.filter((m) => m.phone);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      selectableWithPhone.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyTemplate = (key: string) => {
    setTemplate(key);
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    setMessage(tpl.text.replace(/{communaute}/g, communityName).replace(/{eglise}/g, churchName));
  };

  const waUrl = (phone: string) =>
    `https://wa.me/${phoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;

  const openWhatsApp = (phone: string) => {
    const url = waUrl(phone);
    window.open(url, '_blank', 'noopener');
  };

  const handleSend = () => {
    const recipients = selectedMembers.filter((m) => m.phone);
    if (recipients.length === 0 || !message.trim()) return;
    if (recipients.length === 1) {
      openWhatsApp(recipients[0].phone);
    } else {
      setShowRecipients(true);
    }
  };

  const sendAll = () => {
    selectedMembers
      .filter((m) => m.phone)
      .forEach((m) => openWhatsApp(m.phone));
  };

  if (user?.role !== 'community_leader') {
    return (
      <div className="space-y-6 animate-fade-up">
        <PageHeader
          eyebrow="Communication"
          icon="ri-whatsapp-line"
          title="WhatsApp"
          description="Module réservé aux responsables de communauté."
          tone="secondary"
        />
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center text-sm text-foreground-500">
          Ce module est réservé aux responsables de communauté.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Communication"
        icon="ri-whatsapp-line"
        title="Communication WhatsApp"
        description={`Envoyez un message à un ou plusieurs membres de ${communityName}.`}
        tone="secondary"
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-xs font-medium text-foreground-600">
            <i className="ri-user-follow-line text-sm text-foreground-400"></i>
            {selectedMembers.length} destinataire{selectedMembers.length > 1 ? 's' : ''} sélectionné{selectedMembers.length > 1 ? 's' : ''}
          </span>
        }
      />

      <div className="rounded-lg border border-background-200 bg-background-50 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground-700">Modèle de message</label>
            <select
              value={template}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
            >
              <option value="">— Choisir un modèle —</option>
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-lg bg-background-100 px-4 py-2.5">
              <span className="text-sm text-foreground-600">
                {selectedMembers.length} membre{selectedMembers.length > 1 ? 's' : ''} sélectionné{selectedMembers.length > 1 ? 's' : ''}
              </span>
              {selectedMembers.length > 0 && (
                <button
                  onClick={clearSelection}
                  className="cursor-pointer text-sm font-medium text-foreground-500 hover:text-foreground-700"
                >
                  Tout désélectionner
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-foreground-700">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Écrivez votre message ici, ou choisissez un modèle..."
            className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-right text-xs text-foreground-400">{message.length} caractère{message.length > 1 ? 's' : ''}</p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={selectedMembers.length === 0 || !message.trim()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-whatsapp-line text-base"></i>
            Envoyer sur WhatsApp
          </button>
          <p className="text-xs text-foreground-400">
            {selectedMembers.length > 1
              ? 'Choisissez les destinataires ci-dessous, puis confirmez.'
              : 'Sélectionnez un ou plusieurs membres ci-dessous.'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full rounded-lg border border-background-200 bg-background-50 py-2.5 pl-10 pr-4 text-sm text-foreground-800 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            onClick={selectAll}
            className="whitespace-nowrap rounded-lg border border-background-200 px-3 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
          >
            Tout sélectionner
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-foreground-400">
            Aucun membre dans votre communauté.
          </div>
        ) : (
          <div className="divide-y divide-background-100">
            {filtered.map((member) => {
              const isSelected = selected.has(member.id);
              const hasPhone = Boolean(member.phone);
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-100/40"
                >
                  <button
                    onClick={() => hasPhone && toggle(member.id)}
                    disabled={!hasPhone}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                      isSelected
                        ? 'border-primary-500 bg-primary-500 text-background-50'
                        : 'border-background-300 bg-background-50 text-transparent'
                    } ${hasPhone ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                  >
                    <i className="ri-check-line text-sm"></i>
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-100 text-xs font-bold text-foreground-600">
                    {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="truncate text-xs text-foreground-500">{member.number}</p>
                  </div>
                  <span className="text-sm text-foreground-600">{member.phone || '—'}</span>
                  {hasPhone ? (
                    <button
                      onClick={() => openWhatsApp(member.phone)}
                      title="Envoyer un message"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary-600 hover:bg-primary-100"
                    >
                      <i className="ri-whatsapp-line text-lg"></i>
                    </button>
                  ) : (
                    <span className="text-xs text-foreground-400">Sans téléphone</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showRecipients && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setShowRecipients(false)}></div>
          <div className="relative w-full max-w-lg rounded-lg bg-background-50 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-background-200 px-6 py-4">
              <h2 className="font-heading text-lg font-bold text-foreground-950">
                Envoyer à {selectedMembers.filter((m) => m.phone).length} membre{selectedMembers.filter((m) => m.phone).length > 1 ? 's' : ''}
              </h2>
              <button
                onClick={() => setShowRecipients(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              <p className="mb-3 rounded-lg bg-background-100 p-3 text-sm text-foreground-700">{message}</p>
              <div className="divide-y divide-background-100">
                {selectedMembers
                  .filter((m) => m.phone)
                  .map((member) => (
                    <div key={member.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-100 text-xs font-bold text-foreground-600">
                        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground-900">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="truncate text-xs text-foreground-500">{member.phone}</p>
                      </div>
                      <button
                        onClick={() => openWhatsApp(member.phone)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-200 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100"
                      >
                        <i className="ri-whatsapp-line"></i>
                        Ouvrir
                      </button>
                    </div>
                  ))}
              </div>
              <p className="mt-3 text-xs text-foreground-400">
                Votre navigateur peut bloquer l'ouverture de plusieurs onglets. Vous pouvez ouvrir chaque
                destinataire individuellement, ou utiliser « Tout ouvrir ».
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-background-200 px-6 py-4">
              <button
                onClick={() => setShowRecipients(false)}
                className="whitespace-nowrap rounded-lg border border-background-200 px-4 py-2.5 text-sm font-medium text-foreground-700 hover:bg-background-100"
              >
                Annuler
              </button>
              <button
                onClick={sendAll}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
              >
                <i className="ri-whatsapp-line"></i>
                Tout ouvrir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}