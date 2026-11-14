export const communityTypes: string[] = ['Ministère', 'Groupe', 'Département', 'Cellule'];

export const maritalStatusOptions: string[] = [
  'Célibataire',
  'Marié(e)',
  'Divorcé(e)',
  'Veuf/Veuve',
];

export const memberStatusOptions: string[] = ['Actif', 'Inactif', 'Suspendu'];

export const churchRoleOptions: string[] = [
  'Pasteur',
  'Pasteur adjoint',
  'Ancien',
  'Diacre',
  'Diaconesse',
  'Leader de louange',
  'Responsable de département',
  'Chef de cellule',
  'Membre',
];

export const livingSituationOptions: string[] = [
  'Vit avec sa famille',
  'Vit seul',
  'Colocation',
  'Autre',
];

export const emergencyRelationshipOptions: string[] = [
  'Conjoint(e)',
  'Parent',
  'Enfant',
  'Frère / Sœur',
  'Ami(e)',
  'Autre',
];

export const attendanceStatusOptions: string[] = ['Présent', 'En retard', 'Absent en service', 'Absent'];

export const presentStatuses: string[] = ['Présent', 'En retard'];

export const attendanceStatusStyle: Record<string, string> = {
  'Présent': 'bg-primary-100 text-primary-700',
  'En retard': 'bg-accent-100 text-accent-700',
  'Absent en service': 'bg-secondary-100 text-secondary-700',
  'Absent': 'bg-background-100 text-foreground-500',
};

export const timezoneOptions: string[] = [
  'Africa/Abidjan (GMT+0)',
  'Africa/Dakar (GMT+0)',
  'Africa/Lome (GMT+0)',
  'Africa/Douala (GMT+1)',
  'Africa/Kinshasa (GMT+1)',
  'Europe/Paris (GMT+1)',
];

export const defaultSettings = {
  churchName: '',
  slogan: '',
  pastorName: '',
  leaderName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  foundedYear: new Date().getFullYear(),
  timezone: 'Africa/Abidjan (GMT+0)',
};