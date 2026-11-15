# Gestion des Présences d'Église (Church Presence Manager)

## 1. Description du projet
Application web moderne, responsive et sécurisée permettant à une église de gérer ses membres, ses communautés et ses événements, et d'enregistrer automatiquement les présences via un QR Code personnel scanné à la caméra.

- **Positionnement** : Outil professionnel de gestion de membres et de pointage par QR Code.
- **Utilisateurs cibles** : Petites et grandes églises (pasteurs, secrétaires, responsables de communauté, agents de pointage, administrateurs).
- **Valeur clé** : Automatisation du pointage, cartes de membre avec QR Code, statistiques en temps réel, rapports exportables.

## 2. Structure des pages
- `/login` — Connexion / Réinitialisation du mot de passe
- `/` — Tableau de bord (statistiques, graphiques)
- `/members` — Gestion des membres (liste, ajout, détail, carte, QR Code)
- `/communities` — Gestion des communautés
- `/events` — Gestion des événements
- `/scanner` — Scanner QR Code (pointage)
- `/attendances` — Historique des présences
- `/reports` — Rapports (PDF / Excel)
- `/notifications` — Notifications
- `/activity` — Journal d'activité / historique
- `/settings` — Paramètres de l'église

## 3. Fonctionnalités principales
- [x] Authentification complète (connexion, déconnexion, réinitialisation, sessions, journal)
- [x] Rôles et permissions (Super Admin, Pasteur, Secrétaire, Responsable communauté, Agent pointage)
- [x] Gestion des communautés
- [x] Gestion des membres (profil complet, numéro auto, QR Code unique)
- [x] Génération de QR Code + carte de membre A6 imprimable
- [x] Scanner QR (caméra) avec détection de doublon
- [x] Gestion des événements (avec pointage propre)
- [x] Enregistrement des présences
- [x] Tableau de bord temps réel (stats + graphiques)
- [x] Recherche instantanée
- [x] Rapports PDF / Excel
- [x] Notifications extensibles (e-mail / WhatsApp plus tard)
- [x] Paramètres de l'église
- [x] Journal d'activité complet
- [x] Sécurité (routes protégées, soft delete, validation)
- [x] Thème clair / sombre, interface premium

## 4. Modèle de données (base Supabase)

### Table `profiles` (étend les utilisateurs auth)
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire (lié à auth.users) |
| full_name | text | Nom complet |
| email | text | E-mail |
| role | text | super_admin / pastor / secretary / community_leader / attendance_agent |
| community_id | uuid | Communauté (pour responsable) |
| avatar_url | text | Photo |
| is_active | boolean | Compte actif |
| created_at | timestamptz | Date de création |

### Table `communities`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| name | text | Nom (Chorale, Jeunesse…) |
| description | text | Description |
| leader_id | uuid | Responsable (synchronisé avec profiles.community_id, index unique) |
| created_at | timestamptz | Date de création |

### Table `members`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| member_number | text | Numéro unique auto (EG-000001) |
| first_name | text | Prénom |
| last_name | text | Nom |
| gender | text | Sexe |
| birth_date | date | Date de naissance |
| phone | text | Téléphone |
| email | text | E-mail |
| address | text | Adresse |
| neighborhood | text | Quartier |
| profession | text | Profession |
| marital_status | text | Situation matrimoniale |
| integration_date | date | Date d'intégration |
| baptism_date | date | Date de baptême |
| community_id | uuid | Communauté |
| leader_name | text | Responsable |
| status | text | Actif / Inactif / Suspendu |
| photo_url | text | Photo |
| qr_code | text | Identifiant unique QR Code |
| deleted_at | timestamptz | Soft delete |
| created_at | timestamptz | Date de création |

### Table `events`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| title | text | Titre (Culte, Veillée…) |
| date | date | Date |
| time | time | Heure |
| location | text | Lieu |
| leader | text | Responsable |
| description | text | Description |
| community_id | uuid | Communauté (optionnel) |
| created_at | timestamptz | Date de création |

