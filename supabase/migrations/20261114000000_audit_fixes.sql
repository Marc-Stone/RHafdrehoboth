-- =====================================================================
-- Correctifs issus de l'audit (14/11/2026)
-- =====================================================================

-- 1) Journal d'activité infalsifiable
-- L'auteur (id, nom, rôle) était fourni par le navigateur : n'importe quel
-- client pouvait écrire une entrée au nom d'un autre. Le déclencheur impose
-- désormais l'identité réelle de la session. Les insertions faites par les
-- fonctions serveur (service role, auth.uid() nul) restent inchangées.
create or replace function public.activity_logs_enforce_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if auth.uid() is null then
    return new;
  end if;

  select full_name, role into p from public.profiles where id = auth.uid();

  new.user_id := auth.uid();
  new.user_name := coalesce(p.full_name, 'Utilisateur');
  new.role_label := case p.role
    when 'super_admin' then 'Super Administrateur'
    when 'pastor' then 'Pasteur'
    when 'secretary' then 'Secrétaire'
    when 'community_leader' then 'Responsable de communauté'
    when 'attendance_agent' then 'Agent de présence'
    else 'Utilisateur'
  end;
  return new;
end;
$$;

drop trigger if exists activity_logs_enforce_author on public.activity_logs;
create trigger activity_logs_enforce_author
  before insert on public.activity_logs
  for each row execute function public.activity_logs_enforce_author();

-- 2) Rappels « la veille » sans doublon
-- La vérification « existe déjà ? » puis insertion n'était pas atomique :
-- deux appels simultanés créaient deux rappels. On supprime les doublons
-- existants puis on pose un index unique (les link_id nuls restent libres).
delete from public.notifications a
using public.notifications b
where a.link_id is not null
  and a.user_id = b.user_id
  and a.link_id = b.link_id
  and a.ctid > b.ctid;

create unique index if not exists notifications_user_link_unique
  on public.notifications (user_id, link_id);

-- 3) Clôture automatique planifiée (recommandé)
-- La clôture ne dépend plus d'un navigateur ouvert si elle est planifiée.
-- 1. Définir le secret de la fonction :  supabase secrets set CRON_SECRET=<valeur>
-- 2. Activer pg_cron et pg_net, puis (en remplaçant <PROJET> et <CRON_SECRET>) :
--
-- select cron.schedule(
--   'close-events-sweep',
--   '*/5 * * * *',
--   $$ select net.http_post(
--        url := 'https://<PROJET>.supabase.co/functions/v1/close-events',
--        headers := jsonb_build_object(
--          'Content-Type','application/json',
--          'Authorization','Bearer <ANON_KEY>',
--          'x-cron-secret','<CRON_SECRET>'),
--        body := '{"action":"sweep"}'::jsonb
--      ) $$
-- );
