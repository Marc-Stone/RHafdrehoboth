/**
 * Lit TOUTES les lignes d'une requête Supabase, page par page.
 *
 * PostgREST limite chaque réponse (1000 lignes par défaut) : sans pagination,
 * au-delà de ce seuil les listes, tableaux de bord et rapports étaient
 * silencieusement tronqués. La requête fournie doit avoir un tri stable
 * (idéalement terminé par une colonne unique comme `id`).
 */
export const PAGE_SIZE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
