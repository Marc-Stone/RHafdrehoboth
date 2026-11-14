import type {
  AttendanceRecord,
  ChurchEvent,
  ChurchSettings,
  Community,
  Member,
} from '@/lib/types';
import { presentStatuses } from '@/lib/constants';
import { formatDateFr, formatDateShort } from '@/utils/date';

/**
 * Construction des rapports de présences.
 *
 * Ce module est *pur* : il ne fait aucun appel réseau. Il transforme les
 * données déjà chargées (et donc déjà filtrées par les politiques RLS selon le
 * rôle de l'utilisateur) en un rapport structuré. Un filtre ne peut donc que
 * RESTREINDRE le périmètre, jamais l'élargir : impossible de contourner les
 * permissions en modifiant les filtres ou l'URL.
 */

export type ReportPeriodType = 'day' | 'specific' | 'week' | 'month' | 'year' | 'custom';
export type ReportFormat = 'pdf' | 'excel';

export interface ReportFilters {
  periodType: ReportPeriodType;
  date: string;
  startDate: string;
  endDate: string;
  eventId: string;
  sessionId: string;
  communityIds: string[];
  statuses: string[];
  memberId: string;
  gender: string;
  scannedById: string;
}

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriodType; label: string; icon: string }[] = [
  { value: 'day', label: "Aujourd'hui", icon: 'ri-calendar-line' },
  { value: 'specific', label: 'Date précise', icon: 'ri-calendar-check-line' },
  { value: 'week', label: 'Semaine', icon: 'ri-calendar-2-line' },
  { value: 'month', label: 'Mois', icon: 'ri-calendar-todo-line' },
  { value: 'year', label: 'Année', icon: 'ri-calendar-event-line' },
  { value: 'custom', label: 'Personnalisée', icon: 'ri-calendar-schedule-line' },
];

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultReportFilters(
  date: string,
  periodType: ReportPeriodType = 'day',
  initialCommunityId?: string,
): ReportFilters {
  const base = date || todayISO();
  return {
    periodType,
    date: base,
    startDate: base,
    endDate: base,
    eventId: '',
    sessionId: '',
    communityIds: initialCommunityId ? [initialCommunityId] : [],
    statuses: [],
    memberId: '',
    gender: '',
    scannedById: '',
  };
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

/** Convertit une période en intervalle de dates ISO inclusives [start, end]. */
export function resolveRange(f: ReportFilters): { start: string; end: string } {
  const anchor = parseISO(f.date || todayISO());
  if (Number.isNaN(anchor.getTime())) return { start: f.date, end: f.date };
  switch (f.periodType) {
    case 'day':
    case 'specific': {
      const d = toISO(anchor);
      return { start: d, end: d };
    }
    case 'week': {
      const ws = startOfWeek(anchor);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return { start: toISO(ws), end: toISO(we) };
    }
    case 'month': {
      const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start: toISO(s), end: toISO(e) };
    }
    case 'year':
      return { start: `${anchor.getFullYear()}-01-01`, end: `${anchor.getFullYear()}-12-31` };
    case 'custom': {
      let s = f.startDate || toISO(anchor);
      let e = f.endDate || s;
      if (s > e) {
        const tmp = s;
        s = e;
        e = tmp;
      }
      return { start: s, end: e };
    }
    default:
      return { start: f.date, end: f.date };
  }
}

