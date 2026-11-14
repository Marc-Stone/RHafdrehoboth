import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import { useAttendances } from '@/hooks/useAttendances';
import { useCommunities } from '@/hooks/useCommunities';
import { useMembers } from '@/hooks/useMembers';
import { useEvents } from '@/hooks/useEvents';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { formatDateFr, formatDateShort } from '@/utils/date';
import { attendanceStatusOptions, attendanceStatusStyle, presentStatuses } from '@/lib/constants';
import ReportExportPanel from '@/pages/reports/components/ReportExportPanel';
import PageHeader from '@/components/base/PageHeader';
import StatTile from '@/components/base/StatTile';

type Period = 'day' | 'week' | 'month';

const periodOptions: { value: Period; label: string; icon: string }[] = [
  { value: 'day', label: 'Journalier', icon: 'ri-calendar-line' },
  { value: 'week', label: 'Hebdomadaire', icon: 'ri-calendar-check-line' },
  { value: 'month', label: 'Mensuel', icon: 'ri-calendar-2-line' },
];

const primary = 'oklch(var(--primary-500))';
const accent = 'oklch(var(--accent-500))';

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function inPeriod(iso: string, period: Period, anchor: Date): boolean {
  const t = parseISO(iso).getTime();
  if (period === 'day') return t === anchor.getTime();
  if (period === 'week') {
    const ws = startOfWeek(anchor).getTime();
    return t >= ws && t < ws + 7 * 86400000;
  }
  const ms = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
  const me = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1).getTime();
  return t >= ms && t < me;
}

function shift(iso: string, period: Period, dir: 1 | -1): string {
  const d = parseISO(iso);
  if (period === 'day') {
    d.setDate(d.getDate() + dir);
    return toISO(d);
  }
  if (period === 'week') {
    d.setDate(d.getDate() + dir * 7);
    return toISO(d);
  }
  // Mois : on repart TOUJOURS du 1er jour avant de décaler. Sinon un 31
  // (ex. 31 janvier + 1 mois) déborde sur le mois suivant et saute février.
  return toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}

