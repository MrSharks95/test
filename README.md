# EU Withdrawal

App Shopify publique embedded : **bouton de rétractation** pour la conformité à
la **directive UE 2023/2673**. Le client exerce son droit de rétractation sans
compte via un formulaire servi par l'App Proxy ; le marchand gère les demandes
dans l'admin embarqué.

## Stack
Next.js 14 (App Router) · TypeScript strict · Tailwind · shadcn/ui · Supabase
(EU/Frankfurt) · Resend · Shopify (App Bridge + Admin API GraphQL + App Proxy) ·
Vercel.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés (cf. .env.example)
npm run dev
```

> La validation d'environnement échoue **au boot** avec un message clair si une
> clé requise manque (voir `lib/env.ts`).

## Scripts
| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev |
| `npm run build` / `start` | build / serveur de prod |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (logique métier) |

## Base de données
Migration initiale : `supabase/migrations/001_init.sql` (tables, RLS par
`shop_id`, seed `withdrawal_rules`). À appliquer sur un projet Supabase **région
EU**.

## Conventions & règles
Voir [`CLAUDE.md`](./CLAUDE.md) et `.claude/rules/` (signature App Proxy
obligatoire, service key Supabase jamais exposée).

## Roadmap (pack de build)
1. ✅ Scaffold + fondations — **Prompt 1**
2. OAuth install + persistance shop + webhooks RGPD — Prompt 2
3. App Proxy + formulaire de rétractation 3 vues — Prompt 3
4. Moteur de délai pays × catégorie — Prompt 4
5. Email accusé de réception (Resend) — Prompt 5
6. Theme app extension (bouton visible) — Prompt 6
