import { supabase } from '@/lib/supabase';

/**
 * Horloge de référence pour le pointage.
 *
 * L'heure et le statut (Présent / En retard / Absent) étaient calculés avec
 * l'horloge du téléphone de l'agent : une horloge mal réglée ou un autre
 * fuseau horaire faussait les statuts. On mesure ici l'écart avec l'horloge du
 * serveur (une fois toutes les 10 minutes) et on exprime l'heure dans le
 * fuseau configuré pour l'église.
 */

const RESYNC_MS = 10 * 60 * 1000;

let offsetMs = 0;
let timeZone: string | null = null;
let syncedAt = 0;
let pending: Promise<void> | null = null;

function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  const iana = tz.split(' ')[0];
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: iana });
    return iana;
  } catch {
    return null;
  }
}

async function sync(): Promise<void> {
  try {
    const t0 = Date.now();
    const { data, error } = await supabase.functions.invoke('close-events', { body: { action: 'time' } });
    const t1 = Date.now();
    if (error || !data) return;
    const res = data as { now?: number; timezone?: string };
    if (typeof res.now === 'number') {
      // Correction de la latence réseau : on suppose un trajet symétrique.
      offsetMs = res.now - Math.round((t0 + t1) / 2);
    }
    timeZone = validTimeZone(res.timezone) ?? timeZone;
    syncedAt = t1;
  } catch {
    // Hors ligne : on garde le dernier écart connu (ou l'horloge locale).
  }
}

/** Synchronise si nécessaire, puis renvoie l'instant « serveur » en ms. */
export async function serverNow(): Promise<number> {
  if (Date.now() - syncedAt > RESYNC_MS) {
    pending ??= sync().finally(() => {
      pending = null;
    });
    await pending;
  }
  return Date.now() + offsetMs;
}

/** Fuseau de l'église (IANA), à défaut celui de l'appareil. */
export function churchTimeZone(): string {
  return timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Date et heure murales dans le fuseau de l'église. */
export function wallClock(ms: number, tz: string = churchTimeZone()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** Normalise « HH:MM » / « HH:MM:SS » en « HH:MM:SS ». */
export function normTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
}
