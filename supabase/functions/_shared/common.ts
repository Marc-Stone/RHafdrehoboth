import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const ALL_ROLES = [
  "super_admin",
  "pastor",
  "secretary",
  "community_leader",
  "attendance_agent",
] as const;

export type Role = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrateur",
  pastor: "Pasteur",
  secretary: "Secrétaire",
  community_leader: "Responsable de communauté",
  attendance_agent: "Agent de présence",
};

export function json(obj: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function anonClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Extrait le jeton « Bearer » (insensible à la casse). */
export function bearerToken(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  return header.replace(/^bearer\s+/i, "").trim();
}

export interface Caller {
  id: string;
  email: string | null;
  role: Role;
  fullName: string;
  communityIds: string[];
}

/**
 * Identifie l'appelant et vérifie que son compte existe, est ACTIF et possède
 * un rôle valide. Renvoie une Response d'erreur sinon.
 *
 * Toute fonction privilégiée doit passer par ici : un jeton encore valide d'un
 * compte désactivé (ou d'une inscription publique non validée) ne doit
 * jamais suffire.
 */
export async function requireCaller(
  req: Request,
  admin: SupabaseClient,
  allowedRoles?: readonly string[],
): Promise<Caller | Response> {
  const token = bearerToken(req);
  if (!token) return json({ error: "Non autorisé." }, 401);

  const { data: authData, error: authError } = await anonClient().auth.getUser(token);
  if (authError || !authData.user) {
    return json({ error: "Session invalide ou expirée." }, 401);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, is_active, community_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile) return json({ error: "Profil introuvable." }, 403);
  if (profile.is_active === false) return json({ error: "Compte désactivé." }, 403);
  if (!(ALL_ROLES as readonly string[]).includes(profile.role ?? "")) {
    return json({ error: "Rôle invalide." }, 403);
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return json({ error: "Action non autorisée pour votre rôle." }, 403);
  }

  const communityIds = new Set<string>();
  if (profile.community_id) communityIds.add(profile.community_id);
  if (profile.role === "community_leader") {
    const { data: links } = await admin
      .from("leader_communities")
      .select("community_id")
      .eq("leader_id", authData.user.id);
    for (const row of (links ?? []) as { community_id: string }[]) {
      communityIds.add(row.community_id);
    }
  }

  return {
    id: authData.user.id,
    email: authData.user.email ?? null,
    role: profile.role as Role,
    fullName: profile.full_name ?? authData.user.email ?? "Utilisateur",
    communityIds: [...communityIds],
  };
}

/** Coupe une chaîne libre à une longueur raisonnable (anti-injection de texte). */
export function clip(value: unknown, max = 160): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

/** Lit toutes les lignes d'une requête paginée (contourne la limite de 1000 lignes). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** Fuseau IANA de l'église (paramètres), ex. « Africa/Abidjan (GMT+0) » → « Africa/Abidjan ». */
export async function churchTimezone(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("settings").select("timezone").limit(1).maybeSingle();
  const raw = (data?.timezone as string | null) ?? "";
  const tz = raw.split(" ")[0] || "Africa/Abidjan";
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
    return tz;
  } catch {
    return "Africa/Abidjan";
  }
}

/** Date et heure « murales » dans un fuseau donné : { date: AAAA-MM-JJ, time: HH:MM:SS }. */
export function wallClock(ms: number, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

/** Normalise « HH:MM » / « HH:MM:SS » en « HH:MM:SS ». */
export function normTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`;
}

/** Destinataires des notifications : admins actifs + responsables de la communauté. */
export async function notificationTargets(
  admin: SupabaseClient,
  communityId: string | null,
  excludeId: string | null,
): Promise<string[]> {
  const ids = new Set<string>();
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "pastor", "secretary"])
    .eq("is_active", true);
  for (const row of (admins ?? []) as { id: string }[]) ids.add(row.id);

  if (communityId) {
    const { data: leaders } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "community_leader")
      .eq("community_id", communityId)
      .eq("is_active", true);
    for (const row of (leaders ?? []) as { id: string }[]) ids.add(row.id);

    const { data: linked } = await admin
      .from("leader_communities")
      .select("leader_id")
      .eq("community_id", communityId);
    const linkedIds = ((linked ?? []) as { leader_id: string }[]).map((r) => r.leader_id);
    if (linkedIds.length > 0) {
      // Seuls les responsables encore actifs sont notifiés.
      const { data: activeLinked } = await admin
        .from("profiles")
        .select("id")
        .in("id", linkedIds)
        .eq("is_active", true);
      for (const row of (activeLinked ?? []) as { id: string }[]) ids.add(row.id);
    }
  }
  if (excludeId) ids.delete(excludeId);
  return [...ids];
}

export async function insertNotifications(
  admin: SupabaseClient,
  userIds: string[],
  type: string,
  title: string,
  message: string,
  linkId?: string,
) {
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type,
    title,
    message,
    link_id: linkId ?? null,
  }));
  const { error } = await admin.from("notifications").insert(rows);
  // 23505 = doublon (index unique user_id + link_id) : un autre appel a déjà
  // créé ces rappels, ce n'est pas une erreur.
  if (error && (error as { code?: string }).code !== "23505") {
    console.error("[notifications] insertion impossible :", error.message);
  }
}

export async function logActivity(
  admin: SupabaseClient,
  caller: Pick<Caller, "id" | "fullName" | "role">,
  action: string,
  details: string,
) {
  await admin.from("activity_logs").insert({
    user_id: caller.id,
    user_name: caller.fullName,
    role_label: ROLE_LABELS[caller.role] ?? "Utilisateur",
    action,
    details,
  });
}
