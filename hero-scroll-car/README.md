# Hero voiture + scroll — section Shopify

Section Shopify autonome : vidéo d'allumage, puis plan-séquence piloté au scroll (ordinateur et mobile),
avec 4 arrêts produit (carrosserie, portière, habitacle, jante) et ajout au panier en AJAX.

Il n'y a **rien à compiler** : pas de npm, pas de build. La section est faite de fichiers que Shopify
sert tels quels.

```
hero-scroll-car/
├── sections/hero-scroll-car.liquid   la section (réglages, blocs, presets, mode d'emploi en commentaire)
├── assets/                           à copier dans /assets du thème
│   ├── hero-scroll-car.js / .css     le code de la section
│   ├── f_0001.webp … f_0248.webp     le plan-séquence (1920 × 1080, 23 Mo)
│   ├── plan-sequence(-reverse).mp4    mode chapitres : le plan-séquence en vidéo, avant et inversé
│   ├── hero-ignition.mp4 / .mp3      vidéo d'allumage avec son (le .mp3 séparé est optionnel)
│   ├── hero-poster.jpg               dernière image de la vidéo
│   ├── hero-start.jpg                première image (affichée sous le bouton « Démarrer le moteur »)
│   └── stop-*.jpg                    images fixes de la version empilée (dont le présentoir)
├── preview/                          aperçu local hors Shopify (produits et panier simulés)
└── tools/                            réextraction des images (ex. passage en 1080p)
```

## 1. Récupérer les fichiers

- **Sans Git** : sur GitHub, dépôt `MrSharks95/test`, choisir la branche
  `claude/moonshine-shopify-analysis-jvje4k`, puis **Code › Download ZIP**. Seul le dossier
  `hero-scroll-car` sert.
- **Avec Git** :

  ```bash
  git clone -b claude/moonshine-shopify-analysis-jvje4k https://github.com/MrSharks95/test.git
  ```

## 2. Aperçu local (sans Shopify)

Il faut un petit serveur local, Python ou Node suffit :

```bash
cd hero-scroll-car
python3 -m http.server 8000        # ou : npx serve .
```

Puis ouvrir <http://localhost:8000/preview/>. La page charge exactement `assets/hero-scroll-car.js`,
le CSS et les images de la section : une modification + un rechargement suffisent. Pour tester le mobile,
utiliser le mode appareil des outils de développement du navigateur (ou le téléphone sur le même Wi-Fi :
`python3 -m http.server 8000 --bind 0.0.0.0`, puis l'adresse IP de l'ordinateur).

## 3. Installer sur Shopify

Toujours travailler sur une **copie** du thème, jamais directement sur le thème en ligne.

### Option A — Shopify CLI (recommandée)

Prérequis : [Node.js](https://nodejs.org) 22.12 ou plus et Git. Sur Mac, `brew install shopify-cli`
installe tout.

```bash
npm install -g @shopify/cli@latest

mkdir mon-theme && cd mon-theme
shopify theme pull --live --store ta-boutique.myshopify.com   # télécharge le thème en ligne
```

Copier les fichiers de la section dans le thème :

```bash
# Mac / Linux
cp ../hero-scroll-car/sections/hero-scroll-car.liquid sections/
cp ../hero-scroll-car/assets/* assets/
```

```powershell
# Windows (PowerShell)
Copy-Item ..\hero-scroll-car\sections\hero-scroll-car.liquid sections\
Copy-Item ..\hero-scroll-car\assets\* assets\
```

Puis :

```bash
shopify theme check                  # contrôle officiel du code (la section passe sans erreur)
shopify theme dev                    # aperçu sur http://127.0.0.1:9292 avec les vrais produits
shopify theme push --unpublished     # envoie le tout comme NOUVEAU thème non publié
```

Le thème en ligne n'est pas modifié : la copie apparaît dans **Boutique en ligne › Thèmes**.

### Option B — Sans outil, par fichier ZIP

1. **Boutique en ligne › Thèmes**, menu **⋯** du thème actuel › **Télécharger le fichier du thème**
   (lien reçu par e-mail).
2. Décompresser, puis copier `sections/hero-scroll-car.liquid` dans `sections/` et le contenu de
   `assets/` dans `assets/`.
3. Recompresser **le contenu** du thème : les dossiers `assets`, `config`, `layout`, `sections`… doivent
   être à la racine du ZIP, pas dans un sous-dossier. Sur Mac, sélectionner ces dossiers puis
   « Compresser » (et non compresser le dossier parent).
4. **Thèmes › Ajouter un thème › Charger un fichier zip** (50 Mo maximum).

L'éditeur de code de l'admin (« Modifier le code ») convient pour des retouches ultérieures du `.liquid`,
du `.js` ou du `.css`, pas pour charger 248 images une par une.

## 4. Configurer dans l'éditeur de thème

1. Sur la copie du thème : **Personnaliser** › page d'accueil › **Ajouter une section** ›
   « Hero voiture + scroll ». Elle arrive avec ses 4 arrêts déjà réglés (images 27, 82, 134, 213).
2. **Vidéo d'allumage (Fichiers Shopify)** : charger `hero-ignition.mp4` ici (recommandé, Shopify
   l'héberge et l'optimise). Sinon, le fichier copié dans `/assets` est utilisé.
