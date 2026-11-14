import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  adminClient,
  churchTimezone,
  clip,
  corsHeaders,
  fetchAll,
  insertNotifications,
  json,
  logActivity,
  normTime,
  notificationTargets,
  requireCaller,
  wallClock,
  type Caller,
} from "../_shared/common.ts";

/**
 * Clôture des événements côté serveur.
 *
 * Avant, la clôture tournait dans le navigateur :
 * - elle ne se faisait que si quelqu'un avait l'application ouverte ;
 * - la liste des membres « attendus » dépendait des droits (RLS) de la
 *   personne connectée (un responsable ne voyait que sa communauté) ;
 * - les lectures étaient tronquées à 1000 lignes ;
 * - certaines erreurs laissaient l'événement verrouillé sans ses absents.
 *
 * Actions :
 * - `time`  : heure du serveur + fuseau de l'église (horloge de pointage) ;
 * - `close` : clôture manuelle d'un événement ;
 * - `sweep` : clôture de tous les événements dont l'heure de fin est passée.
 *   Peut être planifiée (cron) avec l'en-tête `x-cron-secret: <CRON_SECRET>`.
 */

const CLOSE_ROLES = ["super_admin", "pastor", "secretary", "community_leader"];

interface EventRow {
  id: string;
  title: string;
  date: string;
  end_time: string | null;
  absent_start_time: string | null;
  community_id: string | null;
  parent_event_id: string | null;
  closed_at: string | null;
  deleted_at: string | null;
  is_container: boolean;
}

const EVENT_COLS =
  "id, title, date, end_time, absent_start_time, community_id, parent_event_id, closed_at, deleted_at, is_container";