### Table `attendances`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| member_id | uuid | Membre |
| event_id | uuid | Événement |
| date | date | Date |
| check_in_time | time | Heure |
| community_id | uuid | Communauté |
| scanned_by | uuid | Utilisateur ayant scanné |
| created_at | timestamptz | Date d'enregistrement |
| (contrainte unique member_id + event_id pour éviter les doublons) | | |

### Table `activity_logs`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| user_id | uuid | Utilisateur |
| action | text | connexion / déconnexion / ajout / modification / suppression / pointage / export / connexion_refusée |
| details | text | Détails |
| created_at | timestamptz | Date |

### Table `notifications`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| user_id | uuid | Destinataire |
| type | text | rappel / confirmation / alerte |
| title | text | Titre |
| message | text | Message |
| read | boolean | Lu |
| created_at | timestamptz | Date |

### Table `settings`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid | Clé primaire |
| church_name | text | Nom de l'église |
| logo_url | text | Logo |
| address | text | Adresse |
| phone | text | Téléphone |
| email | text | E-mail |
| primary_color | text | Couleur principale |
| timezone | text | Fuseau horaire |

## 5. Plan d'intégration backend / tiers
- **Base de données** : Supabase (SaaS) — **connecté**. Schéma de production en place (communities, members, events, attendances, activity_logs, notifications, settings + profiles enrichi), avec RLS par rôle, contraintes d'unicité, index, soft delete, numéro de membre auto, journalisation et protection du dernier super admin.
- **Génération QR Code** : bibliothèque côté client.
- **Scanner** : API caméra du navigateur (getUserMedia) + décodage QR.
- **Rapports** : export client (Excel via feuille, PDF via impression).
- **Notifications** : conçu extensible (e-mail via Resend / WhatsApp plus tard).

## 7. Migration vers le réel (statut)