3. Dans chaque bloc « Arrêt caméra », choisir le **produit**. Sélectionner un bloc fait défiler l'aperçu
   jusqu'à son image : pratique pour vérifier la carte ou le point d'intérêt.
4. Vérifier le rendu mobile avec l'icône téléphone de l'éditeur. Le réglage par bloc « Cadrage mobile »
   ajuste ce qui reste visible sur un écran vertical.
5. Enregistrer, puis **Thèmes › ⋯ › Publier** quand tout est validé.

## 5. Avant de publier

- Ordinateur : la vidéo se fige sur la voiture, le scroll enchaîne sans saut, les 4 arrêts s'affichent.
- Mobile : même parcours, fiches en volet en bas, aucun défilement horizontal.
- Ajout au panier : le bouton confirme et le compteur du panier se met à jour. Sur un thème non dérivé de
  Dawn, le compteur peut n'apparaître qu'au rechargement : il suffit alors d'adapter le sélecteur du compteur
  dans `refreshCart()`.
- Bouton « Démarrer le moteur » (réglage **Démarrage de la bannière**, par défaut) : au centre de la bannière,
  un clic lance l'allumage **avec le son**, puis le plan-séquence garde le son en avançant. Les navigateurs
  bloquent tout son sans clic : ce bouton est la seule façon d'avoir le son à coup sûr. Si le visiteur fait
  défiler sans cliquer, la vidéo démarre sans le son et son premier clic n'importe où l'active.
- Bouton son (en bas) : il coupe ou remet le son à tout moment.

## 6. Mode chapitres (lecture vidéo)

Réglage de la section **Mode de défilement › Chapitres** (par défaut). Au lieu de faire défiler des images, chaque cran de
molette, swipe, flèche du clavier ou clic sur la navigation lit la **vraie vidéo** jusqu'au plan suivant, avec
la fluidité d'une vidéo. En remontant, une copie inversée de la vidéo est lue, donc la marche arrière est aussi
fluide. Après le plan final, la page défile normalement.

