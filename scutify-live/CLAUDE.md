# CLAUDE.md — Scutify Live

App **indépendante** de l'app Shopify de la racine (le CLAUDE.md racine ne
s'applique pas ici, sauf l'esprit des règles de sécurité Supabase).

Page de live StreamYard + chat modéré pour ~4 000 spectateurs, une soirée.
Interface **en français**, code en anglais. Voir README.md.

## Commandes (depuis scutify-live/)
`npm run dev` · `build` · `lint` · `typecheck` · `test` · `load-test` · `create-admin`

## Décisions à préserver
- Toute écriture passe par des fonctions SQL `SECURITY DEFINER` ; aucune policy
  INSERT/UPDATE/DELETE pour les viewers ; RLS partout.
- Realtime **Broadcast** sur canal **privé** `live-chat`, alimenté par la base
  (`realtime.send`). Jamais de Postgres Changes. Aucune policy INSERT sur
  `realtime.messages`.
- Messages diffusés **par lots** (`private.flush_messages`, ≤ 1 / 2 s) : chaque
  diffusion compte une fois par spectateur dans le quota Realtime. Ne pas
  revenir à une diffusion par message.
- `messages` est UNLOGGED et purgé (stockage éphémère).
- Les messages `shadow` ne sont jamais diffusés.
- `SUPABASE_SERVICE_ROLE_KEY` : scripts locaux uniquement, jamais NEXT_PUBLIC_.
- `lib/chat/` = logique pure testée (Vitest).
