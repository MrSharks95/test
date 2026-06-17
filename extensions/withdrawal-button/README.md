# EU Withdrawal Button — Theme app extension

App block "Bouton de rétractation" que le marchand place dans son thème via
l'éditeur (Personnaliser → Ajouter un bloc → Applications), sans toucher au code.

## Contenu
- `blocks/withdrawal_button.liquid` — l'app block : un lien stylé vers le
  formulaire public servi par l'App Proxy (`/apps/retractation`). **Aucune
  logique serveur.**
- `locales/` — libellés des réglages (FR / EN).
- `shopify.extension.toml` — déclaration de l'extension (type `theme`).

## Réglages dans l'éditeur de thème
- **Libellé** du bouton
- **Couleur de fond** / **couleur du texte**
- **Alignement** (gauche / centré / droite)

## Déploiement
Depuis la racine du projet (nécessite l'app Partner configurée — Phase 0) :

```bash
npx shopify app dev      # prévisualiser sur le dev store
npx shopify app deploy   # publier l'extension
```

Puis dans l'admin du dev store : **Boutique en ligne → Thèmes → Personnaliser**,
choisir une section, **Ajouter un bloc → EU Withdrawal Button**.
