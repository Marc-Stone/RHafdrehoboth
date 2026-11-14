import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAttendances } from '@/hooks/useAttendances';
import { presentStatuses } from '@/lib/constants';
import UserAvatar from '@/components/feature/UserAvatar';
import PageHeader from '@/components/base/PageHeader';
import StatTile from '@/components/base/StatTile';

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Tableau de bord de l'agent de présence : volontairement minimal.
 * Uniquement le pointage, le compte du jour et l'historique de ses scans.
 */
export default function AgentDashboard() {
  const { user } = useAuth();
  const { records } = useAttendances();
  const today = todayISO();

  const myRecords = useMemo(
    () => records.filter((r) => r.scannedBy === user?.id),
    [records, user?.id],
  );

  // Ne compter que les présences réelles : les « Absent » générés à la
  // clôture ne sont pas des présences et gonflaient le compteur de l'agent.
  const todayCount = myRecords.filter(
    (r) => r.eventDate === today && presentStatuses.includes(r.status),
  ).length;
  const recentScans = myRecords.slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-up md:space-y-7">
      <PageHeader
        eyebrow="Pointage"
        icon="ri-qr-scan-2-line"
        title="Pointage des présences"
        description={`Bienvenue, ${user?.name ?? 'Agent'} — scannez les QR Codes pour pointer les membres.`}
        tone="accent"
      />

      <Link
        to="/scanner"
        className="flex items-center justify-between gap-4 rounded-lg bg-primary-500 p-6 text-background-50 transition-colors hover:bg-primary-600"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-50/20">
            <i className="ri-qr-scan-2-line text-3xl"></i>
          </div>
          <div>
            <p className="font-heading text-lg font-bold">Scanner un QR Code</p>
            <p className="text-sm text-background-50/80">Pointer la présence d'un membre</p>
          </div>
        </div>
        <i className="ri-arrow-right-line text-2xl"></i>
      </Link>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Aujourd'hui"
          value={todayCount}
          icon="ri-check-double-line"
          tone="accent"
          hint="Présences enregistrées aujourd'hui"
        />

        <div className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <UserAvatar initials={user?.initials ?? '?'} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground-900">{user?.name ?? 'Agent'}</p>
              <p className="truncate text-xs text-foreground-500">{user?.email ?? ''}</p>
              <span className="mt-1 inline-block rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-800">
                {user?.roleLabel ?? ''}
              </span>
            </div>
          </div>
          <Link
            to="/account"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-200 bg-background-50 px-4 py-2 text-sm font-medium text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-settings-3-line"></i>
            Mon compte
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-background-200/90 bg-background-50 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-foreground-900">Mes pointages récents</h3>
          <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
            {myRecords.length}
          </span>
        </div>
        {recentScans.length === 0 ? (
          <p className="mt-6 text-center text-sm text-foreground-400">
            Aucun pointage pour le moment. Lancez un scan pour commencer.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-background-100">
            {recentScans.map((record) => (
              <div key={record.id} className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-100 text-sm font-bold text-foreground-600">
                  {record.memberName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground-900">{record.memberName}</p>
                  <p className="truncate text-xs text-foreground-500">{record.community}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-medium text-foreground-600">{record.time}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      record.method === 'QR' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-700'
                    }`}
                  >
                    {record.method}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}