# Règle — Supabase : ne jamais exposer la service key, isoler par shop_id

## Deux clients, deux usages
- **`lib/supabase/server.ts`** → clé `service_role`. **Bypass RLS.** Serveur
  **uniquement** (le fichier importe `server-only`, donc un import côté client
  casse le build — c'est voulu).
- **`lib/supabase/client.ts`** → clé `anon`. Soumise à RLS. Utilisable dans le
  navigateur.

## Règles
1. **NEVER** importer `server.ts` ou la `SUPABASE_SERVICE_ROLE_KEY` dans du code
   qui peut s'exécuter côté client. La service key bypass toutes les policies.
2. **NEVER** mettre une clé Supabase secrète dans une variable `NEXT_PUBLIC_*`.
   Seuls `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont
   publics.
3. La service key bypassant RLS, **l'isolation par `shop_id` est à la charge du
   code applicatif** : toute requête sur `withdrawals`, `withdrawal_events`,
   `withdrawal_notes`, `shops` DOIT filtrer/scoper par `shop_id`.
4. RLS reste activé sur toutes les tables. Par défaut **tout est refusé** pour
   les clés `anon`/`authenticated`, sauf `withdrawal_rules` (lecture seule
   publique — référentiel non sensible).

## Données & région
- Projet Supabase en **région UE (Paris / eu-west-3)** — exigence RGPD.
- Les requêtes RGPD (`customers/redact`, `shop/redact`) doivent réellement
  purger/anonymiser les données concernées (voir Prompt 2).

## Réflexe de revue
Avant de merger du code touchant Supabase : « Est-ce que ce module peut finir
dans un bundle client ? Si oui, il ne doit JAMAIS voir la service key. »
