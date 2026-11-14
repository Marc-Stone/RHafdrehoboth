import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useMemberAttendances } from '@/hooks/useMemberAttendances';
import type { Member } from '@/lib/types';
import { attendanceStatusStyle, presentStatuses } from '@/lib/constants';
import { formatDateFr } from '@/utils/date';

const primary = 'oklch(var(--primary-500))';

function formatMonthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function monthAbbr(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}

export default function AttendanceHistory({ member }: { member: Member }) {
  // Chargement ciblé sur ce membre uniquement (pas tous les pointages).
  const { records, loading, error, reload } = useMemberAttendances(member.id);

  const attendances = useMemo(() => {
    return records
      .filter((r) => r.memberId === member.id)
      .sort((a, b) => {
        const byDate = b.eventDate.localeCompare(a.eventDate);
        if (byDate !== 0) return byDate;
        return a.time.localeCompare(b.time);
      });
  }, [records, member.id]);

  // « Présences » = a réellement participé (Présent / En retard). Les
  // « Absent » générés automatiquement à la clôture ne sont pas des présences
  // et ne doivent donc pas gonfler le graphique ni le taux.
  const present = attendances.filter((a) => presentStatuses.includes(a.status));
  const qrCount = present.filter((a) => a.method === 'QR').length;
  const manualCount = present.filter((a) => a.method === 'Manuel' && a.time).length;
  const scannedTotal = qrCount + manualCount;
  const qrRate = scannedTotal ? Math.round((qrCount / scannedTotal) * 100) : 0;
  const distinctEvents = new Set(present.map((a) => a.eventId)).size;
  const lastDate = present[0]?.eventDate ?? '';

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    present.forEach((a) => {
      const key = a.eventDate.slice(0, 7);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ name: formatMonthShort(month), présences: count }));
  }, [present]);

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground-900">Historique des présences</h3>
          <p className="mt-0.5 text-xs text-foreground-400">
            Toutes les sessions auxquelles {member.firstName} a participé.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
          <i className="ri-check-double-line"></i>
          {present.length} présence{present.length > 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-dashed border-background-200 py-12 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement des présences...
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-accent-200 bg-accent-100/50 px-4 py-10 text-center">
          <p className="text-sm text-accent-800">{error}</p>
          <button
            onClick={() => void reload()}
            className="cursor-pointer whitespace-nowrap rounded-lg border border-accent-300 px-4 py-2 text-sm font-medium text-accent-800 hover:bg-accent-100"
          >
            Réessayer
          </button>
        </div>
      ) : attendances.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-background-200 py-12 text-center text-foreground-400">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background-100">
            <i className="ri-history-line text-2xl"></i>
          </div>
          <p className="mt-3 text-sm">Aucune présence enregistrée pour le moment.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-background-100/60 p-3">
              <p className="text-xl font-bold text-foreground-950">{distinctEvents}</p>
              <p className="text-xs text-foreground-500">Événements distincts</p>
            </div>
            <div className="rounded-lg bg-background-100/60 p-3">
              <p className="text-xl font-bold text-foreground-950">{qrRate}%</p>
              <p className="text-xs text-foreground-500">Taux de scan QR ({qrCount} QR)</p>
            </div>
            <div className="rounded-lg bg-background-100/60 p-3">
              <p className="text-xl font-bold text-foreground-950">{lastDate ? formatDateFr(lastDate) : '—'}</p>
              <p className="text-xs text-foreground-500">Dernier pointage</p>
            </div>
          </div>

          {monthly.length > 1 && (
            <div className="mt-5 rounded-lg border border-background-200 p-4">
              <h4 className="text-sm font-semibold text-foreground-800">Présence mensuelle</h4>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gMember" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={primary} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid oklch(var(--background-200))', fontSize: 12 }} />
                    <Area type="monotone" dataKey="présences" name="Pointages" stroke={primary} strokeWidth={2} fill="url(#gMember)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2">
            {attendances.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-background-200 px-4 py-3 transition-colors hover:bg-background-100/50"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-background-100">
                  <span className="text-sm font-bold leading-none text-foreground-900">
                    {a.eventDate ? a.eventDate.slice(8, 10) : '--'}
                  </span>
                  <span className="mt-0.5 text-[9px] font-medium uppercase text-foreground-500">
                    {monthAbbr(a.eventDate)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground-800">{a.eventTitle}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground-500">
                    {a.eventDate ? formatDateFr(a.eventDate) : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${attendanceStatusStyle[a.status] ?? 'bg-background-100 text-foreground-500'}`}>
                    {a.status}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      a.method === 'QR'
                        ? 'bg-secondary-100 text-secondary-700'
                        : 'bg-background-100 text-foreground-500'
                    }`}
                  >
                    {a.method}
                  </span>
                  <span className="w-12 text-right text-xs text-foreground-500">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}