- Fichiers : `assets/plan-sequence.mp4` (avant, avec le son) et `assets/plan-sequence-reverse.mp4` (inversée),
  1080p, 48,5 s, une image clé par seconde, moins de 20 Mo chacun (limite d'un fichier de thème).
- Chaque bloc « Arrêt caméra » a un **temps de l'arrêt** en secondes : 10 / 19.8 / 25.27 / 34.8, et
  « Fin du plan final » vaut 48.4 : la voiture a reculé jusqu'au présentoir.
- Bloc **« Présentoir (fin) »** : choisir jusqu'à 6 produits ; ils s'affichent ensemble sur le dernier plan,
  cartes posées sur le comptoir. « Hauteur du comptoir » (71 % par défaut) règle la ligne où elles se posent ;
  sur mobile, les cartes forment une bande à faire glisser en bas de l'écran. Image fixe de la version sans
  animation : `assets/stop-presentoir.jpg`.
- **Le plan reste vivant** : à l'arrivée sur le présentoir, les dernières secondes de la vidéo sont rejouées en
  va-et-vient (fumée, lumières), en ralentissant avant chaque demi-tour. Réglage « Boucle vivante » du bloc
  (2,4 s par défaut, 0 = image fixe) et « Vitesse de la boucle ».
- **Bruit du moteur en continu** : `assets/engine-idle.mp3` (ralenti extrait de la vidéo, boucle sans raccord)
  joue entre les plans et sur le présentoir ; il se fait discret pendant qu'un plan avance avec sa propre bande-son
  et se tait si le visiteur quitte la section. Réglage « Bruit du moteur en boucle » (vide = aucun). Sur
  iPhone, le volume ne se règle pas : la boucle joue à plein ou se tait.
- **Fiche produit « En savoir plus »** : chaque carte du présentoir (image, titre ou bouton) ouvre un panneau en
  verre qui grandit depuis la carte, bord néon animé : galerie avec vignettes, prix et badge promo, points forts,
  choix des variantes (prix, promo et photo suivent, les combinaisons épuisées sont barrées), quantité, « Ajouter
  au panier », icônes des moyens de paiement de la boutique, puis Description / Mode d'emploi / Ingrédients en
  accordéon et trois arguments de réassurance (réglages du bloc). Tout se passe dans la fenêtre, aucune page
  produit n'est nécessaire. Échap, la croix ou le fond sombre la ferment. Les cartes des quatre arrêts de la
  vidéo (carrosserie, portière, habitacle, jante) ont le même bouton « En savoir plus » : les flèches de la
  fenêtre passent d'un produit à l'autre (présentoir d'abord, puis les produits d'arrêt absents du présentoir).
- **Points d'intérêt** (portière, habitacle) : gros rond pulsant (deux ondes), trait lumineux et libellé bordé
  d'orange, pour rester visibles sur des plans sombres. Sur mobile, le bouton son monte au-dessus de la carte
  d'un arrêt pour ne jamais la recouvrir.
- **Contenu de la fiche** : la description du produit, plus trois métachamps produit créés sur la boutique
  (Produits › fiche produit › Métachamps) : « Points forts (hero voiture) » (liste de phrases courtes, en
  pastilles sous le prix), « Mode d'emploi (hero voiture) » et « Ingrédients (hero voiture) » (texte enrichi).
  Les photos du produit (Médias) forment le carrousel. Les tailles de police de la section sont en pixels fixes :
  elles ne dépendent pas de la taille de base du thème.
- **Avant / après** : donner au produit une « Image avant (hero voiture) » et une « Image après (hero voiture) »
  (métachamps produit, déjà créés sur la boutique), ou deux photos dont le texte alternatif contient « avant »
  et « après » : un comparateur à curseur termine alors le carrousel (les photos du produit viennent d'abord).
- « Vitesse de lecture entre deux plans » : × 1,5 par défaut.
- Pensé pour la première section de la page d'accueil. Avec « réduire les animations », la version empilée
  s'affiche comme dans l'autre mode.

Pour réencoder depuis un nouvel export du plan-séquence :

```bash
GOP=30 PRESET=veryslow tools/encode-chapters.sh plan-sequence-source.mp4 /chemin/absolu/sortie 18.4
```

Un export 4K est d'abord ramené en 1080p. `GOP=30` (une image clé par seconde) et `PRESET=veryslow`
gardent la qualité pour une vidéo longue sous la limite de 20 Mo.

## 7. Mettre à jour la séquence d'images (nouvel export du plan-séquence)

```bash
tools/extract-frames.sh plan-sequence.mp4 nouvelles-images 74
```

Le script reprend les mêmes 248 instants (`tools/sampling.json`) : mêmes numéros, mêmes arrêts.
Remplacer ensuite les `f_XXXX.webp` dans `/assets` du thème. Il faut ffmpeg et Python 3.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| La section n'apparaît pas dans « Ajouter une section » | Le fichier n'est pas dans `sections/`, ou `shopify theme check` signale une erreur |
| La séquence ne défile pas, image figée | Images absentes de `/assets`, ou « Nombre total de frames » ≠ numéro de la dernière image |
| Écran noir à la place de la vidéo | Choisir la vidéo via « Vidéo d'allumage (Fichiers Shopify) » |
| Le compteur du panier ne bouge pas | Thème avec un compteur spécifique, voir la section 5 |

## Nouveautés (octobre 2026) et retour arrière

Chaque nouveauté a son interrupteur dans l'éditeur de thème et son propre commit sur la branche ;
rien n'écrase les fichiers d'origine du thème. Pour tout annuler d'un coup : `git revert` des commits
« Nouveauté … » puis renvoyer les fichiers sur le thème, ou recoller les gabarits de `backup/`.

| Nouveauté | Où | Pour désactiver | Pour supprimer complètement |
| --- | --- | --- | --- |
| Image qui vole vers le panier, badge qui rebondit | Header verre › Nouveautés | Décocher « Animation d'ajout au panier » | Revert du commit « Nouveauté header » |
| Compte à rebours dans la pilule d'annonce | Header verre › Annonce | Vider « Compte à rebours jusqu'au » | idem |
| Transitions de page en fondu | Header verre › Nouveautés | Décocher « Transitions de page » | idem |
| « Complétez le kit » (recommandations) dans le panier | Panier verre › Nouveautés | Décocher « Complétez le kit » | Revert du commit « Nouveauté panier » |
| Second palier « cadeau offert » dans la barre | Panier verre › Nouveautés | Mettre le seuil cadeau à 0 | idem |
| Boutons de paiement rapide dans le panier | Panier verre › Nouveautés | Décocher | idem |
| Halo qui suit le curseur, mode cinéma | Hero › bloc « Effets visuels » | Décocher chaque effet, ou supprimer le bloc | Revert du commit « Nouveauté hero » |
| Bouton « Prendre tout le kit » sous le présentoir | Hero › bloc Présentoir › Nouveauté | Décocher « Bouton tout le kit » | idem |
| Réduction automatique « Kit complet : -15 % dès 3 produits » | Shopify › Réductions | Désactiver ou supprimer la réduction | Elle n'est pas dans le code |
| Section « Avant / après (verre) » | Page d'accueil | Masquer ou supprimer la section | `backup/templates-index.before-nouveautes.json` |
| Section « Avis clients (verre) » | Page d'accueil | Masquer ou supprimer la section | idem |
| Page 404 en verre | Gabarit 404 | Remplacer par la section « main-404 » du thème | `backup/templates-404.json` |
| Thème sombre sur les pages intérieures (schémas de couleurs) | Paramètres du thème › Couleurs | Rétablir les schémas | `backup/settings_data.before-dark.json` |
| Sans page produit : `/products/…` renvoie à l'accueil et ouvre la fiche « En savoir plus » | Gabarit Produits | Remettre la section « main-product » du thème dans le gabarit | `backup/templates-product.json` |
| Liens produit du panier et des avis vers la fiche de l'accueil (`/#fiche=handle`) | Panier verre › Pas de page produit · Avis clients | Décocher la case | Revert du commit « Sans page produit » |
| Image et titre des cartes du hero ouvrent la fiche (plus de lien vers la page produit) | Hero | Aucun réglage : revert du commit | idem |

Conseil : dupliquer le thème (Boutique en ligne › Thèmes › … › Dupliquer) avant de tester une
nouveauté donne un point de retour complet en un clic.

## Header et footer en verre (même direction artistique)

Deux sections de groupe accompagnent le hero :

- `sections/hero-glass-header.liquid` (+ `assets/hero-glass-header.css`, `assets/hero-glass-header.js`) : barre
  flottante en verre (pilule ou pleine largeur), logo image ou nom de la boutique, menu du thème avec sous-menus en
  carte de verre, recherche dépliante, compte, panier branché sur le tiroir du thème (`#cart-icon-bubble`), tiroir
  mobile avec accordéons et bouton principal. Sur l'accueil, la barre flotte par-dessus la vidéo du hero ; ailleurs
  elle reste collée en haut. Elle se cache en descendant et revient en remontant (réglable). Pilule d'annonce
  facultative au-dessus.
- `sections/hero-glass-footer.liquid` (+ `assets/hero-glass-footer.css`) : réassurance en pilules, panneaux de verre
  (marque + réseaux sociaux des paramètres du thème, menus, texte, newsletter avec le contour néon de la fiche
  produit), bas de page avec moyens de paiement, politiques, copyright, retour en haut, et grand nom en filigrane.

- `sections/hero-glass-cart.liquid` (+ `snippets/hero-glass-cart-content.liquid`, `assets/hero-glass-cart.css`,
  `assets/hero-glass-cart.js`) : tiroir panier en verre. Il s'ouvre depuis l'icône panier du header, après un ajout
  depuis le hero (événement `cart:added`) et depuis les pages produit du thème (il prend la place du tiroir
  d'origine, masqué par CSS, en écoutant son événement `cart:open` et le `cartUpdate` du pub/sub du thème).
  Barre de livraison offerte (seuil réglable), lignes avec quantité et suppression (`/cart/change.js` + API de
  rendu de sections), sous-total, bouton « Commander », moyens de paiement, état vide.

Dans l'éditeur de thème, elles s'ajoutent dans les groupes « En-tête » et « Pied de page » ; le header et le footer
d'origine du thème peuvent être désactivés (ils le sont sur le thème de test). La recherche du header est
désactivée par défaut (réglage « Afficher la recherche »).