async function effectiveCommunity(admin: SupabaseClient, evt: EventRow): Promise<string | null> {
  if (evt.community_id) return evt.community_id;
  let parentId = evt.parent_event_id;
  for (let depth = 0; parentId && depth < 3; depth += 1) {
    const { data: parent } = await admin
      .from("events")
      .select("community_id, parent_event_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return null;
    if (parent.community_id) return parent.community_id;
    parentId = parent.parent_event_id;
  }
  return null;
}

function isPastEnd(evt: EventRow, nowWall: { date: string; time: string }): boolean {
  if (!evt.date) return false;
  const end = normTime(evt.end_time) ?? normTime(evt.absent_start_time) ?? "23:59:59";
  return `${nowWall.date}T${nowWall.time}` > `${evt.date}T${end}`;
}

async function closeOne(
  admin: SupabaseClient,
  evt: EventRow,
  actor: Caller | null,
): Promise<{ error: string | null; markedAbsent: number; alreadyClosed?: boolean }> {
  const communityId = await effectiveCommunity(admin, evt);

  // Verrou : seule la première clôture l'emporte (plusieurs onglets / cron).
  const { data: claimed, error: claimErr } = await admin
    .from("events")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", evt.id)
    .is("closed_at", null)
    .is("deleted_at", null)
    .select("id");
  if (claimErr) return { error: claimErr.message, markedAbsent: 0 };
  if (!claimed || claimed.length === 0) {
    return { error: null, markedAbsent: 0, alreadyClosed: true };
  }

  const release = async (message: string) => {
    await admin.from("events").update({ closed_at: null }).eq("id", evt.id);
    return { error: message, markedAbsent: 0 };
  };

  try {
    // Membres attendus : actifs, non supprimés, limités à la communauté.
    const activeMembers = await fetchAll<{ id: string; community_id: string | null }>((from, to) =>
      admin
        .from("members")
        .select("id, community_id")
        .eq("status", "Actif")
        .is("deleted_at", null)
        .order("id")
        .range(from, to)
    );

    let expected = activeMembers.map((m) => m.id);
    if (communityId) {
      const inCommunity = new Set(
        activeMembers.filter((m) => m.community_id === communityId).map((m) => m.id),
      );
      const links = await fetchAll<{ member_id: string }>((from, to) =>
        admin
          .from("member_communities")
          .select("member_id")
          .eq("community_id", communityId)
          .order("member_id")
          .range(from, to)
      );
      links.forEach((l) => inCommunity.add(l.member_id));
      const activeSet = new Set(expected);
      expected = [...inCommunity].filter((id) => activeSet.has(id));
    }

    const existing = await fetchAll<{ member_id: string }>((from, to) =>
      admin
        .from("attendances")
        .select("member_id")
        .eq("event_id", evt.id)
        .order("member_id")
        .range(from, to)
    );
    const existingIds = new Set(existing.map((r) => r.member_id));
    const absent = expected.filter((id) => !existingIds.has(id));

    for (let i = 0; i < absent.length; i += 500) {
      const chunk = absent.slice(i, i + 500).map((memberId) => ({
        member_id: memberId,
        event_id: evt.id,
        date: evt.date,
        status: "Absent",
        method: "Manuel",
        scanned_by: actor?.id ?? null,
      }));
      // `ignoreDuplicates` : un pointage arrivé pendant la clôture n'est pas
      // écrasé et ne fait pas échouer tout le lot.
      const { error: insErr } = await admin
        .from("attendances")
        .upsert(chunk, { onConflict: "member_id,event_id", ignoreDuplicates: true });
      if (insErr) {
        // Retire les absents déjà insérés par les lots précédents.
        if (i > 0) {
          const inserted = absent.slice(0, i);
          for (let j = 0; j < inserted.length; j += 500) {
            await admin
              .from("attendances")
              .delete()
              .eq("event_id", evt.id)
              .eq("status", "Absent")
              .is("check_in_time", null)
              .in("member_id", inserted.slice(j, j + 500));
          }
        }
        return await release(insErr.message);
      }
    }

    const details = `a clôturé l'événement « ${clip(evt.title)} » (${absent.length} absent(s) marqué(s))`;
    if (actor) {
      await logActivity(admin, actor, "pointage", details);
    } else {
      await admin.from("activity_logs").insert({
        user_id: null,
        user_name: "Clôture automatique",
        role_label: "Système",
        action: "pointage",
        details,
      });
    }

    const targets = await notificationTargets(admin, communityId, actor?.id ?? null);
    await insertNotifications(
      admin,
      targets,
      "confirmation",
      "Événement clôturé",
      `L'événement « ${clip(evt.title)} » est clôturé (${absent.length} absent(s)).`,
    );

    return { error: null, markedAbsent: absent.length };
  } catch (e) {
    return await release(e instanceof Error ? e.message : "Erreur inconnue lors de la clôture.");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = adminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = typeof body.action === "string" ? body.action : "";

  // Appel planifié (cron) : authentifié par un secret partagé.
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const isCron = cronSecret.length > 0 && req.headers.get("x-cron-secret") === cronSecret;

  let caller: Caller | null = null;
  if (!isCron) {
    const res = await requireCaller(req, admin);
    if (res instanceof Response) return res;
    caller = res;
  } else if (action !== "sweep") {
    return json({ error: "Action non autorisée pour une tâche planifiée." }, 403);
  }

  const tz = await churchTimezone(admin);

  // === HORLOGE DU SERVEUR ===
  if (action === "time") {
    return json({ now: Date.now(), timezone: tz }, 200);
  }

  // === CLÔTURE MANUELLE ===
  if (action === "close") {
    if (!caller || !CLOSE_ROLES.includes(caller.role)) {
      return json({ error: "Action non autorisée pour votre rôle." }, 403);
    }
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const { data: evt } = await admin.from("events").select(EVENT_COLS).eq("id", eventId).maybeSingle();
    if (!evt || (evt as EventRow).deleted_at) return json({ error: "Événement introuvable." }, 404);
    if ((evt as EventRow).is_container) {
      return json({ error: "Un événement en plusieurs parties se clôture session par session." }, 400);
    }
    if (caller.role === "community_leader") {
      const cid = await effectiveCommunity(admin, evt as EventRow);
      if (!cid || !caller.communityIds.includes(cid)) {
        return json({ error: "Vous ne pouvez clôturer que les événements de vos communautés." }, 403);
      }
    }
    const result = await closeOne(admin, evt as EventRow, caller);
    if (result.error) return json({ error: result.error, markedAbsent: 0 }, 500);
    return json({ ok: true, markedAbsent: result.markedAbsent, alreadyClosed: Boolean(result.alreadyClosed) }, 200);
  }

  // === CLÔTURE AUTOMATIQUE ===
  if (action === "sweep") {
    const nowWall = wallClock(Date.now(), tz);
    const open = await fetchAll<EventRow>((from, to) =>
      admin
        .from("events")
        .select(EVENT_COLS)
        .is("deleted_at", null)
        .is("closed_at", null)
        .eq("is_container", false)
        .lte("date", nowWall.date)
        .order("id")
        .range(from, to)
    );
    const due = open.filter((e) => isPastEnd(e, nowWall));
    let closed = 0;
    const errors: string[] = [];
    for (const evt of due) {
      const r = await closeOne(admin, evt, null);
      if (r.error) errors.push(`${evt.title} : ${r.error}`);
      else if (!r.alreadyClosed) closed += 1;
    }
    return json({ ok: errors.length === 0, closed, errors }, 200);
  }

  return json({ error: "Action inconnue." }, 400);
});
