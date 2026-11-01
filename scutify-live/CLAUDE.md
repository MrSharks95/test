# CLAUDE.md — Scutify Live

App **indépendante** de l'app Shopify de la racine (le CLAUDE.md racine ne
s'applique pas ici, sauf l'esprit des règles de sécurité Supabase).
Page de live StreamYard + chat modéré pour **~4 000 spectateurs**, une soirée.
Interface **en français**, code en anglais. Communication avec l'utilisateur
en français, concise, actionnable. Voir README.md pour le détail.

## Production (à jour au 01/11/2026)
- **URL** : https://live.scutify.io/live · admin : https://live.scutify.io/admin
  (DNS `live` CNAME → Vercel chez Infomaniak ; ancien domaine
  `test-five-xi-y6pdflcbnz.vercel.app` toujours actif).
- **Live** : lundi 02/11/2026 à 20h (StreamYard `bjJkQR6HBCpX`).
- **Supabase** : projet `scutify-live`, ref `jmzneakxezblpksdhaos`, région
  Paris (eu-west-3), org « LevelUp » en Pro **pay-as-you-go** (pas de spend
  cap), compute **Medium** (à redescendre après le live). Auth : anonymous
  sign-ins ON, rate limits anonymes 1000/h/IP, token refresh 500/5 min.
  Realtime : accès public OFF, pool DB 10, 10 000 clients, 2 500 évts/s.
- **Vercel** : équipe « Charly » (`team_75qyLhAbNOaJshm8LXUg0LTp`), projet
  `scutify-live` (`prj_CG6oQYsEAd3IYvwHipYnu67XpWdg`), Root Directory
  `scutify-live`, déploie `main` du dépôt MrSharks95/test. Valeurs publiques
  dans `.env.production` (pas de variables à saisir).
- **Admin** : ecomprocharly@gmail.com (pseudo « Equipe Scutify »). Ajouter un
  membre : compte créé dans Supabase Auth puis
  `select private.promote_to_admin('email', 'Pseudo');`.

## Accès outils (important)
- Supabase MCP : `execute_sql` OK pour SELECT / UPDATE / DDL non destructif.
  `apply_migration` et les DROP déclenchent une confirmation que
  l'utilisateur ne voit pas (timeout) → lui faire coller le SQL dans
  *SQL Editor* (fichier sur GitHub, bouton « Copy raw file »).
