/**
 * Normalise un numéro de téléphone pour l'utiliser avec le lien wa.me.
 * Adapté aux numéros de Côte d'Ivoire :
 * - retire tout caractère non numérique ;
 * - respecte un préfixe international explicite (« + » ou « 00 ») ;
 * - numéro local à 10 chiffres (format en vigueur depuis 2021, ex.
 *   07 07 12 34 56) : le « 0 » initial FAIT PARTIE du numéro, on ajoute
 *   seulement l'indicatif « 225 » → 2250707123456. Avant, ce « 0 » était
 *   retiré, ce qui produisait un numéro WhatsApp invalide ;
 * - ancien numéro à 8 chiffres : préfixé par « 225 » tel quel.
 */
export function phoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  // Préfixe international explicite : on le respecte tel quel.
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  // Numéro local ivoirien à 10 chiffres : on conserve le 0 initial.
  if (digits.length === 10 && digits.startsWith('0')) return `225${digits}`;
  // Numéro déjà international (indicatif + numéro).
  if (digits.length >= 11) return digits;
  // Ancien format (8 chiffres) ou numéro court : indicatif ajouté.
  return `225${digits}`;
}
