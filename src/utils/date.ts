export function formatDateFr(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const label = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Nom court du mois (ex. « mars ») à partir d'une date ISO `AAAA-MM-JJ`.
 * À utiliser pour les badges de date : `formatDateFr` renvoie une phrase
 * complète (« Dimanche 14 mars 2026 »), donc découper cette phrase pour
 * récupérer le mois affichait le jour (« 14 ») au lieu du mois.
 */
export function monthShortFr(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}