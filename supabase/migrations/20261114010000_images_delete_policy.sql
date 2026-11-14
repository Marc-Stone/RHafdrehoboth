-- =====================================================================
-- Suppression d'images restreinte (bucket public « images »)
-- =====================================================================
-- Avant : tout utilisateur connecté (y compris un agent de présence) pouvait
-- supprimer N'IMPORTE QUELLE image : logo de l'église, avatars des autres,
-- photos de membres. L'écriture passe déjà exclusivement par la fonction
-- serveur `upload-church-image` (aucune politique INSERT/UPDATE).
drop policy if exists images_auth_delete on storage.objects;

create policy images_auth_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'images'
    and (
      -- Son propre avatar uniquement.
      name = 'avatars/' || auth.uid()::text
      -- Photos de membres : rôles de gestion des membres.
      or (
        name like 'members/%'
        and public.current_user_role() in ('super_admin', 'pastor', 'secretary', 'community_leader')
      )
      -- Logo de l'église : super administrateur.
      or (name like 'logo/%' and public.is_super_admin())
    )
  );
