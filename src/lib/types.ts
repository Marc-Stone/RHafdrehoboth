export type MemberStatus = 'Actif' | 'Inactif' | 'Suspendu';

export type AttendanceStatus = 'Présent' | 'En retard' | 'Absent en service' | 'Absent';

export interface TrainingItem {
  id: string;
  title: string;
  date: string;
  note: string;
}

export interface EvaluationItem {
  id: string;
  year: string;
  result: string;
  note: string;
}

export interface Member {
  id: string;
  number: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  commune: string;
  profession: string;
  maritalStatus: string;
  livingSituation: string;
  integrationDate: string | null;
  baptismDate: string | null;
  communityId: string | null;
  communityIds: string[];
  community: string;
  leader: string;
  department: string;
  churchRole: string;
  matricule: string;
  status: MemberStatus;
  photoUrl: string | null;
  idDocumentPath: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  bloodGroup: string;
  allergies: string;
  talents: string;
  notes: string;
  trainings: TrainingItem[];
  evaluations: EvaluationItem[];
  medicalHistory: string;
}

export interface MemberInput {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  commune: string;
  profession: string;
  maritalStatus: string;
  livingSituation: string;
  integrationDate: string | null;
  baptismDate: string | null;
  communityIds: string[];
  department: string;
  churchRole: string;
  matricule: string;
  leader: string;
  status: MemberStatus;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  bloodGroup: string;
  allergies: string;
  talents: string;
  notes: string;
  medicalHistory: string;
  trainings: TrainingItem[];
  evaluations: EvaluationItem[];
  /**
   * Indique si les antécédents médicaux doivent être écrits.
   * `false` pour un rôle sans accès médical : évite d'effacer la donnée
   * sensible existante par une chaîne vide.
   */
  saveMedical?: boolean;
  photoDataUrl: string | null;
  photoRemoved: boolean;
  idDocumentDataUrl: string | null;
  idDocumentRemoved: boolean;
}

export interface Community {
  id: string;
  name: string;
  leader: string;
  description: string;
  type: string;
  meetingDay: string;
  meetingTime: string;
  meetingLocation: string;
  icon: string;
}

export type EventStatus = 'À venir' | 'En cours' | 'Terminé';

export interface ChurchEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  presentEndTime: string;
  absentStartTime: string;
  location: string;
  description: string;
  communityId: string | null;
  community: string;
  parentEventId: string | null;
  parentTitle: string;
  isContainer: boolean;
  recordCount: number;
  absentCount: number;
  excusedCount: number;
  totalCount: number;
  closedAt: string | null;
}

export interface EventSessionInput {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  presentEndTime: string;
  absentStartTime: string;
  communityId: string | null;
}

export interface EventInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  presentEndTime: string;
  absentStartTime: string;
  location: string;
  description: string;
  communityId: string | null;
  isContainer: boolean;
  sessions: EventSessionInput[];
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  community: string;
  method: 'QR' | 'Manuel' | 'Repris';
  time: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  /** Session clôturée : les pointages ne sont plus modifiables (sauf administrateur). */
  eventClosed?: boolean;
  scannedBy: string;
  scannedByName: string;
  status: AttendanceStatus;
}

export type ActivityAction =
  | 'pointage'
  | 'ajout'
  | 'modification'
  | 'suppression'
  | 'connexion'
  | 'déconnexion'
  | 'export'
  | 'refus';

export interface ActivityLog {
  id: string;
  user: string;
  role: string;
  action: ActivityAction;
  details: string;
  date: string;
  time: string;
}

export type NotificationType = 'rappel' | 'confirmation' | 'alerte' | 'info';

export interface ChurchNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface ChurchSettings {
  churchName: string;
  slogan: string;
  pastorName: string;
  leaderName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  foundedYear: number;
  timezone: string;
}

/**
 * Heure de fin effective d'un événement : `end_time` en priorité, sinon
 * `absent_start_time`, sinon la fin de journée. Renvoie `null` si indéterminée.
 */
export function eventEndTime(event: { date: string; endTime?: string; absentStartTime?: string }): Date | null {
  if (!event.date) return null;
  const raw = event.endTime || event.absentStartTime ? `${event.date}T${event.endTime || event.absentStartTime}` : `${event.date}T23:59:59`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Un événement est considéré « passé » lorsque l'heure de fin est dépassée.
 * C'est le moment où il doit être clôturé automatiquement.
 */
export function isEventPastEnd(event: { date: string; endTime?: string; absentStartTime?: string }): boolean {
  const end = eventEndTime(event);
  return end ? Date.now() > end.getTime() : false;
}

export function eventStatus(event: { date: string; startTime?: string; endTime?: string; absentStartTime?: string; closedAt?: string | null }): EventStatus {
  if (event.closedAt) return 'Terminé';
  if (!event.date) return 'À venir';
  const now = Date.now();
  const startRaw = event.startTime ? `${event.date}T${event.startTime}` : `${event.date}T00:00:00`;
  const start = new Date(startRaw);
  if (!Number.isNaN(start.getTime()) && now < start.getTime()) return 'À venir';
  const end = eventEndTime(event);
  if (end && now > end.getTime()) return 'Terminé';
  return 'En cours';
}