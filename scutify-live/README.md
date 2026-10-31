# Scutify Live — live StreamYard + chat modéré

Page de live pour les conférences Scutify : vidéo StreamYard + chat temps réel
modéré, dimensionné pour **~4 000 spectateurs simultanés** sur une soirée.

- **Public** : `/live` (vidéo + chat, mobile et desktop)
- **Équipe** : `/admin` (modération, réglages, épingle — utilisable sur téléphone)

Stack : Next.js 15 (App Router) · TypeScript strict · Tailwind · shadcn/ui ·
Supabase (Auth, Postgres, Realtime Broadcast, Cron) · Vercel.

> Cette app est **indépendante** de l'app Shopify située à la racine du dépôt :
> elle a ses propres dépendances et se déploie avec *Root Directory =
> `scutify-live`* sur Vercel.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Capacité : 4 000 spectateurs](#capacité--4-000-spectateurs)
4. [Mise en place Supabase](#mise-en-place-supabase)
5. [Créer le premier compte admin](#créer-le-premier-compte-admin)
6. [Variables d'environnement](#variables-denvironnement)
7. [Développement local](#développement-local)
8. [Déploiement Vercel](#déploiement-vercel)
9. [Test de charge](#test-de-charge)
10. [Checklist jour J](#checklist-jour-j)
11. [Après le live](#après-le-live)
12. [Sécurité](#sécurité)

---

## Fonctionnalités

**Page `/live`**
- Vidéo StreamYard 16:9 responsive.
- Desktop : vidéo à gauche (~70 %), chat pleine hauteur à droite.
- Mobile : vidéo collée en haut, chat sur le reste de l'écran, champ de saisie
  collé en bas et **visible quand le clavier s'ouvre** (iOS via
  `visualViewport`, Android via `interactive-widget=resizes-content`).
  Téléphone en paysage : vidéo et chat côte à côte.
- Pseudo (2–20 caractères) + email avant d'écrire ; session mémorisée (pas
  redemandée au rechargement). Le chat est lisible sans pseudo.
- 50 derniers messages au chargement, puis temps réel.
- Auto-scroll, sauf si l'utilisateur remonte le fil : le fil se met en pause
  et un bouton **« ⬇ Nouveaux messages (n) »** apparaît.
- 200 messages maximum dans le DOM.
- Messages de l'équipe : badge **Équipe** + couleur distincte.
- Message épinglé en haut du chat, avec bouton lien optionnel.
- Chat fermé par l'équipe : le chat est **masqué** et la vidéo prend tout
  l'écran (le message épinglé reste visible sous la vidéo) ; il réapparaît
  instantanément, à jour, à la réouverture. Utilisateur muté/banni : champ
  désactivé avec un texte clair.
- Slow mode : temps restant affiché avant le prochain message.
- Coupure réseau : bandeau « Reconnexion… », reconnexion automatique et
  récupération des messages manqués.

**Page `/admin`** (email + mot de passe, rôle `admin` obligatoire)
- Ouvrir / fermer le chat (instantané pour tous ; fermé = masqué chez les
  spectateurs, l'équipe continue de le voir).
- Slow mode : off, 5 s, 10 s, 30 s. Autoriser / bloquer les liens.
- Fil en direct avec, sur chaque message : supprimer, muter l'auteur (5 min,
  1 h, jusqu'à la fin du live), bannir.
- Onglet **Bloqués** : messages masqués par mot-clé, à rendre visibles ou
  supprimer.
- Onglet **Utilisateurs** : mutés / bannis, avec annulation.
- Onglet **Mots-clés** : ajout / suppression (insensible à la casse et aux
  accents, mot entier, `*` = joker : `arnaque*`).
- Envoi de messages en tant qu'Équipe (même chat fermé, sans slow mode).
- Épingle avec bouton lien (modèle « 🚀 Rejoindre la formation » prêt à
  l'emploi) et retrait : affichée en **bannière sous la vidéo** et en haut du
  chat.
- Onglet **Offre** : bloc HTML libre sous la vidéo (offre, bonus, CTA…), avec
  aperçu, publication instantanée et retrait. Sur téléphone, il s'ouvre via le
  bouton « 🎁 Voir l'offre ». Le code est nettoyé (DOMPurify : pas de scripts,
  d'iframes ni de gestionnaires d'événements ; liens ouverts dans un nouvel
  onglet).
- **Vider le chat** (attaque de spam).

**Anti-spam par connexion (IP)** : le slow mode est par compte ; pour
qu'un robot ne contourne pas les limites en multipliant les comptes, la base
limite aussi, par IP (en-tête Cloudflare `cf-connecting-ip`, non
falsifiable) : **20 messages / 10 s** et **30 nouveaux pseudos / 10 min**.
Les admins ne sont pas limités. Réglage (0 = désactivé) :

```sql
update public.chat_settings set ip_message_limit = 20, ip_profile_limit = 30 where id = 1;
```

---

## Architecture

```
 Spectateur (/live)                    Supabase (région UE)
 ──────────────────                    ─────────────────────────────────────────
 connexion anonyme  ─────────────────▶ Auth (signInAnonymously)
 pseudo + email     ── rpc set_profile ▶ profiles
 envoyer            ── rpc send_message ▶ contrôles 1→7 ─▶ messages (UNLOGGED)
                                                          │
                                       private.flush_messages()
                                       (immédiat si dernier lot > 2 s,
                                        sinon pg_cron chaque seconde)
                                                          │ realtime.send
 canal privé "live-chat" ◀──────────── Realtime Broadcast ◀┘
 état initial / resync ── GET /api/chat/snapshot (Vercel, cache CDN 2 s)
```

- **Aucune écriture directe** : les viewers n'ont aucun droit INSERT /
  UPDATE / DELETE. Tout passe par des fonctions `SECURITY DEFINER`
  (`send_message`, `set_profile`, `admin_*`). RLS activée partout.
- **`send_message(content)`** vérifie, dans l'ordre : 1. chat fermé (sauf
  admin) · 2. banni / muté · 3. anti-flood (slow mode, 2 s minimum, sauf
  admin) · 4. longueur 1–300 après nettoyage des espaces · 5. liens si
  interdits (sauf admin) · 6. mots-clés → `shadow` · 7. sinon `visible`.
  Chaque refus renvoie un message clair en français.
- **Realtime Broadcast** sur le canal **privé** `live-chat` (pas de Postgres
  Changes). Aucune policy INSERT sur `realtime.messages` : seuls les envois de
  la base sont diffusés, un client ne peut pas usurper un message.
- Événements : `new_message` (`{ messages: [...] }`, par lots),
  `message_deleted` (`{ ids }` ou `{ all: true }`), `settings_updated`,
  `user_muted`. Les messages `shadow` ne sont **jamais diffusés** : l'auteur
  les ajoute localement à son fil (et les retrouve après rechargement).
- **Stockage éphémère** : `messages` est une table `UNLOGGED` (pas de WAL, pas
  de sauvegarde), purgée automatiquement après 12 h ; « Vider le chat » efface
  définitivement.

> Écart volontaire par rapport au cahier des charges initial : les messages
> de l'équipe ne passent pas par le filtre de mots-clés (un message d'équipe
> masqué sans qu'on le sache serait pire qu'utile).

---

## Capacité : 4 000 spectateurs

### Le point clé : chaque diffusion compte une fois **par spectateur**

Le quota Realtime « messages par seconde » compte chaque message **livré à
chaque client**. Une diffusion par message de chat donnerait :

| | Sans lots | **Avec lots (implémenté)** |
|---|---|---|
| 5 msg/s × 4 000 spectateurs | **20 000 événements/s** ❌ | **≤ 2 000 événements/s** ✅ |
| Dépend du débit du chat ? | oui | **non** (≤ 1 diffusion / 2 s) |
| Messages Realtime sur 3 h | ≈ 216 M | ≈ 21,6 M (au maximum) |

Les messages sont donc **regroupés** : au plus une diffusion toutes les
`broadcast_interval_seconds` (2 s par défaut), contenant tous les messages
arrivés depuis la précédente. Si le chat est calme, le message part
immédiatement ; sinon il attend au plus ~2 s, ce qui est imperceptible à côté
du délai de la vidéo. L'auteur voit son propre message instantanément.

Formule : **événements/s ≈ spectateurs connectés ÷ intervalle**.
Le projet de production est réglé à **3 s** : 4 000 spectateurs ≈ 1 330
événements/s, soit ~45 % de marge sous le plafond de 2 500/s (pics
d'audience, reconnexions). Pour revenir à 2 s (chat un peu plus vif) :

```sql
update public.chat_settings set broadcast_interval_seconds = 2 where id = 1;
```

### Plan Supabase nécessaire

Limites Realtime par plan ([doc](https://supabase.com/docs/guides/realtime/limits)) :

| | Free | Pro | **Pro sans spend cap** |
|---|---|---|---|
| Connexions simultanées | 200 | 500 | **10 000** |
| Messages par seconde | 100 | 500 | **2 500** |
| Joins de canal par seconde | 100 | 500 | **2 500** |

➡ **Plan Pro avec le spend cap désactivé** (Organization > Billing > Cost
Control). Le spend cap activé plafonne à 500 connexions : le live casserait
au 501e spectateur.

### Coût estimé de la soirée (au-delà de l'abonnement Pro)

Tarifs Realtime Pro ([doc](https://supabase.com/docs/guides/realtime/pricing)) :
500 connexions de pointe et 5 M de messages inclus, puis 10 $ / 1 000
connexions de pointe et 2,50 $ / million de messages.

- Connexions : 4 000 de pointe → (4 000 − 500) / 1 000 × 10 $ ≈ **35 $**
- Messages : ≤ 2 000/s × 3 h ≈ 21,6 M → (21,6 − 5) × 2,50 $ ≈ **42 $** au maximum
- + compute renforcé pour la soirée (voir ci-dessous), facturé à l'heure.

Ordre de grandeur : **~80 à 100 $** pour la soirée (sans lots, la partie
messages seule dépasserait 500 $, et le quota de 2 500/s serait dépassé).

### Ce qui a été validé

**Sur le projet de production** (`scutify-live`, Paris, Pro sans spend cap),
le 31/10, depuis une seule machine de test située aux États-Unis :

```
Spectateurs abonnés      4000/4000 (1 coupure isolée, reconnectée)
Messages envoyés         296 en 60 s (≈ 5 msg/s), 0 erreur
Livraisons               1 183 990 / 1 184 000 (99,999 %)
Latence de livraison     p50 1,3 s · p95 2,2 s · max 2,8 s (transatlantique inclus)
send_message côté serveur  p50 3 ms · p95 165 ms
Diffusions               ≈ 0,5/s (≈ 10 messages par lot) → ≈ 1 850 événements/s
```

Le même test avec les quotas du plan Free (stack locale) échoue bien
(plafond de 200 connexions, `MessagePerSecondRateLimitReached`) : c'est
pourquoi le plan Pro sans spend cap est indispensable.

> ⚠️ Modifier les réglages **Realtime** dans le tableau de bord **déconnecte
> tous les clients** (ils se reconnectent seuls). Ne pas y toucher pendant le
> live.

### Autres points de charge déjà traités

- **Reconnexions en masse** : l'état initial et la resynchronisation passent
  par `/api/chat/snapshot`, mis en cache 2 s sur le CDN Vercel ; les
  resynchronisations sont étalées aléatoirement sur 4 s. 4 000 clients qui se
  reconnectent = ~1 requête Supabase toutes les 2 s, pas 8 000.
- **Rendu** : messages reçus regroupés (≈ 80 ms) et ≤ 200 éléments dans le DOM.
- **Anti-flood fiable** sous concurrence (verrou par utilisateur en base).

---

## Mise en place Supabase

1. **Créer le projet** en région **UE (Paris, eu-west-3)** — RGPD et latence
   pour un public français. Plan **Pro**, **spend cap désactivé**.
2. **Exécuter la migration** `supabase/migrations/20261031120000_live_chat.sql` :
   - soit dans **SQL Editor** (copier-coller le fichier, *Run*) ;
   - soit avec la CLI : `npx supabase link --project-ref <ref>` puis
     `npx supabase db push`.

   Elle crée les tables, RLS, fonctions, policies Realtime, et active
   **pg_cron** avec deux tâches (`scutify-live-flush` chaque seconde,
   `scutify-live-purge` toutes les 10 min) — visibles dans *Integrations > Cron*.
3. **Authentication > Sign In / Providers** : activer **Allow anonymous
   sign-ins** (les spectateurs sont connectés en anonyme pour recevoir le
   canal privé).
4. **Authentication > Rate Limits** : relever **les connexions anonymes par
   heure et par IP** (défaut 30) à **500** ou plus. Beaucoup de spectateurs
   partagent la même IP (4G/5G en CGNAT, Wi-Fi d'entreprise).
5. **Realtime > Settings** : désactiver **Allow public access** (canaux
   privés uniquement).
6. **Project Settings > Compute and Disk** : passer au moins en **Small**,
   idéalement **Medium**, quelques heures avant le live (le changement
   redémarre la base ~2 min), puis redescendre après.

---

## Créer le premier compte admin

**Option A — script (recommandé)**, depuis `scutify-live/`, avec
`NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` :

```bash
npm run create-admin -- toi@scutify.fr 'UnMotDePasseSolide' 'Équipe Scutify'
```

Crée le compte (email confirmé) et le profil `role = 'admin'`. Relancer la
commande sur un compte existant met à jour son mot de passe.

**Option B — tableau de bord** :
1. *Authentication > Users > Add user > Create new user* : email + mot de
   passe, cocher **Auto Confirm User**.
2. *SQL Editor* :
   ```sql
   select private.promote_to_admin('toi@scutify.fr', 'Équipe Scutify');
   ```

Se connecter ensuite sur **`/admin`**. Le pseudo de l'admin apparaît avec le
badge **Équipe** dans le chat.

### Ajouter des membres de l'équipe

Même procédure pour chaque personne : créer son compte (*Authentication >
Users > Add user*, email + mot de passe, **Auto Confirm User**), puis :

```sql
select private.promote_to_admin('prenom@scutify.fr', 'Prénom Scutify');
```

Retirer les droits : `update public.profiles set role = 'viewer' where email = 'prenom@scutify.fr';`

---

## Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | URL du projet (*Project Settings > API*) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local | Clé publique : `anon` (legacy) ou `sb_publishable_…` |
| `NEXT_PUBLIC_STREAM_EMBED_URL` | optionnel | URL d'intégration StreamYard (défaut : `https://streamyard.com/watch/bjJkQR6HBCpX?embed=true`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **local uniquement** | Pour `npm run create-admin`. Contourne RLS : jamais sur Vercel, jamais en `NEXT_PUBLIC_` |

Les valeurs publiques de production (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) sont déjà dans **`.env.production`** : aucune
variable à saisir sur Vercel. Une variable définie sur Vercel les remplace.
Les variables `NEXT_PUBLIC_*` sont figées **au build** : après modification,
redéployer. Une variable requise manquante fait échouer le build
avec un message explicite.

---

## Développement local

```bash
cd scutify-live
```

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Puis ouvrir http://localhost:3000/live et http://localhost:3000/admin.

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | dev / build / prod |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (reducer du fil, liens, validation, erreurs) |
| `npm run create-admin` | créer / promouvoir un admin |
| `npm run load-test` | test de charge (4 000 spectateurs par défaut) |
| `npm run demo-chat` | démo « public en direct » : 200 messages réalistes (🔥, bonjours, questions, trolls) pour voir le rendu |

---

## Déploiement Vercel

1. *Add New > Project* → importer le dépôt GitHub.
2. **Root Directory : `scutify-live`** (Framework : Next.js, détecté).
3. *Environment Variables* : rien à saisir (valeurs publiques dans
   `.env.production`).
4. *Deploy*, puis ajouter le domaine (ex. `live.scutify.fr`) dans *Settings >
   Domains*.

`/` redirige vers `/live`. `/admin` n'est pas indexé et ne peut pas être
intégré dans une iframe.

---

## Test de charge

À lancer sur le **vrai projet** (ou un projet de test configuré à
l'identique), **avant d'ouvrir le chat au public** :

```bash
cd scutify-live
```

```bash
ulimit -n 10000
```

```bash
npm run load-test
```

Par défaut : **4 000 spectateurs**, **5 msg/s**, **60 s**. Options :

```bash
npm run load-test -- --clients 4000 --rate 5 --duration 120 --ramp 100
```

- Chaque spectateur simulé ouvre sa propre connexion WebSocket sur le canal
  privé ; une douzaine de comptes émetteurs envoient via la vraie fonction
  `send_message` (le nombre s'adapte au slow mode).
- Le rapport donne : connexions, déconnexions, erreurs, taux de livraison,
  latence p50/p95/p99, nombre de lots, événements/s estimés, puis un verdict
  **SUCCÈS / ÉCHEC** avec des pistes.
- L'**anti-spam par IP** doit être coupé le temps du test (toutes les
  connexions viennent d'une seule machine) : le script l'indique et donne la
  commande, à remettre ensuite (`20` / `30`).
- Le chat doit être **ouvert**. Les messages de test sont préfixés
  « 🧪 Test de charge » : cliquez **Vider le chat** dans `/admin` après.
- Les sessions anonymes des émetteurs sont réutilisées entre deux essais
  (`.loadtest-cache.json`, ignoré par git) pour ménager la limite de
  connexions anonymes.
- 4 000 connexions depuis un seul ordinateur : `ulimit -n 10000` est
  indispensable (macOS limite à 256 par défaut) ; une bonne connexion est
  conseillée. Le test lui-même consomme du quota Realtime (≈ 2 000
  événements/s pendant sa durée).

**Lire un échec** : `jamais connectés` > 0 → quota de connexions ;
livraisons < 99,5 % ou déconnexions → quota de messages/s (logs Realtime :
`MessagePerSecondRateLimitReached`, `tenant_events`). Vérifier le plan, le
spend cap, ou augmenter `broadcast_interval_seconds`.

---

## Checklist jour J

- [ ] Plan **Pro**, **spend cap désactivé**, compute **Medium** (quelques
      heures avant : le changement redémarre la base ~2 min).
- [ ] Connexions anonymes **activées** et limite par IP **relevée**.
- [ ] Realtime : **accès public désactivé** ; ne plus toucher aux réglages
      Realtime pendant le live (chaque sauvegarde déconnecte tout le monde).
- [ ] Vérifier que l'offre **StreamYard** accepte le nombre de spectateurs
      prévu sur la page d'intégration.
- [ ] Lien à partager : domaine propre (ex. `live.scutify.fr`) configuré
      dans Vercel.
- [ ] `npm run load-test` → **SUCCÈS**, puis **Vider le chat**.
- [ ] Mots-clés bloqués saisis, épingle prête, bloc **Offre** publié, slow
      mode choisi (**10 s** conseillé avec des milliers de spectateurs).
- [ ] Au moins deux admins connectés sur `/admin` (un sur téléphone).

---

## Après le live

- Les messages s'effacent seuls après 12 h (ou **Vider le chat**).
- Exporter les contacts (SQL Editor → *Download CSV*) :
  ```sql
  select pseudo, email, created_at from public.profiles
  where role = 'viewer' order by created_at;
  ```
- Les **profils** (pseudo + email) sont conservés : ce sont les contacts
  collectés. Pour les supprimer (RGPD) :
  ```sql
  -- supprime les comptes anonymes des spectateurs (et leurs profils) ;
  -- les comptes de l'équipe (email + mot de passe) ne sont pas concernés
  delete from auth.users where is_anonymous;
  ```
- Redescendre le compute et réactiver le spend cap si souhaité.

---

## Sécurité

- RLS sur toutes les tables ; viewers : lecture des messages visibles, de
  leurs propres messages masqués et de leur profil, rien d'autre.
- Aucune écriture directe : uniquement via fonctions `SECURITY DEFINER`
  (`search_path` vide, rôle vérifié en base pour chaque action admin).
- Rôle `admin` attribué uniquement via SQL ou le script (service key) : un
  utilisateur ne peut pas se promouvoir.
- Canal Realtime privé, sans policy d'écriture : impossible d'injecter de faux
  messages.
- Liens épinglés et liens cliquables limités à `http(s)://` (jamais
  `javascript:`).
- L'email n'est jamais diffusé ni visible des autres spectateurs.
- La `SUPABASE_SERVICE_ROLE_KEY` n'est utilisée que par le script local.

## Structure

```
scutify-live/
  app/
    live/            page publique
    admin/           administration
    api/chat/snapshot/  état public mis en cache (CDN)
  components/
    live/            vidéo, chat, fil, saisie, pseudo, épingle
    admin/           contrôles, fil modérable, onglets
    ui/              primitives shadcn/ui
  hooks/             use-live-chat (Realtime, reconnexion), viewport mobile…
  lib/chat/          logique pure testée (reducer du fil, liens, validation)
  lib/supabase/      client navigateur + types
  scripts/           create-admin, load-test
  supabase/migrations/  schéma, RLS, fonctions, cron
```