function periodLabel(iso: string, period: Period): string {
  const d = parseISO(iso);
  if (period === 'day') return formatDateFr(iso);
  if (period === 'week') {
    const ws = startOfWeek(d);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    return `Semaine du ${formatDateShort(toISO(ws))} au ${formatDateShort(toISO(we))}`;
  }
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function ReportsPage() {
  const { records, loading, error, fetchRecords } = useAttendances();
  const { communities, error: communitiesError, fetchCommunities } = useCommunities();
  const { members, error: membersError, fetchMembers } = useMembers();
  const { events } = useEvents();
  const { settings, logoUrl } = useSettings();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [communityFilter, setCommunityFilter] = useState('');
  const [dateTouched, setDateTouched] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const sorted = [...records].filter((r) => r.eventDate).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    return sorted[0]?.eventDate || toISO(new Date());
  });

  const anchor = useMemo(() => parseISO(selectedDate), [selectedDate]);

  // À l'ouverture, les données ne sont pas encore chargées : on recale
  // automatiquement la période sur la plus récente qui contient des données,
  // tant que l'utilisateur n'a pas lui-même navigué entre les périodes.
  useEffect(() => {
    if (dateTouched) return;
    const dated = records.filter((r) => r.eventDate);
    if (dated.length === 0) return;
    if (dated.some((r) => inPeriod(r.eventDate, period, anchor))) return;
    const mostRecent = [...dated].sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0]?.eventDate;
    if (mostRecent) setSelectedDate(mostRecent);
  }, [records, period, anchor, dateTouched]);

  const recordsInPeriod = useMemo(
    () => records.filter((r) => r.eventDate && inPeriod(r.eventDate, period, anchor)),
    [records, period, anchor],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const communityIdByName = useMemo(
    () => new Map(communities.map((c) => [c.name, c.id])),
    [communities],
  );

  // Une seule source d'erreur lisible : si le chargement échoue, on affiche un
  // message et un bouton « Réessayer » au lieu du faux état « aucune donnée ».
  const loadError = error || membersError || communitiesError;
  const retryLoad = () => {
    void fetchRecords();
    void fetchMembers();
    void fetchCommunities();
  };

  // Période affichée à l'écran → période par défaut de l'export : le fichier
  // exporté correspond ainsi à ce que l'utilisateur voit (« Jour » → date
  // précise, semaine/mois conservés).
  const initialExportPeriod: 'specific' | 'week' | 'month' =
    period === 'day' ? 'specific' : period;
  const initialExportCommunityId = communityIdByName.get(communityFilter) ?? '';

  const filteredRecords = useMemo(() => {
    if (!communityFilter) return recordsInPeriod;
    const cid = communityIdByName.get(communityFilter);
    // Un membre peut appartenir à plusieurs communautés : le filtre doit
    // interroger TOUTES ses affectations, pas seulement sa communauté
    // principale (sinon ses pointages disparaissaient du filtre).
    return recordsInPeriod.filter((r) => {
      if (r.community === communityFilter) return true;
      if (!cid) return false;
      return Boolean(memberById.get(r.memberId)?.communityIds.includes(cid));
    });
  }, [recordsInPeriod, communityFilter, communityIdByName, memberById]);

  const communityStats = useMemo(() => {
    const map = new Map<string, { pointages: number; members: Set<string>; qr: number; manual: number }>();
    filteredRecords.forEach((r) => {
      const name = r.community || '—';
      if (!map.has(name)) {
        map.set(name, { pointages: 0, members: new Set(), qr: 0, manual: 0 });
      }
      const c = map.get(name)!;
      c.pointages += 1;
      // Identifiant (et non le numéro, qui peut être vide sur des données
      // héritées) : sinon plusieurs membres comptaient pour un seul.
      c.members.add(r.memberId);
      if (r.method === 'QR') c.qr += 1;
      // Les absences auto (sans heure) ne sont pas des saisies manuelles.
      else if (r.time) c.manual += 1;
    });
    return Array.from(map.entries())
      .map(([name, c]) => ({
        name,
        pointages: c.pointages,
        members: c.members.size,
        qr: c.qr,
        manual: c.manual,
        qrRate: c.qr + c.manual ? Math.round((c.qr / (c.qr + c.manual)) * 100) : 0,
      }))
      .sort((a, b) => b.pointages - a.pointages);
  }, [filteredRecords]);

  const totalPointages = filteredRecords.length;
  const uniqueMembers = useMemo(() => new Set(filteredRecords.map((r) => r.memberId)).size, [filteredRecords]);
  const qrCount = filteredRecords.filter((r) => r.method === 'QR').length;
  // Base de calcul du taux QR : uniquement les pointages réellement scannés ou
  // saisis manuellement — exclut les « Absent » générés à la clôture (sans heure).
  const manualChecked = filteredRecords.filter((r) => r.method === 'Manuel' && r.time).length;
  const scannedTotal = qrCount + manualChecked;
  const qrRate = scannedTotal ? Math.round((qrCount / scannedTotal) * 100) : 0;
  const eventsCount = useMemo(() => new Set(filteredRecords.map((r) => r.eventId)).size, [filteredRecords]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Présent': 0, 'En retard': 0, 'Absent en service': 0, 'Absent': 0 };
    filteredRecords.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    });
    return counts;
  }, [filteredRecords]);

  const evolution = useMemo(() => {
    if (period === 'day') return [];
    if (period === 'week') {
      const ws = startOfWeek(anchor);
      const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      return labels.map((label, i) => {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        const iso = toISO(d);
        return { name: label, présents: filteredRecords.filter((r) => r.eventDate === iso && presentStatuses.includes(r.status)).length };
      });
    }
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const buckets: { name: string; présents: number }[] = [];
    for (let w = 0; w * 7 < daysInMonth; w += 1) {
      const from = w * 7 + 1;
      const to = Math.min(from + 6, daysInMonth);
      let count = 0;
      filteredRecords.forEach((r) => {
        const day = parseISO(r.eventDate).getDate();
        if (day >= from && day <= to && presentStatuses.includes(r.status)) count += 1;
      });
      buckets.push({ name: `S${w + 1}`, présents: count });
    }
    return buckets;
  }, [period, anchor, filteredRecords]);

  const chartHeight = Math.max(240, communityStats.length * 44);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Analyse"
        icon="ri-file-chart-2-line"
        title="Rapports"
        description="Analysez la présence par communauté, sur la période de votre choix."
        tone="accent"
        actions={
          <button
            onClick={() => setExportOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-file-chart-2-line"></i>
            Exporter le rapport
          </button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-background-200 bg-background-50 p-1 lg:w-auto">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                period === opt.value
                  ? 'bg-primary-500 text-background-50'
                  : 'text-foreground-600 hover:bg-background-100'
              }`}
            >
              <i className={`${opt.icon} text-base`}></i>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDateTouched(true);
                setSelectedDate(shift(selectedDate, period, -1));
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-background-200 text-foreground-600 hover:bg-background-100"
              title="Période précédente"
            >
              <i className="ri-arrow-left-s-line text-lg"></i>
            </button>
            <span className="min-w-0 flex-1 text-center text-sm font-semibold text-foreground-800 sm:min-w-[200px]">
              {periodLabel(selectedDate, period)}
            </span>
            <button
              onClick={() => {
                setDateTouched(true);
                setSelectedDate(shift(selectedDate, period, 1));
              }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-background-200 text-foreground-600 hover:bg-background-100"
              title="Période suivante"
            >
              <i className="ri-arrow-right-s-line text-lg"></i>
            </button>
          </div>

          <select
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
            className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm text-foreground-700 focus:border-primary-400 focus:outline-none"
          >
            <option value="">Toutes les communautés</option>
            {communities.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Pointages" value={totalPointages} icon="ri-user-follow-line" tone="primary" />
        <StatTile label="Événements suivis" value={eventsCount} icon="ri-calendar-event-line" tone="accent" />
        <StatTile label="Membres uniques" value={uniqueMembers} icon="ri-group-line" tone="secondary" />
        <StatTile
          label="Taux QR"
          value={`${qrRate}%`}
          icon="ri-qr-scan-line"
          tone="neutral"
          hint={`${qrCount} QR · ${manualChecked} manuel`}
        />
      </div>

      {loadError && records.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent-200 bg-accent-100/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-accent-800">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <i className="ri-error-warning-line"></i>
            </span>
            <p>Certaines données n'ont pas pu être actualisées. Les chiffres affichés peuvent être incomplets.</p>
          </div>
          <button
            onClick={retryLoad}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-accent-300 px-3 py-2 text-xs font-semibold text-accent-800 hover:bg-accent-100"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      )}

      {loading && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-500"></i>
          <p className="mt-3 text-sm text-foreground-500">Chargement des données de présence...</p>
        </div>
      ) : loadError && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-accent-200 bg-accent-100/50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-700">
            <i className="ri-error-warning-line text-3xl"></i>
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold text-accent-900">Impossible de charger les rapports</h2>
          <p className="mt-2 max-w-sm text-sm text-accent-800">
            Une erreur est survenue pendant le chargement des présences. Vérifiez votre connexion puis réessayez.
          </p>
          <button
            onClick={retryLoad}
            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-accent-300 px-4 py-2 text-sm font-semibold text-accent-800 hover:bg-accent-100"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
            <i className="ri-file-chart-2-line text-3xl"></i>
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold text-foreground-900">Aucune donnée de présence</h2>
          <p className="mt-2 max-w-sm text-sm text-foreground-500">
            Les rapports apparaîtront dès que des membres auront été pointés lors d'événements.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-background-200 bg-background-50 p-5">
            <h3 className="font-heading text-base font-semibold text-foreground-900">Répartition des statuts de présence</h3>
            <p className="mt-0.5 text-xs text-foreground-400">Détail des pointages sur la période sélectionnée</p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {attendanceStatusOptions.map((s) => {
                const count = statusCounts[s] ?? 0;
                const pct = totalPointages > 0 ? Math.round((count / totalPointages) * 100) : 0;
                return (
                  <div key={s} className="rounded-lg border border-background-200 bg-background-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attendanceStatusStyle[s] ?? 'bg-background-100 text-foreground-500'}`}>
                        {s}
                      </span>
                      <span className="text-xs font-semibold text-foreground-500">{pct}%</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-foreground-950">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-6 ${period !== 'day' ? 'lg:grid-cols-2' : ''}`}>
            {period !== 'day' && (
              <div className="rounded-lg border border-background-200 bg-background-50 p-5">
                <h3 className="font-heading text-base font-semibold text-foreground-900">Évolution des présences</h3>
                <p className="mt-0.5 text-xs text-foreground-400">
                  {period === 'week' ? 'Présences par jour sur la semaine' : 'Présences par semaine sur le mois'}
                </p>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gReport" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={primary} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid oklch(var(--background-200))', fontSize: 12 }} />
                      <Area type="monotone" dataKey="présents" name="Présences" stroke={primary} strokeWidth={2} fill="url(#gReport)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-background-200 bg-background-50 p-5">
              <h3 className="font-heading text-base font-semibold text-foreground-900">Pointages par communauté</h3>
              <p className="mt-0.5 text-xs text-foreground-400">Répartition des présences sur la période</p>
              {communityStats.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-center text-foreground-400">
                  <p className="text-sm">Aucune présence sur cette période.</p>
                </div>
              ) : (
                <div className="mt-4" style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={communityStats} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'oklch(var(--foreground-500))' }} axisLine={false} tickLine={false} width={120} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid oklch(var(--background-200))', fontSize: 12 }} />
                      <Bar dataKey="pointages" name="Pointages" fill={accent} radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-background-200 bg-background-50">
            <div className="flex items-center justify-between border-b border-background-200 px-5 py-4">
              <h3 className="font-heading text-base font-semibold text-foreground-900">Détail par communauté</h3>
              <span className="text-xs text-foreground-400">{communityStats.length} communautés</span>
            </div>
            {communityStats.length === 0 ? (
              <div className="px-5 py-12 text-center text-foreground-400">
                Aucune donnée de présence sur cette période.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200 text-left text-xs uppercase text-foreground-400">
                      <th className="px-5 py-3 pr-4 font-medium">Communauté</th>
                      <th className="py-3 pr-4 font-medium">Pointages</th>
                      <th className="py-3 pr-4 font-medium">Membres uniques</th>
                      <th className="py-3 pr-4 font-medium">QR / Manuel</th>
                      <th className="py-3 font-medium">Taux QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {communityStats.map((c) => (
                      <tr key={c.name} className="border-b border-background-100 last:border-0">
                        <td className="px-5 py-3 pr-4 font-medium text-foreground-800">{c.name}</td>
                        <td className="py-3 pr-4 text-foreground-700">{c.pointages}</td>
                        <td className="py-3 pr-4 text-foreground-500">{c.members}</td>
                        <td className="py-3 pr-4 text-foreground-500">{c.qr} QR · {c.manual} manuel</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-background-100">
                              <div className="h-full rounded-full bg-accent-500" style={{ width: `${c.qrRate}%` }}></div>
                            </div>
                            <span className="text-xs font-semibold text-foreground-700">{c.qrRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                <div className="divide-y divide-background-100 md:hidden">
                  {communityStats.map((c) => (
                    <div key={c.name} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground-800">{c.name}</p>
                        <span className="shrink-0 text-xs font-semibold text-foreground-700">{c.qrRate}%</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-500">
                        <span>{c.pointages} pointages</span>
                        <span>{c.members} membres</span>
                        <span>{c.qr} QR · {c.manual} manuel</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-100">
                          <div className="h-full rounded-full bg-accent-500" style={{ width: `${c.qrRate}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <ReportExportPanel
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        records={records}
        members={members}
        events={events}
        communities={communities}
        settings={settings}
        logoUrl={logoUrl}
        generatedBy={user?.name ?? 'Utilisateur'}
        userRole={user?.role ?? ''}
        userCommunityIds={user?.communityIds ?? []}
        initialDate={selectedDate}
        initialPeriod={initialExportPeriod}
        initialCommunityId={initialExportCommunityId}
      />
    </div>
  );
}