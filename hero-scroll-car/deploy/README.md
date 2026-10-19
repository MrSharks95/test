# Fichiers de configuration envoyés sur le thème de test

Versions « nouveautés » des gabarits et des réglages (envoyées par l'API depuis ce dépôt).
Les versions d'origine sont dans `../backup/`.

- `templates-index.json` : accueil avec le bloc « Effets visuels », le bouton « tout le kit », les sections « Avant / après » et « Avis clients ».
- `templates-404.json` : page 404 en verre.
- `settings_data.dark.json` : schémas de couleurs sombres (orange sur noir) pour les pages intérieures.

## Sans page produit

- `templates-product.json` : gabarit produit réduit à la section `hero-no-product-page`, qui renvoie toute adresse
  `/products/…` vers l'accueil avec `#fiche=<handle>` ; le hero ouvre alors la fiche « En savoir plus » du produit
  (s'il fait partie du hero). Dans l'éditeur de thème, pas de redirection : un encart explicatif.
- Les liens produit du panier (articles, « Complétez le kit ») et des avis clients pointent vers `/#fiche=<handle>`
  tant que la case « Pas de page produit » de chaque section est cochée (par défaut).
