import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  ALL_ROLES,
  adminClient,
  anonClient,
  clip,
  corsHeaders,
  json,
  logActivity,
  requireCaller,
} from "../_shared/common.ts";

const MIN_PASSWORD = 8;
// Bannissement « illimité » utilisé pour désactiver un compte : empêche tout
// renouvellement de session (les jetons déjà émis expirent sous ~1 h).
const BAN_FOREVER = "876000h";

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = adminClient();
  const caller = await requireCaller(req, admin, ["super_admin"]);
  if (caller instanceof Response) return caller;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";

  // === VIDAGE DU JOURNAL D'ACTIVITÉ ===
  if (action === "clear-activity") {
    const { error: clearError } = await admin
      .from("activity_logs")
      .delete()
      .not("id", "is", null);
    if (clearError) {
      return json({ error: clearError.message }, 400);
    }
    await logActivity(admin, caller, "suppression", "a vidé l'historique d'activité");
    return json({ ok: true, message: "Historique vidé." }, 200);
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId || !isUuid(userId)) {
    return json({ error: "Identifiant du compte manquant." }, 400);
  }

  // === ACTIVATION / DÉSACTIVATION ===
  if (action === "set-active") {
    const active = body.active === true;
    if (userId === caller.id && !active) {
      return json({ error: "Vous ne pouvez pas désactiver votre propre compte." }, 400);
    }
    const { data: target } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!target) return json({ error: "Compte introuvable." }, 404);

    // Le bannissement coupe le renouvellement des sessions ouvertes : sans lui,
    // un compte désactivé restait connecté et gardait l'accès à l'API.
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : BAN_FOREVER,
    });
    if (banError) return json({ error: banError.message }, 400);

    const { error: profError } = await admin
      .from("profiles")
      .update({ is_active: active })
      .eq("id", userId);
    if (profError) {
      // Retour arrière pour ne pas laisser un état incohérent.
      await admin.auth.admin.updateUserById(userId, { ban_duration: active ? BAN_FOREVER : "none" });
      return json({ error: profError.message }, 400);
    }

    await logActivity(
      admin,
      caller,
      "modification",
      `a ${active ? "activé" : "désactivé"} le compte de ${target.full_name ?? target.email ?? "Utilisateur"}`,
    );
    return json({ ok: true, message: active ? "Compte activé." : "Compte désactivé." }, 200);
  }

  // === MISE À JOUR DU COMPTE ===
  if (action === "update") {
    const name = clip(body.name, 120);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = typeof body.role === "string" ? body.role : "";
    const rawCommunityIds = Array.isArray(body.communityIds)
      ? (body.communityIds as unknown[]).filter((c): c is string => typeof c === "string")
      : [];
    const rawCommunityId = typeof body.communityId === "string" ? body.communityId : "";

    if (!name) return json({ error: "Le nom complet est requis." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Adresse e-mail invalide." }, 400);
    }
    if (!(ALL_ROLES as readonly string[]).includes(role)) {
      return json({ error: "Rôle invalide." }, 400);
    }
    if (userId === caller.id && role !== "super_admin") {
      return json({ error: "Vous ne pouvez pas modifier votre propre rôle." }, 400);
    }

    let communityIds: string[] = [];
    if (role === "community_leader") {
      if (rawCommunityIds.length > 0) {
        communityIds = [...new Set(rawCommunityIds.filter(isUuid))];
      } else if (rawCommunityId && isUuid(rawCommunityId)) {
        communityIds = [rawCommunityId];
      }
    }
    const primaryCommunityId = communityIds.length > 0 ? communityIds[0] : null;

    // État précédent, pour pouvoir revenir en arrière si une étape échoue.
    const { data: before } = await admin
      .from("profiles")
      .select("full_name, email, role, community_id")
      .eq("id", userId)
      .maybeSingle();
    if (!before) return json({ error: "Compte introuvable." }, 404);

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: { full_name: name },
    });
    if (authUpdateError) {
      return json({ error: authUpdateError.message }, 400);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: name, email, role, community_id: primaryCommunityId })
      .eq("id", userId);
    if (profileError) {
      await admin.auth.admin.updateUserById(userId, {
        email: before.email ?? undefined,
        user_metadata: { full_name: before.full_name },
      });
      return json({ error: profileError.message }, 400);
    }

    // Chaque étape de synchronisation est désormais vérifiée : une erreur
    // n'est plus ignorée silencieusement.
    const steps: { label: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [
      {
        label: "retrait des anciennes affectations",
        run: () => admin.from("leader_communities").delete().eq("leader_id", userId),
      },
    ];
    if (role === "community_leader" && communityIds.length > 0) {
      steps.push({
        label: "affectation aux communautés",
        run: () =>
          admin
            .from("leader_communities")
            .insert(communityIds.map((cid) => ({ leader_id: userId, community_id: cid }))),
      });
    }
    steps.push({
      label: "libération des communautés dirigées",
      run: () => admin.from("communities").update({ leader_id: null }).eq("leader_id", userId),
    });
    if (primaryCommunityId) {
      steps.push(
        {
          label: "retrait de l'ancien responsable principal",
          run: () =>
            admin
              .from("profiles")
              .update({ community_id: null })
              .eq("community_id", primaryCommunityId)
              .eq("role", "community_leader")
              .neq("id", userId),
        },
        {
          label: "désignation du responsable principal",
          run: () => admin.from("communities").update({ leader_id: userId }).eq("id", primaryCommunityId),
        },
      );
    }
    for (const step of steps) {
      const { error } = await step.run();
      if (error) {
        return json(
          { error: `Compte enregistré, mais l'étape « ${step.label} » a échoué : ${error.message}` },
          500,
        );
      }
    }

    await logActivity(admin, caller, "modification", `a modifié le compte ${name} (${email}) — rôle ${role}`);
    return json({ ok: true, message: "Compte mis à jour." }, 200);
  }

  // === RÉINITIALISATION DU MOT DE PASSE ===
  if (action === "reset-password") {
    const mode = typeof body.mode === "string" ? body.mode : "set";

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProfile) {
      return json({ error: "Compte introuvable." }, 404);
    }

    const targetName = targetProfile.full_name ?? targetProfile.email ?? "Utilisateur";

    if (mode === "set") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < MIN_PASSWORD) {
        return json({ error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.` }, 400);
      }

      const { error: pwdError } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwdError) {
        return json({ error: pwdError.message }, 400);
      }

      await logActivity(admin, caller, "modification", `a réinitialisé le mot de passe de ${targetName}`);
      return json({ ok: true, message: "Mot de passe mis à jour." }, 200);
    }

    if (mode === "link") {
      if (!targetProfile.email) {
        return json({ error: "Aucune adresse e-mail associée à ce compte." }, 404);
      }

      const redirectTo =
        typeof body.redirectTo === "string" && body.redirectTo ? body.redirectTo : undefined;

      // `generateLink` ne fait que CRÉER le lien (aucun e-mail n'était envoyé,
      // et le lien de récupération était renvoyé au navigateur de l'admin).
      // `resetPasswordForEmail` envoie réellement l'e-mail à l'utilisateur.
      const { error: linkError } = await anonClient().auth.resetPasswordForEmail(
        targetProfile.email,
        redirectTo ? { redirectTo } : undefined,
      );
      if (linkError) {
        return json({ error: linkError.message }, 400);
      }

      await logActivity(
        admin,
        caller,
        "modification",
        `a envoyé un lien de réinitialisation de mot de passe à ${targetName}`,
      );
      return json({ ok: true, message: "Lien de réinitialisation envoyé par e-mail." }, 200);
    }

    return json({ error: "Mode de réinitialisation inconnu." }, 400);
  }

  // === SUPPRESSION DU COMPTE ===
  if (action === "delete") {
    if (userId === caller.id) {
      return json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const targetName = targetProfile?.full_name ?? "Utilisateur";

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return json({ error: deleteAuthError.message }, 400);
    }

    await admin.from("leader_communities").delete().eq("leader_id", userId);
    await admin.from("communities").update({ leader_id: null }).eq("leader_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    await logActivity(
      admin,
      caller,
      "suppression",
      `a supprimé le compte de ${targetName}${targetProfile?.email ? ` (${targetProfile.email})` : ""}`,
    );
    return json({ ok: true, message: "Compte supprimé." }, 200);
  }

  return json({ error: "Action inconnue." }, 400);
});
