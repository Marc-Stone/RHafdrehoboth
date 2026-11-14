import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { adminClient, corsHeaders, json, requireCaller, type Caller } from "../_shared/common.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BUCKET = "images";
const MAX_BYTES = 4 * 1024 * 1024;

// Formats matriciels uniquement : le SVG peut contenir du script et ne doit
// jamais être publié dans un bucket public.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MEMBER_ROLES = ["super_admin", "pastor", "secretary", "community_leader"];

function decodeBase64(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) return null;
  const base64 = match[2];
  // Contrôle de taille AVANT décodage (base64 ≈ 4/3 de la taille réelle).
  if (base64.length > Math.ceil((MAX_BYTES * 4) / 3) + 4) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/** Vérifie que l'appelant a le droit d'écrire à cet emplacement. */
async function canWrite(
  admin: SupabaseClient,
  caller: Caller,
  path: string,
): Promise<string | null> {
  const [folder, name, ...rest] = path.split("/");
  if (!name || rest.length > 0) return "Chemin de fichier invalide.";

  // Avatar : uniquement le sien.
  if (folder === "avatars") {
    return name === caller.id ? null : "Vous ne pouvez modifier que votre propre photo.";
  }

  // Logo de l'église : super administrateur uniquement.
  if (folder === "logo") {
    return caller.role === "super_admin" ? null : "Seul un super administrateur peut changer le logo.";
  }

  // Photo de membre : rôles de gestion des membres ; un responsable seulement
  // pour les membres de ses communautés.
  if (folder === "members") {
    if (!MEMBER_ROLES.includes(caller.role)) return "Action non autorisée pour votre rôle.";
    if (caller.role !== "community_leader") return null;

    const { data: member } = await admin
      .from("members")
      .select("id, community_id")
      .or(`member_number.eq.${name},id.eq.${/^[0-9a-f-]{36}$/i.test(name) ? name : "00000000-0000-0000-0000-000000000000"}`)
      .is("deleted_at", null)
      .maybeSingle();
    if (!member) return "Membre introuvable.";
    const ids = new Set<string>();
    if (member.community_id) ids.add(member.community_id);
    const { data: links } = await admin
      .from("member_communities")
      .select("community_id")
      .eq("member_id", member.id);
    for (const l of (links ?? []) as { community_id: string }[]) ids.add(l.community_id);
    return caller.communityIds.some((c) => ids.has(c))
      ? null
      : "Ce membre n'appartient pas à vos communautés.";
  }

  return "Dossier de destination non autorisé.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée." }, 405);
  }

  const admin = adminClient();
  const caller = await requireCaller(req, admin);
  if (caller instanceof Response) return caller;

  let body: { path?: unknown; dataUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";

  if (!path || path.length > 160 || path.includes("..") || !/^[A-Za-z0-9/._-]+$/.test(path)) {
    return json({ error: "Chemin de fichier invalide." }, 400);
  }

  const denied = await canWrite(admin, caller, path);
  if (denied) return json({ error: denied }, 403);

  const decoded = decodeBase64(dataUrl);
  if (!decoded) {
    return json({ error: "Image invalide : formats acceptés JPEG, PNG, WebP ou GIF (4 Mo maximum)." }, 400);
  }
  if (decoded.bytes.byteLength > MAX_BYTES) {
    return json({ error: "Image trop volumineuse (4 Mo maximum)." }, 400);
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.bytes, {
      upsert: true,
      contentType: decoded.contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    return json({ error: `Envoi impossible : ${uploadError.message}` }, 500);
  }

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
  return json({ publicUrl: publicData.publicUrl }, 200);
});
