import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  ALL_ROLES,
  adminClient,
  clip,
  corsHeaders,
  json,
  logActivity,
  requireCaller,
} from "../_shared/common.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = adminClient();
  // Super admin ACTIF uniquement (un compte désactivé avec un jeton encore
  // valide ne peut plus créer de comptes).
  const caller = await requireCaller(req, admin, ["super_admin"]);
  if (caller instanceof Response) return caller;

  let body: { name?: string; email?: string; role?: string; redirectTo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const name = clip(body.name, 120);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;

  if (!name) return json({ error: "Le nom complet est requis." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Adresse e-mail invalide." }, 400);
  }
  if (!(ALL_ROLES as readonly string[]).includes(role)) {
    return json({ error: "Rôle invalide." }, 400);
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: name },
      ...(redirectTo ? { redirectTo } : {}),
    },
  );

  if (inviteError) {
    const msg = inviteError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return json({ error: "Un compte existe déjà avec cet e-mail." }, 400);
    }
    return json({ error: inviteError.message }, 400);
  }

  if (invited?.user?.id) {
    // Le déclencheur crée le profil en « inactif » : l'invitation vient d'un
    // super administrateur, le compte est donc actif dès sa création.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        { id: invited.user.id, email, full_name: name, role, is_active: true },
        { onConflict: "id" },
      );
    if (profileError) {
      return json(
        { error: `Invitation envoyée, mais le profil n'a pas pu être configuré : ${profileError.message}` },
        500,
      );
    }
  }

  await logActivity(admin, caller, "ajout", `a créé le compte de ${name} (${email}) avec le rôle ${role}`);

  return json({ ok: true, message: "Invitation envoyée par e-mail." }, 200);
});
