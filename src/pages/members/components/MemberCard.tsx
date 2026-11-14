import { QRCodeCanvas } from 'qrcode.react';
import type { Member } from '@/lib/types';
import { useSettings } from '@/hooks/useSettings';

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function MemberCard({ member }: { member: Member }) {
  const { settings, logoUrl: logo } = useSettings();
  const photo = member.photoUrl;
  const churchName = settings.churchName || 'Mon Église';
  const slogan = settings.slogan;
  const churchRole = member.churchRole || member.department || 'Membre';
  const fullName = `${member.firstName} ${member.lastName}`.trim();

  return (
    <div className="print-area mx-auto flex w-full max-w-[340px] flex-col overflow-hidden rounded-2xl border border-background-200 bg-background-50">
      {/* En-tête : logo + nom de l'église */}
      <div className="relative overflow-hidden bg-primary-500 px-5 pb-9 pt-5 text-background-50 dark:text-foreground-950">
        <span className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-background-50/10" />
        <span className="pointer-events-none absolute -left-12 bottom-0 h-24 w-24 rounded-full bg-background-50/10" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-background-50/20" />

        <div className="relative flex flex-col items-center text-center">
          {logo ? (
            <img
              src={logo}
              alt={`Logo de ${churchName}`}
              className="h-12 w-12 rounded-full border-2 border-background-50/80 bg-background-50 object-cover dark:border-foreground-900/50"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-background-50/80 bg-background-50 text-primary-600 dark:border-foreground-900/50">
              <i className="ri-building-line text-xl"></i>
            </div>
          )}
          <p className="mt-2 max-w-full break-words font-heading text-[15px] font-bold leading-snug tracking-tight">
            {churchName}
          </p>
          {slogan && (
            <p className="mt-1 max-w-[240px] text-[10px] leading-snug text-background-50/80 dark:text-foreground-900/80">{slogan}</p>
          )}
        </div>
      </div>

      {/* Photo d'identité encadrée */}
      <div className="relative -mt-8 flex justify-center">
        <div className="rounded-xl bg-accent-500 p-[3px]">
          <div className="h-[86px] w-[86px] overflow-hidden rounded-[9px] border-4 border-background-50 bg-accent-100">
            {photo ? (
              <img
                src={photo}
                alt={fullName}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent-100 text-2xl font-bold text-accent-800">
                {initials(member.firstName, member.lastName)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nom + fonction + contact */}
      <div className="px-5 pb-4 pt-3 text-center">
        <h3 className="break-words font-heading text-lg font-bold leading-tight text-foreground-950">
          {fullName}
        </h3>
        <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-900">
          <span className="flex h-3 w-3 shrink-0 items-center justify-center">
            <i className="ri-award-line text-[11px]"></i>
          </span>
          <span className="truncate">{churchRole}</span>
        </span>
        <div className="mt-2.5 flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground-700">
            <span className="flex h-4 w-4 items-center justify-center text-primary-500">
              <i className="ri-phone-line text-[13px]"></i>
            </span>
            {member.phone || 'Non renseigné'}
          </span>
        </div>

        {/* QR Code juste sous le téléphone */}
        <div className="mt-3 flex flex-col items-center">
          <div className="rounded-lg border border-background-200 bg-white p-1.5">
            <QRCodeCanvas
              value={member.number}
              size={70}
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#1c1917"
            />
          </div>
          <p className="mt-1.5 text-[9px] leading-snug text-foreground-500">
            Présentez ce QR Code à l'entrée
          </p>
        </div>
      </div>

      {/* Numéro de membre */}
      <div className="mt-auto border-t border-dashed border-background-300/70 px-5 py-3.5 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground-400">
          N° de membre
        </p>
        <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-tight text-foreground-900">
          {member.number}
        </p>
      </div>

      {/* Filet décoratif */}
      <div className="h-1 w-full bg-accent-500" />
    </div>
  );
}