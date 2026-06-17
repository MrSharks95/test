# SETUP — Mise en route (Phase 0 → premier run)

Guide pas-à-pas pour passer du code à une app installable. Tout le code est
prêt ; il ne manque que les comptes externes et les clés d'environnement.

## 1. Shopify Partner
1. Crée un compte sur [Shopify Partners](https://partners.shopify.com) (gratuit).
2. **Apps → Create app → Create app manually** (type *public*).
3. Note `Client ID` (= `SHOPIFY_API_KEY`) et `Client secret` (= `SHOPIFY_API_SECRET`).
4. **App setup → URLs** :
   - App URL : `https://<ton-domaine-vercel>`
   - Allowed redirection URL : `https://<ton-domaine-vercel>/api/auth/callback`
5. **App setup → App proxy** :
   - Subpath prefix : `apps` · Subpath : `retractation`
   - Proxy URL : `https://<ton-domaine-vercel>/api/proxy`
6. **App setup → Compliance webhooks** (RGPD) → les 3 URLs sur
   `https://<ton-domaine-vercel>/api/webhooks`.
7. **Scopes** : `read_orders,write_orders,read_customers`.
   ⚠️ Commandes > 60 jours → vérifier si `read_all_orders` est nécessaire
   (approbation Shopify séparée).
8. Crée un **development store** pour tester.

> Astuce : `shopify.app.toml` à la racine reflète déjà ces réglages pour
> `npx shopify app deploy`.

## 2. Supabase (région UE)
1. Projet **région UE** (Paris `eu-west-3` ou Francfort `eu-central-1`).
2. Applique les migrations dans l'ordre (SQL Editor ou CLI) :
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_email_template.sql`
3. **Project Settings → API** → note :
   - `Project URL` → `SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY` (**jamais** côté client)

## 3. Resend
1. Compte sur [Resend](https://resend.com), **vérifie un domaine** d'envoi.
2. Note la clé API → `RESEND_API_KEY`.
3. `RESEND_FROM` = `"EU Withdrawal <noreply@ton-domaine>"`.

## 4. Clé de chiffrement
```bash
openssl rand -base64 32   # → APP_ENCRYPTION_KEY
```

## 5. .env.local
```bash
cp .env.example .env.local   # puis renseigner toutes les clés
npm install
npm run dev
```
La validation d'env (`lib/env.ts`) plante au boot avec un message clair si une
clé manque.

## 6. Déploiement Vercel
1. Importe le repo sur Vercel.
2. Reporte **toutes** les variables d'env (cf. `.env.example`).
3. Mets à jour `SHOPIFY_APP_URL` avec l'URL Vercel finale, puis re-déploie.
4. Reporte la même URL dans les réglages Shopify (étape 1).

## 7. Theme app extension (le bouton)
```bash
npx shopify app deploy   # publie l'extension du dossier extensions/
```
Dev store → **Boutique en ligne → Thèmes → Personnaliser → Ajouter un bloc →
EU Withdrawal Button**.

## 8. Phase TEST (dev store)
- [ ] Parcours commande vérifiée → email reçu
- [ ] Parcours commande introuvable → saisie manuelle → OK
- [ ] Cas exonéré (produit custom/perishable) → statut `exempt`
- [ ] Cas hors délai → statut `late`
- [ ] Webhooks RGPD : 200 si HMAC valide, 401 sinon
- [ ] Désinstall / réinstall propre (pas de doublon)
- [ ] Bouton visible dans le thème + ouvre le formulaire

## Variables d'environnement (récap)
| Variable | Source |
|---|---|
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Partner Dashboard |
| `SHOPIFY_SCOPES` | `read_orders,write_orders,read_customers` |
| `SHOPIFY_APP_URL` | URL Vercel |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase (API) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (API) |
| `RESEND_API_KEY` / `RESEND_FROM` | Resend |
| `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` |
