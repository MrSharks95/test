# CLAUDE.md — EU Withdrawal App

## Identité
App Shopify **publique embedded** : "Bouton de rétractation" pour la conformité
à la **directive UE 2023/2673**. Un client peut exercer son droit de
rétractation **sans compte** via un formulaire servi par l'App Proxy. Le
marchand gère les demandes dans l'admin embarqué.

**Langue** : communication **FR**, code et identifiants **EN**.

## Stack
- **Next.js 14** (App Router) · **TypeScript strict** · **Tailwind** · **shadcn/ui**
- **Supabase** (région **UE — Paris / eu-west-3**, RGPD) — 2 clients :
  `service_role` (serveur) et `anon` (public)
- **Resend** (email accusé de réception, support durable)
- **Shopify** : App Bridge (admin) + Admin API GraphQL + App Proxy (public)
- Hébergement **Vercel**

## Commandes
- `npm run dev` — serveur de dev (échoue vite si une clé d'env manque)
- `npm run build` — build de prod
- `npm run start` — serveur de prod
- `npm run lint` — ESLint (next/core-web-vitals + next/typescript)
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — Vitest (logique métier, ex. computeDeadline)

## Arborescence
```
app/
  (admin)/         # interface marchand embarquée (App Bridge)
  api/proxy/       # App Proxy public — signature OBLIGATOIRE
  api/health/      # liveness
lib/
  env.ts           # env serveur validé (zod) + 'server-only'
  env.client.ts    # env public (NEXT_PUBLIC_*)
  shopify/         # OAuth, webhooks, Admin API GraphQL
  supabase/        # server.ts (service_role) · client.ts (anon)
  email/           # Resend + templates
  withdrawal/      # logique métier (deadline, types) — pur TS testable
components/ui/      # primitives shadcn
supabase/migrations/  # 001_init.sql
.claude/rules/      # règles critiques référencées ci-dessous
```

## Conventions
- **TypeScript strict** partout (`noUncheckedIndexedAccess` activé). Pas de `any`.
- Imports via l'alias `@/*`.
- Validation d'env **au boot** avec zod : une clé manquante = crash explicite.
- Modules serveur sensibles importent `server-only`.
- Logique métier (`lib/withdrawal/`) = **pur TS**, aucune dépendance UI, testée.
- i18n FR/EN : textes externalisés, jamais en dur dans les composants.
- Isolation **par `shop_id`** sur toute lecture/écriture de données marchand.
- Référence rétractation : `WR-` + 6 alphanum, unique par shop.

## Règles critiques (NEVER)
- **NEVER** committer un secret. `.env.local` est gitignored ; secrets côté serveur.
- **NEVER** exposer la `SUPABASE_SERVICE_ROLE_KEY` au client (elle bypass RLS).
  → voir `.claude/rules/supabase-rls.md`
- **NEVER** traiter une requête App Proxy sans vérifier sa signature Shopify.
  → voir `.claude/rules/shopify-app-proxy.md`
- **NEVER** vérifier un webhook ou un callback OAuth sans contrôle HMAC.
- **Données dans l'UE uniquement** (Supabase Paris / eu-west-3) — RGPD.
- Stocker l'`access_token` Shopify **chiffré** (`APP_ENCRYPTION_KEY`).

## Compacting
Quand le contexte est résumé, **préserver** : (1) la décision d'archi (app Next
unique, 2 clients Supabase, npm), (2) l'avancement par prompt (1→6 du pack),
(3) les règles critiques NEVER ci-dessus, (4) le schéma de la migration 001 et
les noms de tables (`shops`, `withdrawals`, `withdrawal_rules`,
`withdrawal_events`, `withdrawal_notes`). Relire `.claude/rules/` après tout
résumé avant de toucher au proxy, aux webhooks ou à Supabase.
