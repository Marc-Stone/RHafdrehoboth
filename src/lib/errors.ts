export function translateDbError(message: string, mapping: Record<string, string>): string {
  for (const [constraint, friendly] of Object.entries(mapping)) {
    if (message.includes(constraint)) return friendly;
  }
  if (message.includes('duplicate key')) return 'Cette valeur existe déjà.';
  return message;
}

export function nullIfEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return value;
}