- Vercel MCP : **lecture seule** (403 sur création projet / domaine / deploy).
- GitHub : workflow = branche `claude/eloquent-shannon-016l20` → PR → merge
  (l'utilisateur a délégué « prépare tout ») → Vercel déploie `main`.
  Rebaser la branche sur `origin/main` avant chaque PR.
- Docker local instable (meurt entre les tours) ; stack Supabase locale dans
  le scratchpad `sb/` si besoin (`supabase start -x …`).

## Décisions à préserver
- Écritures uniquement via fonctions SQL `SECURITY DEFINER` (`send_message`,
  `set_profile`, `admin_*`) ; aucune policy INSERT/UPDATE/DELETE viewers ;
  RLS partout (y compris tables `private.*`).
- Realtime **Broadcast** canal **privé** `live-chat`, alimenté par la base
  (`realtime.send`). Jamais de Postgres Changes, jamais de Presence (O(n²) à
  4 000). Aucune policy INSERT sur `realtime.messages`.
- Messages diffusés **par lots** (`private.flush_messages`, pg_cron chaque
  seconde, `broadcast_interval_seconds` = **3 s**, ≤ 100 messages / lot) :
  chaque diffusion compte une fois PAR spectateur dans le quota (≈ 1 330
  évts/s à 4 000). Ne jamais revenir à une diffusion par message.
- `messages` UNLOGGED, purge 12 h ; purge cron history / compteurs / etc.
- État initial et resync via `/api/chat/snapshot` (cache CDN ~1 s) + resync
  de rattrapage 2,5 s après chaque abonnement (jitter en reconnexion).
- Messages `shadow` (mots-clés) jamais diffusés ; équipe non filtrée.
- **Pseudo seul pour écrire** (email facultatif, non demandé : l'utilisateur
  a déjà les emails via sa page d'inscription). Chat lisible sans rien saisir.
- Anti-spam par IP (`cf-connecting-ip`, non falsifiable) : 20 msg/10 s,
  30 pseudos/10 min (`chat_settings.ip_*`, 0 = off). **À couper pendant un
  test de charge / démo** (une seule machine), puis remettre 20/30.
- Chat fermé = **masqué** chez les spectateurs (équipe le voit).
- Pas de fausse activité (refusé : faux spectateurs) ; pas de compteur de
  spectateurs (refusé par l'utilisateur).
- `SUPABASE_SERVICE_ROLE_KEY` : scripts locaux uniquement, jamais NEXT_PUBLIC_.
- **Réactions** 🔥 💰 ❤️ 👍 : jamais diffusées une par une. Client : appuis
  groupés, `send_reactions()` toutes les **4 s** max (+ délai aléatoire
  0,5-2,5 s au 1er envoi) ; base : pile UNLOGGED `private.reaction_events`
  vidée par `flush_messages()` qui ajoute `reactions: {fire,money,heart,
  thumbs}` au payload `new_message` (même lot que les messages). Limites
  `reaction_user_limit` 8/10 s, `ip_reaction_limit` 150/10 s (0 = off pour
  `npm run reactions-test -- --load`, puis remettre 8/150).
- **Salle d'attente** : `chat_settings.live_open` (false = compte à rebours
  seul pour les spectateurs : « Karine et Richard », PAS de mention Scutify,
  ni chat ni réactions) et `live_starts_at` (02/11 19:00 UTC = 20h Paris).
  Bascule via `settings_updated`, filet = `resync()` périodique (CDN). Tout
  le monde (admins compris) voit l'attente ; admin + `/live?equipe` = vidéo ;
  réglages illisibles = attente jusqu'à l'heure (logique `liveGate()`).
  Titre de page « Karine et Richard · Le live ».
- `lib/chat/` = logique pure testée (Vitest, 65 tests).

## Fonctionnalités en production
Live responsive (portrait, paysage « priorité au live », desktop chat 26 %),
clavier mobile géré, bannière épinglée sous la vidéo + en haut du chat, bloc
HTML « Offre » (DOMPurify, bouton « Voir l'offre » sur mobile), relances
(boutons de réponse rapide, onglet Relances), réactions sans pseudo (pied de
chat, sous la vidéo si chat fermé ; admin : interrupteur + compteur 1 min),
admin complet (ouvrir/fermer, slow mode, liens, mots-clés, bloqués, mute/ban,
vider, message équipe).

## Validé
Test de charge prod en Medium : 4 000/4 000, 0 déconnexion, 100 % livrés,
p95 3,2 s. Vague relance : 300 appuis en 2 s, 300/300, p95 142 ms.
Réactions : totaux diffusés = acceptés à l'unité ; serveur ~350 appels/s à
p95 ≈ 110 ms (1 ms en base), saturation API vers 600/s (machine de test
derrière proxy : regarder `edge_logs.response.origin_time`, pas le client).

## Reste à faire (utilisateur)
Réglages Supabase « leaked passwords » + Auth connexions en pourcentage ;
capacité StreamYard 4 000 ; comptes équipe ; le soir : lancer StreamYard
PUIS « Ouvrir le live » (salle d'attente), ouvrir le chat, slow mode 10 s,
épingle + Offre, relances prêtes ; redescendre Medium après.
Coût : pic connexions déjà facturé 40 $ (tests) si même période.

## Commandes (depuis scutify-live/)
`npm run dev` · `build` · `lint` · `typecheck` · `test` · `load-test` ·
`demo-chat` · `reactions-test` · `create-admin`