export function periodLabel(f: ReportFilters): string {
  const anchor = parseISO(f.date || todayISO());
  switch (f.periodType) {
    case 'day':
    case 'specific':
      return formatDateFr(f.date);
    case 'week': {
      const ws = startOfWeek(anchor);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return `Semaine du ${formatDateShort(toISO(ws))} au ${formatDateShort(toISO(we))}`;
    }
    case 'month': {
      const label = anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    case 'year':
      return `Année ${anchor.getFullYear()}`;
    case 'custom': {
      const r = resolveRange(f);
      return `Du ${formatDateShort(r.start)} au ${formatDateShort(r.end)}`;
    }
    default:
      return formatDateFr(f.date);
  }
}

export interface ReportRow {
  memberNumber: string;
  memberName: string;
  gender: string;
  community: string;
  eventTitle: string;
  date: string;
  time: string;
  status: string;
  method: string;
  scannedByName: string;
}

export interface ReportGroupStat {
  name: string;
  pointages: number;
  presents: number;
  lates: number;
  excused: number;
  absents: number;
  activeMembers: number;
  rate: number;
}

export interface ReportEventStat extends ReportGroupStat {
  date: string;
  startTime: string;
  endTime: string;
  community: string;
  isSession: boolean;
  parentTitle: string;
}

export interface ReportSummary {
  pointages: number;
  presents: number;
  lates: number;
  excused: number;
  absents: number;
  membersConcerned: number;
  eventsCount: number;
  rate: number;
}

export interface ActiveFilter {
  label: string;
  value: string;
}

export interface ReportData {
  title: string;
  churchName: string;
  slogan: string;
  logoUrl: string | null;
  periodLabel: string;
  range: { start: string; end: string };
  generatedAt: string;
  generatedBy: string;
  fileBase: string;
  summary: ReportSummary;
  communityStats: ReportGroupStat[];
  eventStats: ReportEventStat[];
  rows: ReportRow[];
  activeFilters: ActiveFilter[];
  hasData: boolean;
}

export interface BuildReportInput {
  records: AttendanceRecord[];
  members: Member[];
  events: ChurchEvent[];
  communities: Community[];
  settings: ChurchSettings;
  logoUrl: string | null;
  generatedBy: string;
  filters: ReportFilters;
  /** Communautés autorisées (responsable de communauté). `null` = toutes. */
  restrictCommunityIds?: string[] | null;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Communauté effective d'un événement : un événement (ou une session) sans
 * communauté propre hérite de celle de son parent. Les données héritées
 * (sessions créées avant la propagation de la communauté) portent
 * `community_id = null` : sans cette résolution, le rapport les traitait comme
 * « toute l'église » et gonflait le dénominateur du taux de présence.
 */
function effectiveEventCommunityId(
  event: ChurchEvent | undefined,
  eventById: Map<string, ChurchEvent>,
): string | null {
  if (!event) return null;
  if (event.communityId) return event.communityId;
  let parentId = event.parentEventId;
  let depth = 0;
  while (parentId && depth < 3) {
    const parent = eventById.get(parentId);
    if (!parent) return null;
    if (parent.communityId) return parent.communityId;
    parentId = parent.parentEventId;
    depth += 1;
  }
  return null;
}

function effectiveEventCommunityName(
  event: ChurchEvent | undefined,
  eventById: Map<string, ChurchEvent>,
): string {
  if (!event) return "Toute l'église";
  if (event.communityId) return event.community;
  const parent = event.parentEventId ? eventById.get(event.parentEventId) : undefined;
  return parent?.community ?? event.community;
}

/**
 * Taux de présence : présents ÷ (actifs − excusés).
 * Reprend EXACTEMENT la règle métier déjà utilisée dans le tableau de bord du
 * responsable : « présents » = présence OU retard (a réellement participé),
 * et « excusés » = absent en service. Seuls les membres ACTIFS comptent.
 */
function computeRate(presentIds: Set<string>, excusedIds: Set<string>, activeIds: Set<string>): number {
  let present = 0;
  presentIds.forEach((id) => {
    if (activeIds.has(id)) present += 1;
  });
  let excused = 0;
  excusedIds.forEach((id) => {
    if (activeIds.has(id)) excused += 1;
  });
  const denom = activeIds.size - excused;
  if (denom <= 0) return 0;
  return Math.round((present / denom) * 1000) / 10;
}

export function buildReport(input: BuildReportInput): ReportData {
  const { records, members, events, communities, settings, logoUrl, generatedBy, filters } = input;
  const range = resolveRange(filters);
  const restrict =
    input.restrictCommunityIds && input.restrictCommunityIds.length > 0
      ? new Set(input.restrictCommunityIds)
      : null;

  const memberById = new Map(members.map((m) => [m.id, m]));
  const eventById = new Map(events.map((e) => [e.id, e]));

  const selectedCommunities = filters.communityIds
    .map((id) => communities.find((c) => c.id === id))
    .filter((c): c is Community => Boolean(c));
  const selectedCommunityNames = selectedCommunities.map((c) => c.name);

  const scopeEvent = filters.eventId ? eventById.get(filters.eventId) : undefined;
  const scopeEventCommunityId = effectiveEventCommunityId(scopeEvent, eventById);

  // Périmètre des membres « attendus » (dénominateur du taux).
  let scopeCommunityIds: string[] | null = null;
  if (filters.communityIds.length > 0) scopeCommunityIds = filters.communityIds;
  else if (scopeEventCommunityId) scopeCommunityIds = [scopeEventCommunityId];
  if (restrict) {
    scopeCommunityIds = scopeCommunityIds
      ? scopeCommunityIds.filter((id) => restrict.has(id))
      : [...restrict];
  }

  const activeMembers = members.filter(
    (m) =>
      m.status === 'Actif' &&
      // Les filtres « membre » et « sexe » doivent aussi restreindre le
      // dénominateur, sinon le taux restait calculé sur toute l'église
      // (un membre filtré affichait un taux de quelques pourcents).
      (!filters.memberId || m.id === filters.memberId) &&
      (!filters.gender || m.gender === filters.gender) &&
      (scopeCommunityIds ? m.communityIds.some((id) => scopeCommunityIds!.includes(id)) : true),
  );
  const activeIdsAll = new Set(activeMembers.map((m) => m.id));

  const activeByCommunityName = new Map<string, Set<string>>();
  const activeByCommunityId = new Map<string, Set<string>>();
  activeMembers.forEach((m) => {
    const key = m.community || '—';
    if (!activeByCommunityName.has(key)) activeByCommunityName.set(key, new Set());
    activeByCommunityName.get(key)!.add(m.id);
    m.communityIds.forEach((cid) => {
      if (!activeByCommunityId.has(cid)) activeByCommunityId.set(cid, new Set());
      activeByCommunityId.get(cid)!.add(m.id);
    });
  });

  // Ensemble des identifiants d'événements concernés (un événement conteneur
  // inclut ses sessions enfants).
  const targetEventIds = new Set<string>();
  if (filters.eventId) {
    targetEventIds.add(filters.eventId);
    if (scopeEvent?.isContainer) {
      events.filter((e) => e.parentEventId === filters.eventId).forEach((e) => targetEventIds.add(e.id));
    }
  }

  const filtered = records
    .filter((r) => {
      if (!r.eventDate) return false;
      if (r.eventDate < range.start || r.eventDate > range.end) return false;
      if (targetEventIds.size > 0 && !targetEventIds.has(r.eventId)) return false;
      if (filters.sessionId && r.eventId !== filters.sessionId) return false;

      const m = memberById.get(r.memberId);
      if (restrict) {
        const ids = m?.communityIds ?? [];
        if (!ids.some((id) => restrict.has(id))) return false;
      }
      if (filters.communityIds.length > 0) {
        const ids = m?.communityIds ?? [];
        const byId = ids.some((id) => filters.communityIds.includes(id));
        const byName = selectedCommunityNames.includes(r.community);
        if (!byId && !byName) return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false;
      if (filters.memberId && r.memberId !== filters.memberId) return false;
      if (filters.gender && (m?.gender ?? '') !== filters.gender) return false;
      if (filters.scannedById && r.scannedBy !== filters.scannedById) return false;
      return true;
    })
    .sort(
      (a, b) =>
        a.eventDate.localeCompare(b.eventDate) ||
        a.eventTitle.localeCompare(b.eventTitle, 'fr') ||
        a.memberName.localeCompare(b.memberName, 'fr'),
    );

  const countStatus = (status: string) => filtered.filter((r) => r.status === status).length;
  const presents = countStatus('Présent');
  const lates = countStatus('En retard');
  const excused = countStatus('Absent en service');
  const absents = countStatus('Absent');

  const presentIds = new Set(filtered.filter((r) => presentStatuses.includes(r.status)).map((r) => r.memberId));
  const excusedIds = new Set(filtered.filter((r) => r.status === 'Absent en service').map((r) => r.memberId));

  const summary: ReportSummary = {
    pointages: filtered.length,
    presents,
    lates,
    excused,
    absents,
    membersConcerned: activeMembers.length,
    eventsCount: new Set(filtered.map((r) => r.eventId)).size,
    rate: computeRate(presentIds, excusedIds, activeIdsAll),
  };

  // Statistiques par communauté
  const communityNamesInData = Array.from(new Set(filtered.map((r) => r.community))).sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
  const communityStats: ReportGroupStat[] = communityNamesInData.map((name) => {
    const recs = filtered.filter((r) => r.community === name);
    const activeIds = activeByCommunityName.get(name) ?? new Set<string>();
    const cp = new Set(recs.filter((r) => presentStatuses.includes(r.status)).map((r) => r.memberId));
    const ce = new Set(recs.filter((r) => r.status === 'Absent en service').map((r) => r.memberId));
    return {
      name,
      pointages: recs.length,
      presents: recs.filter((r) => r.status === 'Présent').length,
      lates: recs.filter((r) => r.status === 'En retard').length,
      excused: recs.filter((r) => r.status === 'Absent en service').length,
      absents: recs.filter((r) => r.status === 'Absent').length,
      activeMembers: activeIds.size,
      rate: computeRate(cp, ce, activeIds),
    };
  });

  // Statistiques par événement (chaque session d'un événement conteneur est
  // affichée séparément : les pointages ne sont jamais mélangés entre sessions).
  const eventIdsInData = Array.from(new Set(filtered.map((r) => r.eventId)));
  const eventStats: ReportEventStat[] = eventIdsInData
    .map((id) => {
      const recs = filtered.filter((r) => r.eventId === id);
      const ev = eventById.get(id);
      // Session sans communauté propre : on hérite de celle du parent
      // (sinon le taux était rapporté à toute l'église).
      const eventCommunityId = effectiveEventCommunityId(ev, eventById);
      const activeIds = eventCommunityId
        ? activeByCommunityId.get(eventCommunityId) ?? new Set<string>()
        : activeIdsAll;
      const ep = new Set(recs.filter((r) => presentStatuses.includes(r.status)).map((r) => r.memberId));
      const ee = new Set(recs.filter((r) => r.status === 'Absent en service').map((r) => r.memberId));
      const parent = ev?.parentEventId ? eventById.get(ev.parentEventId) : undefined;
      return {
        name: ev?.title ?? recs[0]?.eventTitle ?? '—',
        date: ev?.date ?? recs[0]?.eventDate ?? '',
        startTime: ev?.startTime ?? '',
        endTime: ev?.endTime ?? '',
        community: effectiveEventCommunityName(ev, eventById),
        isSession: Boolean(ev?.parentEventId),
        parentTitle: parent?.title ?? '',
        pointages: recs.length,
        presents: recs.filter((r) => r.status === 'Présent').length,
        lates: recs.filter((r) => r.status === 'En retard').length,
        excused: recs.filter((r) => r.status === 'Absent en service').length,
        absents: recs.filter((r) => r.status === 'Absent').length,
        activeMembers: activeIds.size,
        rate: computeRate(ep, ee, activeIds),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'fr'));

  const rows: ReportRow[] = filtered.map((r) => {
    const m = memberById.get(r.memberId);
    return {
      memberNumber: r.memberNumber,
      memberName: r.memberName,
      gender: m?.gender ?? '',
      community: r.community,
      eventTitle: r.eventTitle,
      date: r.eventDate,
      time: r.time,
      status: r.status,
      method: r.method,
      scannedByName: r.scannedByName,
    };
  });

  // Filtres actifs (pour l'aperçu et l'en-tête du document)
  const activeFilters: ActiveFilter[] = [{ label: 'Période', value: periodLabel(filters) }];
  if (scopeEvent) {
    activeFilters.push({ label: 'Événement', value: scopeEvent.title });
    if (filters.sessionId) {
      const sess = eventById.get(filters.sessionId);
      if (sess) activeFilters.push({ label: 'Session', value: sess.title });
    }
  }
  if (selectedCommunityNames.length > 0) {
    activeFilters.push({ label: 'Communautés', value: selectedCommunityNames.join(', ') });
  }
  if (filters.statuses.length > 0) {
    activeFilters.push({ label: 'Statuts', value: filters.statuses.join(', ') });
  }
  if (filters.memberId) {
    const m = memberById.get(filters.memberId);
    if (m) activeFilters.push({ label: 'Membre', value: `${m.firstName} ${m.lastName}` });
  }
  if (filters.gender) activeFilters.push({ label: 'Sexe', value: filters.gender });
  if (filters.scannedById) {
    const agent = records.find((r) => r.scannedBy === filters.scannedById);
    if (agent?.scannedByName) activeFilters.push({ label: 'Responsable du pointage', value: agent.scannedByName });
  }

  // Titre du rapport selon le périmètre
  let title = 'Rapport de présences';
  let fileBase = 'Rapport_Presences';
  if (scopeEvent) {
    title = `Rapport — ${scopeEvent.title}`;
    fileBase = `Rapport_${slug(scopeEvent.title)}`;
  } else if (selectedCommunityNames.length === 1) {
    title = `Rapport de présences — ${selectedCommunityNames[0]}`;
    fileBase = `Rapport_Presences_${slug(selectedCommunityNames[0])}`;
  } else if (selectedCommunityNames.length > 1) {
    title = 'Rapport de présences — plusieurs communautés';
    fileBase = 'Rapport_Presences_Multi-communautes';
  }

  const generatedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    title,
    churchName: settings.churchName || 'Mon Église',
    slogan: settings.slogan || '',
    logoUrl,
    periodLabel: periodLabel(filters),
    range,
    generatedAt,
    generatedBy,
    fileBase,
    summary,
    communityStats,
    eventStats,
    rows,
    activeFilters,
    hasData: filtered.length > 0,
  };
}

export function buildReportFileName(data: ReportData, format: ReportFormat): string {
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  const dateTag =
    data.range.start === data.range.end ? data.range.start : `${data.range.start}_${data.range.end}`;
  return `${data.fileBase}_${dateTag}.${ext}`;
}