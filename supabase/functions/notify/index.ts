import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  adminClient,
  churchTimezone,
  clip,
  corsHeaders,
  insertNotifications,
  json,
  notificationTargets,
  requireCaller,
  wallClock,
} from "../_shared/common.ts";

// Rôles autorisés par action. Avant, n'importe quel jeton valide (y compris
// un compte inactif) pouvait envoyer un texte libre à tous les administrateurs.
const ACTION_ROLES: Record<string, readonly string[]> = {
  "daily-reminders": ["super_admin", "pastor", "secretary", "community_leader", "attendance_agent"],
  "event-created": ["super_admin", "pastor", "secretary"],
  "event-updated": ["super_admin", "pastor", "secretary"],
  "member-added": ["super_admin", "pastor", "secretary", "community_leader"],
  "member-suspended": ["super_admin", "pastor", "secretary", "community_leader"],
};

const isUuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = adminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";
  const allowed = ACTION_ROLES[action];
  if (!allowed) return json({ error: "Action inconnue." }, 400);

  const caller = await requireCaller(req, admin, allowed);
  if (caller instanceof Response) return caller;

  // Un responsable ne peut notifier que pour ses propres communautés.
  const communityId = isUuid(body.communityId) ? body.communityId : null;
  if (
    caller.role === "community_leader" &&
    action !== "daily-reminders" &&
    (!communityId || !caller.communityIds.includes(communityId))
  ) {
    return json({ error: "Communauté non autorisée." }, 403);
  }

  // === RAPPELS QUOTIDIENS (la veille d'un événement) ===
  if (action === "daily-reminders") {
    // « Demain » est calculé dans le fuseau de l'église, et non en UTC.
    const tz = await churchTimezone(admin);
    const dateStr = wallClock(Date.now() + 24 * 60 * 60 * 1000, tz).date;
    const { data: events } = await admin
      .from("events")
      .select("id, title, date, community_id, is_container")
      .is("deleted_at", null)
      .eq("date", dateStr);

    for (const evt of (events ?? []) as {
      id: string;
      title: string;
      date: string;
      community_id: string | null;
      is_container: boolean;
    }[]) {
      if (evt.is_container) continue;
      const linkId = `event-veille-${evt.id}`;
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("link_id", linkId)
        .limit(1);
      if (existing && existing.length > 0) continue;
      const targets = await notificationTargets(admin, evt.community_id, null);
      await insertNotifications(
        admin,
        targets,
        "rappel",
        clip(`Rappel : ${evt.title}`),
        clip(`L'événement « ${evt.title} » a lieu demain (${evt.date}).`, 300),
        linkId,
      );
    }
    return json({ ok: true }, 200);
  }

  // === ÉVÉNEMENT CRÉÉ / MODIFIÉ ===
  if (action === "event-created" || action === "event-updated") {
    const title = clip(body.eventTitle);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.eventDate ?? "")) ? String(body.eventDate) : "";
    const verb = action === "event-created" ? "a été créé" : "a été modifié";
    const targets = await notificationTargets(admin, communityId, caller.id);
    await insertNotifications(
      admin,
      targets,
      "rappel",
      "Événement",
      `L'événement « ${title} » ${verb}${date ? ` (${date})` : ""} par ${clip(caller.fullName, 80)}.`,
    );
    return json({ ok: true }, 200);
  }

  // === NOUVEAU MEMBRE ===
  if (action === "member-added") {
    const name = clip(body.memberName, 120);
    const targets = await notificationTargets(admin, communityId, caller.id);
    await insertNotifications(admin, targets, "info", "Nouveau membre", `${name} a rejoint l'église.`);
    return json({ ok: true }, 200);
  }

  // === MEMBRE SUSPENDU ===
  if (action === "member-suspended") {
    const name = clip(body.memberName, 120);
    const targets = await notificationTargets(admin, communityId, caller.id);
    await insertNotifications(admin, targets, "alerte", "Membre suspendu", `Le membre ${name} a été suspendu.`);
    return json({ ok: true }, 200);
  }

  return json({ error: "Action inconnue." }, 400);
});
