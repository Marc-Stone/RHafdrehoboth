import * as XLSX from 'xlsx';
import type { ReportData } from '@/lib/reports';
import { formatDateShort } from '@/utils/date';

/**
 * Export Excel (xlsx) d'un rapport de présences.
 *
 * Le classeur est organisé en plusieurs feuilles exploitables :
 * Résumé, Présences, Par communauté, Par événement.
 */
export function exportReportExcel(data: ReportData, fileName: string): void {
  const wb = XLSX.utils.book_new();

  // ---------- Feuille 1 : Résumé ----------
  const summarySheet: (string | number)[][] = [
    [data.churchName],
    [data.slogan || ''],
    [data.title],
    [`Période : ${data.periodLabel}`],
    [`Généré le ${data.generatedAt} par ${data.generatedBy}`],
    [],
    ['Indicateur', 'Valeur'],
    ['Membres concernés', data.summary.membersConcerned],
    ['Présents', data.summary.presents],
    ['Retards', data.summary.lates],
    ['Absents', data.summary.absents],
    ['Absent en service', data.summary.excused],
    ['Taux de présence (%)', data.summary.rate],
    ['Pointages', data.summary.pointages],
    ['Événements concernés', data.summary.eventsCount],
    [],
    ['Filtres appliqués', ''],
    ...data.activeFilters.map((f) => [f.label, f.value]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summarySheet);
  wsSummary['!cols'] = [{ wch: 26 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé');

  // ---------- Feuille 2 : Présences ----------
  const detailHead = [
    'Numéro',
    'Membre',
    'Sexe',
    'Communauté',
    'Événement',
    'Date',
    'Heure',
    'Statut',
    'Méthode',
    'Responsable du pointage',
  ];
  const detailRows = data.rows.map((r) => [
    r.memberNumber || '—',
    r.memberName || '—',
    r.gender || '—',
    r.community || '—',
    r.eventTitle || '—',
    r.date ? formatDateShort(r.date) : '—',
    r.time || '—',
    r.status,
    r.method,
    r.scannedByName || '—',
  ]);
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHead, ...detailRows]);
  wsDetail['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 8 },
    { wch: 20 },
    { wch: 26 },
    { wch: 16 },
    { wch: 8 },
    { wch: 16 },
    { wch: 10 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Présences');

  // ---------- Feuille 3 : Par communauté ----------
  const commHead = ['Communauté', 'Membres actifs', 'Présents', 'Retards', 'Absents', 'En service', 'Taux (%)'];
  const commRows = data.communityStats.map((c) => [
    c.name,
    c.activeMembers,
    c.presents,
    c.lates,
    c.absents,
    c.excused,
    c.rate,
  ]);
  const wsComm = XLSX.utils.aoa_to_sheet([commHead, ...commRows]);
  wsComm['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsComm, 'Par communauté');

  // ---------- Feuille 4 : Par événement ----------
  const evHead = [
    'Événement',
    'Session de',
    'Date',
    'Début',
    'Fin',
    'Communauté',
    'Pointages',
    'Présents',
    'Retards',
    'Absents',
    'En service',
    'Taux (%)',
  ];
  const evRows = data.eventStats.map((e) => [
    e.name,
    e.isSession ? e.parentTitle || '—' : '—',
    e.date ? formatDateShort(e.date) : '—',
    e.startTime || '—',
    e.endTime || '—',
    e.community,
    e.pointages,
    e.presents,
    e.lates,
    e.absents,
    e.excused,
    e.rate,
  ]);
  const wsEv = XLSX.utils.aoa_to_sheet([evHead, ...evRows]);
  wsEv['!cols'] = [
    { wch: 26 },
    { wch: 22 },
    { wch: 16 },
    { wch: 8 },
    { wch: 8 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEv, 'Par événement');

  XLSX.writeFile(wb, fileName);
}