### ✅ Terminé — Fondations base de données & sécurité
- Tables relationnelles complètes (clés primaires, étrangères, contraintes d'intégrité, index).
- RLS activé sur toutes les tables avec politiques par rôle (super_admin, pastor, secretary, community_leader, attendance_agent).
- Soft delete (`deleted_at`) sur members, communities, events.
- Numéro de membre auto (`EG-000001`…), anti-doublon (numéro, téléphone, e-mail, pointage unique membre+événement).
- Bootstrap : premier compte = super admin, suivants = agent de présence (anti-élévation de privilèges).
- Protection du dernier super admin (impossible de le rétrograder/désactiver).

### ✅ Terminé — Migration frontend (données réelles)
- Toutes les pages lisent/écrivent dans Supabase (membres, communautés, événements, présences, scanner, rapports, tableau de bord, journal, notifications, paramètres).
- États vides professionnels sur tous les écrans + gestion d'erreur avec bouton « Réessayer ».
- Validation côté client ET serveur (contraintes uniques, RLS, messages d'erreur clairs).
- Journalisation des actions (ajout, modification, suppression, pointage, création de compte).
- Fichiers de démonstration (`src/mocks`) supprimés.

### ✅ Terminé — Espace Responsable de communauté
- Affectation d'une communauté à un responsable (Super Admin, via la fiche compte).
- Isolation complète au niveau RLS : membres, événements et communautés filtrés par `profiles.community_id`.
- Tableau de bord dédié (membres, présents/absents, taux de présence, graphiques jour/semaine/mois).
- Accès aux membres en lecture seule + historique des présences.
- Module WhatsApp (modèles de messages, envoi individuel / groupé).
- Journalisation des tentatives d'accès refusées.

### ⏳ Restant (optionnel)
- ~~Stockage des images dans Supabase Storage~~ — **fait** (buckets `images` / `documents`, Edge Function `upload-church-image`).
- ~~Alimentation du centre de notifications~~ — **fait** (Edge Function `notify` : notifications internes à l'application).
- Envoi des notifications par **e-mail** (Resend) : non branché.
- Envoi **WhatsApp automatique** (API WhatsApp Business) : non branché — actuellement envoi manuel via liens `wa.me`.

### ✅ Terminé — Audit final & durcissement
- **Intégrité des données** : ajout des contraintes d'unicité manquantes (numéro de membre, téléphone, e-mail, nom de communauté) via index partiels tenant compte du soft-delete. Les messages d'erreur dédiés côté frontend sont désormais réellement déclenchés.
- **Schéma `communities`** : `leader_id` synchronisé automatiquement avec l'affectation du responsable (via `manage-user`), avec index unique pour garantir un seul responsable par communauté ; colonne `leader_name` devenue redondante supprimée (le nom est désormais dérivé par jointure sur `profiles`).
- **Nettoyage** : suppression du code mort (page d'accueil template, page placeholder, import inutilisé), du composant `Toggle` orphelin, de la barre de recherche non fonctionnelle du Topbar et des toggles de notification non persistés.
- **Cohérence** : page 404 francisée et alignée sur la charte graphique, locale par défaut passée en français.

### ✅ Terminé — Améliorations membres & présence
- **Numéro de membre `OAFD-000001`** : le trigger `set_member_number` génère désormais le préfixe `OAFD-`, et les numéros existants (`EG-000001`…`EG-000162`) ont été migrés en `OAFD-000001`…`OAFD-000162`. Numéro unique, généré automatiquement, non modifiable par les utilisateurs.
- **Section « Informations complémentaires »** : nouvelles colonnes sur `members` (`emergency_contact_name`, `emergency_contact_phone`, `blood_group`, `allergies`, `talents`, `notes`), affichées et modifiables dans le formulaire et la fiche membre.
- **Statut de présence** : colonne `status` sur `attendances` (Présent / En retard / Absent en service / Absent). Détection automatique du retard selon l'heure de début de l'événement ; clôture d'événement marquant automatiquement les membres actifs non pointés comme « Absent » ; statut modifiable dans l'historique ; prise en compte dans les statistiques, les rapports et les tableaux de bord.

### ✅ Terminé — Clôture automatique & statuts de présence auto
- **Colonne `closed_at`** sur `events` : verrou temporel d'un événement. Une fois renseignée, tout nouveau pointage est bloqué (le scanner affiche « Clôturé » et un cadenas).
- **Clôture automatique** (`useAutoClose`, monté globalement dans le layout) : à l'ouverture de l'appli, toutes les 60 s, et au retour sur l'onglet, les événements dont l'heure de fin (`end_time` → `absent_start_time` → fin de journée) est dépassée sont clôturés et leurs membres actifs non pointés sont marqués « Absent » (limités à la communauté ciblée).
- **Logique idempotente** (`closeEventInDb`) : protégée contre les doubles clôtures multi-onglets (verrou conditionnel `closed_at IS NULL`).
- **Statuts horaires** : `eventStatus()` tient désormais compte de l'heure (à venir / en cours / terminé) et `checkIn` détermine Présent / En retard / Absent selon `present_end_time` et `absent_start_time`, puis bloque tout pointage après clôture.
- **Rafraîchissement global** : bus léger (`refreshBus`) qui met à jour la liste des événements et des présences dès qu'une clôture (manuelle ou auto) survient.

### ✅ Terminé — Filtre communautaire des événements
- **Pointage** (`checkIn`) : un événement ciblé sur une communauté n'accepte que les membres de cette communauté ; un QR d'une autre communauté affiche un message explicite et n'est pas enregistré.
- **Clôture d'événement** (`closeEvent`) : seuls les membres de la communauté ciblée sont marqués « Absent » (tous si événement global).
- **Scanner** : la liste des membres, la recherche, le simulateur et les statistiques (membres attendus, taux de présence) sont filtrés selon la communauté de l'événement sélectionné. Les rapports, exports et tableaux de bord redeviennent justes par propagation (ils lisent les données de `attendances`).

### ✅ Terminé — Refonte complète du formulaire membre
- **Formulaire par onglets** : Identité → Contact → Situation personnelle → Affectation → Suivi, avec navigation compacte (responsive mobile/desktop) et disposition 2 colonnes sur ordinateur.
- **Identité** : photo d'identité (bucket public `images`) + copie de pièce d'identité (bucket privé `documents`, URL signée, jamais publique), avec aperçu / remplacement / suppression avant enregistrement.
- **Contact** : ajout de `commune` et `emergency_contact_relationship` (lien de parenté). Toute valeur absente s'affiche « Non renseigné » (plus jamais « Anonyme »).
- **Situation personnelle** : ajout de `living_situation` (situation de vie) et des **antécédents médicaux** (table séparée `member_medical`, RLS restreint à `can_manage_data()`, journalisée, exclue des listes/tableaux de bord).
- **Affectation** : **multi-communautés** via table de jointure `member_communities` (une communauté principale conservée sur `members.community_id` pour la rétro-compatibilité), ajout de `department` et `matricule`.
- **Suivi** : historique des présences affiché automatiquement depuis le pointage (lecture seule), formations (`trainings`) et évaluations annuelles (`evaluations`) en listes JSONB modifiables.
- **Sécurité** : `canAccessMedicalData()` (super_admin, pastor, secretary) pour le médical et la pièce d'identité ; RLS `member_communities` restreint à `can_manage_data()` en écriture ; visibilité multi-communautés étendue aux responsables via `members_select`.
- **Propagation multi-communautés** : pointage (`checkIn`), scanner, WhatsApp, tableau de bord responsable et clôture d'événement (marquage des absents) tiennent désormais compte de toutes les affectations.

## 6. Plan de développement par phases

### Phase 1 : Authentification + Structure + Tableau de bord
- Objectif : poser les fondations visuelles et la navigation.
- Livrable : page de connexion, layout avec barre latérale (menu par rôle), tableau de bord avec statistiques et graphiques, thème clair/sombre.

### Phase 2 : Gestion des membres
- Objectif : gérer le cycle de vie des membres.
- Livrable : liste des membres (recherche instantanée), ajout/édition, fiche détaillée, génération du numéro et du QR Code, carte de membre A6 imprimable.

### Phase 3 : Communautés
- Objectif : gérer les communautés.
- Livrable : liste, création, modification, suppression (soft delete).

### Phase 4 : Événements
- Objectif : gérer les événements avec leur pointage.
- Livrable : liste, création, détail, pointage propre à chaque événement.
- **Statut : Terminé** — page `/events` (liste, création/édition/suppression, statuts, filtre par statut et recherche) ; page `/attendances` (historique complet des pointages par événement et par date, recherche, export PDF) ; scanner ciblé sur un événement sélectionnable.

### Phase 5 : Scanner QR Code
- Objectif : pointage par caméra.
- Livrable : page scanner, détection du membre, enregistrement automatique, détection doublon.

### Phase 6 : Présences + Rapports
- Objectif : consulter et exporter.
- Livrable : historique des présences, rapports journalier/hebdo/mensuel/annuel par communauté/membre/événement, export PDF/Excel.
- **Statut : Terminé** — page `/reports` (rapports journalier / hebdo / mensuel, navigation entre périodes, filtre par communauté, graphique d'évolution + répartition par communauté, tableau détaillé, export PDF / Excel) ; historique personnel des présences ajouté sur la fiche membre (`/members/:number`) avec statistiques, graphique mensuel et liste chronologique des événements pointés.

### Phase 7 : Notifications + Historique + Paramètres
- Objectif : finaliser le périmètre système.
- Livrable : centre de notifications, journal d'activité, page paramètres.

### Phase 8 : Sécurité avancée + rôles fins
- Objectif : durcir l'application.
- Livrable : protection des routes, permissions granulaires, soft delete, validation, gestion des rôles.

## Notes
- Chaque phase est validée avec l'utilisateur avant de passer à la suivante.
- Connexion Supabase déclenchée dès que l'utilisateur souhaite des données réelles.

### ✅ Terminé — Audit sécurité & isolation des données
- **Anti-élévation de privilèges** : la fonction `handle_new_user` (trigger sur `auth.users`) faisait confiance à `raw_user_meta_data.role` pour attribuer le rôle à l'inscription. N'importe quel appel direct à l'API Supabase avec `role: 'super_admin'` dans les métadonnées pouvait créer un super admin. La fonction ne repose plus que sur la règle de bootstrap (1er compte = super_admin, suivants = agent de présence). Les rôles ne sont désormais attribués que via les Edge Functions sécurisées (`create-user`, `manage-user`) contrôlées par le super admin.
- **Isolation des présences (multi-communautés)** : la politique RLS `attendances_select` ne tenait compte que de `members.community_id` (communauté principale) pour les responsables de communauté. Un responsable ne voyait donc pas les présences des membres affectés via la table de jointure `member_communities`. La politique inclut désormais les deux chemins, alignée sur `members_select`.

### ✅ Terminé — Événements en plusieurs parties (sessions)
- **Concept** : un événement « parent » (ex. « Culte du dimanche ») peut regrouper plusieurs **sessions** (ex. « 1er culte », « 2e culte »), chacune avec ses propres horaires de pointage et sa propre liste de présence.
- **Schéma** : colonnes `parent_event_id` (auto-référence `events.id`) et `is_container` (booléen) sur la table `events`. Une session est un événement avec `parent_event_id` renseigné ; un conteneur a `is_container = true`.
- **Pointage indépendant** : chaque session se pointe séparément (le scanner, la clôture, les absents, les stats et les rapports fonctionnent par session, sans changement de logique).
- **Formulaire** : bascule « Événement en plusieurs parties » qui affiche une liste dynamique de sessions (nom + 4 horaires chacune), avec ajout/retrait et validation par session.
- **Affichage** : les sessions sont groupées sous leur événement parent dans la page `/events` ; les conteneurs sont exclus du scanner, des tableaux de bord et de la clôture automatique.

### ✅ Terminé — Reprise de base entre sessions d'un événement
- **Concept** : une session peut reprendre les résultats de la session précédente comme **base de travail**, sans jamais partager ses horaires. La session 1 enregistre ses présences, la session 2 reprend cette base puis ajoute, retire ou corrige librement.
- **Indépendance totale** : la reprise copie uniquement les **statuts** (membre + statut) dans de nouvelles lignes de `attendances` rattachées à la session cible. Aucune heure de pointage n'est copiée et aucune horaire d'événement n'est modifié : chaque session garde ses propres `start_time` / `end_time` / `present_end_time` / `absent_start_time`.
- **Mode de pointage `Repris`** : les lignes issues d'une reprise sont identifiées dans les listes, l'historique et les rapports (ne comptent ni comme QR ni comme saisie manuelle).
- **UI** : bouton « Reprendre » sur chaque session (à partir de la 2e) dans `/events`, avec fenêtre d'aperçu (présents / retards / en service / absents, nombre de membres à ajouter, doublons ignorés).
- **Correction d'un pointage repris** : depuis le scanner, un membre déjà présent dans la base peut être pointé réellement (mise à jour de la ligne existante avec l'heure de la session en cours, plus aucune création de doublon).
- **Non-régression** : les événements simples (sans sessions) ne sont pas concernés.

### ✅ Terminé — Validation de la reprise entre sessions
- **Comptabilisation** : les lignes `method = 'Repris'` sont comptées normalement dans les statistiques de présence (totaux, taux de présence, rapports PDF/Excel, cartes de session). Seules les statistiques de **mode de pointage** (taux QR, « QR / Manuel ») les excluent explicitement.
- **Reprise vérifiée** : présents, retards, absents et absents en service repris avec leur statut ; membres déjà enregistrés sur la session cible conservés intacts ; horaires jamais copiés ; suppression d'un membre limitée à sa seule session.
- **Correction d'un pointage repris** : la promotion d'une ligne reprise (scanner QR, saisie manuelle ou modification de statut) est bloquée après l'heure de fin, comme un pointage classique, et signale explicitement un refus de droits au lieu d'afficher un faux succès.
- **Droits de pointage** : politiques RLS additionnelles sur `attendances`, strictement limitées à `method = 'Repris'` — lecture pour l'agent de pointage, mise à jour et suppression pour l'agent (toutes sessions) et pour le responsable de communauté (membres de ses communautés uniquement).
- **Statistiques à jour** : le cache des événements est invalidé avec celui des présences après chaque pointage, promotion, changement de statut ou suppression, pour que les compteurs « présents / absents » d'une session ne restent jamais périmés.

### ✅ Terminé — Audit de sécurité de la reprise entre sessions
- **Origine protégée en base** : la colonne `attendances.method` est désormais contrainte (`QR`, `Manuel`, `Repris` via `attendances_method_check`). L'origine n'est plus un simple libellé d'interface.
- **Trigger `attendances_guard_write`** (`BEFORE UPDATE` / `BEFORE DELETE` sur `attendances`, `SECURITY DEFINER` + `search_path` verrouillé, les trois rôles administratifs étant exemptés) qui garantit :
  - un pointage ne peut jamais changer de **membre** ni de **session** (aucune contamination croisée entre sessions) ;
  - l'origine « Repris » ne peut pas être forgée : seul le mécanisme de reprise crée cette valeur ;
  - une origine ne change qu'accompagnée d'un **pointage réel** (heure renseignée + auteur = utilisateur courant) ;
  - aucune **modification ni suppression** de présence sur une session **clôturée**, sauf autorisation administrative (`super_admin`, `pastor`, `secretary`).
- **Vérifications RLS** : les politiques additionnelles restent strictement limitées à `method = 'Repris'` ; aucun droit supplémentaire n'est accordé sur les lignes QR/manuel, et aucune combinaison de politiques ne permet d'élargir l'accès (le contrôle d'origine côté trigger ferme le contournement par changement de `method`).
- **Cohérence des suppressions** : la suppression d'un événement masque d'abord l'événement puis supprime ses pointages, avec retour arrière si le nettoyage échoue (avant, les présences étaient détruites avant de constater un refus de droits).
- **UI** : les sessions clôturées portent un badge « Clôturée » dans l'historique des présences et le changement de statut y est désactivé pour les rôles non administratifs.

### ✅ Terminé — Responsables multi-communautés
- **Concept** : un responsable de communauté peut désormais être affecté à **une ou plusieurs** communautés (au lieu d'une seule), conformément au cahier des charges.
- **Schéma** : nouvelle table de liaison `leader_communities` (`leader_id`, `community_id`), avec RLS (lecture : `can_manage_data() OR leader_id = auth.uid()` ; écriture : `can_manage_data()`). La colonne `profiles.community_id` reste la communauté « principale » (rétro-compatibilité).
- **Permissions** : nouvelle fonction `is_community_leader_of(cid)` (communauté principale + table de liaison), utilisée par `can_manage_community` et les politiques RLS `members_select`, `attendances_select`, `events_select`, `communities_select`.
- **Edge Functions** : `manage-user` accepte désormais `communityIds[]` et synchronise `leader_communities` ; `notify` notifie tous les responsables d'une communauté (principale + liaison).
- **Frontend** : formulaire de modification de compte avec sélection multiple des communautés (cases à cocher), affichage de toutes les communautés dans la page Utilisateurs, et `AuthUser` expose `communityIds` (chargé depuis `leader_communities`). Le tableau de bord responsable et le module WhatsApp filtrent sur l'ensemble des communautés affectées.