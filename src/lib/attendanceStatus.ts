import type { AttendanceStatus } from '@/lib/types';
import { normTime, wallClock } from '@/lib/serverClock';

export interface EventTimes {
  date: string;
  startTime: string | null;
  presentEndTime: string | null;
  absentStartTime: string | null;
}

/**
 * Calcule le statut de présence d'un pointage selon les seuils configurés
 * à la création de l'événement :
 * - « Présent » : pointage avant la fin des présents (ou l'heure de début) ;
 * - « En retard » : pointage après la fin des présents, mais avant le début
 *   des absents ;
 * - « Absent » : pointage à partir de l'heure de début des absents.
 *
 * Les seuils sont des heures « murales » de l'église : on les compare donc à
 * l'heure murale dans le fuseau de l'église (et non à celle de l'appareil).
 * `now` doit idéalement venir de `serverNow()`.
 */
export function computeAttendanceStatus(
  evt: EventTimes | null | undefined,
  now: number = Date.now(),
): AttendanceStatus {
  if (!evt || !evt.date) return 'Présent';

  const wall = wallClock(now);
  const nowKey = `${wall.date}T${wall.time}`;
  let status: AttendanceStatus = 'Présent';

  const presentEnd = normTime(evt.presentEndTime || evt.startTime);
  if (presentEnd && nowKey > `${evt.date}T${presentEnd}`) {
    status = 'En retard';
  }

  const absentStart = normTime(evt.absentStartTime);
  if (absentStart && nowKey >= `${evt.date}T${absentStart}`) {
    status = 'Absent';
  }

  return status;
}

/** L'heure de fin (ou de début des absents) est-elle dépassée, à l'heure de l'église ? */
export function isPastEndAt(
  evt: { date: string; endTime?: string | null; absentStartTime?: string | null },
  now: number,
): boolean {
  if (!evt.date) return false;
  const end = normTime(evt.endTime) ?? normTime(evt.absentStartTime) ?? '23:59:59';
  const wall = wallClock(now);
  return `${wall.date}T${wall.time}` > `${evt.date}T${end}`;
}

/** L'événement est-il prévu un jour futur (à l'heure de l'église) ? */
export function isFutureDay(evtDate: string, now: number): boolean {
  if (!evtDate) return false;
  return evtDate > wallClock(now).date;
}
