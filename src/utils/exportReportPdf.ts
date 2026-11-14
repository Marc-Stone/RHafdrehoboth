import { jsPDF } from 'jspdf';
import autoTableImport from 'jspdf-autotable';
import type { ReportData } from '@/lib/reports';
import { formatDateShort } from '@/utils/date';

/**
 * Export PDF professionnel d'un rapport de présences.
 *
 * Contrairement à l'impression navigateur, jsPDF + autoTable gère réellement
 * la pagination : aucun tableau coupé, aucune colonne qui se chevauche, et un
 * pied de page numéroté sur chaque page.
 */

type AutoTableFn = (doc: jsPDF, options: Record<string, unknown>) => void;

/**
 * Selon la configuration du bundler, `jspdf-autotable` peut exposer sa
 * fonction soit directement (`export default fn`), soit encapsulée dans un
 * objet d'interopérabilité (`{ default: fn }`). On normalise ici pour éviter
 * l'erreur « (0 , …default) is not a function ».
 */
const autoTable = (
  typeof autoTableImport === 'function'
    ? autoTableImport
    : (autoTableImport as unknown as { default?: AutoTableFn }).default
) as AutoTableFn;

type RGB = [number, number, number];

const DARK: RGB = [38, 34, 46];
const MUTED: RGB = [122, 116, 132];
const ACCENT: RGB = [150, 45, 110];
const HEAD_BG: RGB = [44, 40, 54];
const ROW_ALT: RGB = [247, 245, 248];

interface LastAutoTable {
  finalY: number;
}

function finalY(doc: jsPDF, fallback: number): number {
  const value = (doc as unknown as { lastAutoTable?: LastAutoTable }).lastAutoTable;
  return value?.finalY ?? fallback;
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Lecture image impossible'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Tronque un texte pour qu'il tienne dans une largeur donnée (mm).
 * Sans cela, un nom d'église + titre longs empiétaient sur la date centrale
 * et sur le numéro de page du pied de page.
 */
function truncateToWidth(doc: jsPDF, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}...`;
}

function sectionTitle(doc: jsPDF, label: string, y: number, margin: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...DARK);
  doc.text(label, margin, y);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 1.8, margin + 24, y + 1.8);
  return y + 6;
}

export async function exportReportPdf(data: ReportData, fileName: string): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ---------- En-tête ----------
  let y = 16;
  const logo = data.logoUrl ? await loadImageDataUrl(data.logoUrl) : null;
  // Le texte est TOUJOURS dessiné, même si le logo est absent ou dans un
  // format non supporté par jsPDF : avant, un addImage en échec faisait
  // disparaître le nom de l'église de l'en-tête PDF.
  let textX = margin;
  if (logo) {
    try {
      const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logo, format, margin, y - 2, 18, 18);
      textX = margin + 22;
    } catch {
      textX = margin;
    }
  }

  const textStart = textX === margin ? y : y + 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(data.churchName, textX, textStart);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  if (data.slogan) doc.text(data.slogan, textX, textStart + 6);
  y = textStart + (data.slogan ? 12 : 8);

  doc.setDrawColor(...HEAD_BG);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  // Un titre long (nom d'événement) débordait de la page : on le fait revenir
  // à la ligne sur la largeur utile.
  const titleLines = doc.splitTextToSize(data.title, pageWidth - margin * 2) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Période : ${data.periodLabel}`, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(`Généré le ${data.generatedAt} par ${data.generatedBy}`, margin, y);
  y += 7;

  // ---------- Résumé statistique ----------
  y = sectionTitle(doc, 'Résumé statistique', y, margin);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.4, halign: 'center', lineColor: [220, 216, 224], lineWidth: 0.2 },
    headStyles: { fillColor: HEAD_BG, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    head: [['Membres concernés', 'Présents', 'Retards', 'Absents', 'En service', 'Taux de présence']],
    body: [
      [
        String(data.summary.membersConcerned),
        String(data.summary.presents),
        String(data.summary.lates),
        String(data.summary.absents),
        String(data.summary.excused),
        `${data.summary.rate} %`,
      ],
    ],
  });
  y = finalY(doc, y) + 8;

  // ---------- Par communauté ----------
  if (data.communityStats.length > 0) {
    y = sectionTitle(doc, 'Synthèse par communauté', y, margin);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2.2, lineColor: [230, 227, 233], lineWidth: 0.2 },
      headStyles: { fillColor: HEAD_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT },
      head: [['Communauté', 'Membres', 'Présents', 'Retards', 'Absents', 'En service', 'Taux']],
      body: data.communityStats.map((c) => [
        c.name,
        String(c.activeMembers),
        String(c.presents),
        String(c.lates),
        String(c.absents),
        String(c.excused),
        `${c.rate} %`,
      ]),
    });
    y = finalY(doc, y) + 8;
  }

  // ---------- Par événement ----------
  if (data.eventStats.length > 0) {
    y = sectionTitle(doc, 'Synthèse par événement', y, margin);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [230, 227, 233], lineWidth: 0.2 },
      headStyles: { fillColor: HEAD_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ROW_ALT },
      head: [['Événement', 'Date', 'Horaire', 'Communauté', 'Prés.', 'Ret.', 'Abs.', 'Serv.', 'Taux']],
      body: data.eventStats.map((e) => [
        e.isSession ? `${e.parentTitle ? `${e.parentTitle} · ` : ''}${e.name}` : e.name,
        e.date ? formatDateShort(e.date) : '—',
        e.startTime ? `${e.startTime}${e.endTime ? ` - ${e.endTime}` : ''}` : '—',
        e.community,
        String(e.presents),
        String(e.lates),
        String(e.absents),
        String(e.excused),
        `${e.rate} %`,
      ]),
    });
    y = finalY(doc, y) + 8;
  }

  // ---------- Détail des présences ----------
  y = sectionTitle(doc, 'Détail des présences', y, margin);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.9, lineColor: [230, 227, 233], lineWidth: 0.2 },
    headStyles: { fillColor: HEAD_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ROW_ALT },
    head: [['N°', 'Membre', 'Communauté', 'Événement', 'Date', 'Heure', 'Statut', 'Responsable']],
    body: data.rows.map((r) => [
      r.memberNumber || '—',
      r.memberName || '—',
      r.community || '—',
      r.eventTitle || '—',
      r.date ? formatDateShort(r.date) : '—',
      r.time || '—',
      r.status,
      r.scannedByName || '—',
    ]),
    columnStyles: {
      0: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 14 },
      6: { cellWidth: 22 },
    },
  });

  // ---------- Pied de page sur chaque page ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(225, 222, 229);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      truncateToWidth(doc, `${data.churchName} — ${data.title}`, pageWidth / 2 - margin - 32),
      margin,
      pageHeight - 9.5,
    );
    doc.text(`Généré le ${data.generatedAt}`, pageWidth / 2, pageHeight - 9.5, { align: 'center' });
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 9.5, { align: 'right' });
  }

  doc.setProperties({ title: data.title, subject: data.periodLabel, creator: data.churchName });
  doc.save(fileName);
}