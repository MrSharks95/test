# Règle — Shopify App Proxy : vérification de signature OBLIGATOIRE

## Pourquoi
L'App Proxy sert le formulaire de rétractation **publiquement, sans login**
(exigence légale). N'importe qui peut donc appeler `/api/proxy`. La **seule**
garantie que la requête provient bien de Shopify (et concerne le bon shop) est
la **signature** que Shopify ajoute. Sans elle, l'endpoint est ouvert à
l'usurpation de shop et à l'injection de données.

## Règle
**Toute** requête vers une route App Proxy DOIT être rejetée (HTTP 401) avant
tout traitement si sa signature est invalide ou absente. Aucune exception, y
compris en dev.

## Comment vérifier (signature App Proxy)
- Shopify ajoute un paramètre de query `signature`.
- Prendre **tous les autres** paramètres de query, triés par clé, concaténés
  sous la forme `clé=valeur` **sans séparateur** (format spécifique au proxy,
  différent des webhooks).
- Calculer un **HMAC-SHA256** avec `SHOPIFY_API_SECRET` comme clé.
- Comparer en **temps constant** (`crypto.timingSafeEqual`) au `signature` reçu.
- Si différent → `401`. Ne jamais logguer le secret ni la signature attendue.

## Distinction importante
- **App Proxy** : paramètre `signature`, concaténation `clé=valeur` sans `&`.
- **Webhooks / OAuth callback** : en-tête/`hmac`, HMAC sur le **corps brut** ou
  la query, encodé en base64. Ne pas confondre les deux mécanismes.

## À NE JAMAIS faire
- ❌ Traiter le body / lire des données avant la vérification.
- ❌ Comparer les signatures avec `===` (timing attack).
- ❌ Désactiver la vérif « juste pour debugger ».
