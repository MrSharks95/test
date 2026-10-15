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
│   ├── f_0001.webp … f_0248.webp     le plan-séquence (13 Mo)
│   ├── hero-ignition.mp4 / .mp3      vidéo d'allumage et son moteur
│   ├── hero-poster.jpg               dernière image de la vidéo
│   └── stop-*.jpg                    images fixes de la version empilée
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
- Bouton son : il lance le son et la vidéo ensemble.

## 6. Mettre à jour la séquence (ex. vidéo 1080p)

```bash
tools/extract-frames.sh video-1080p.mp4 nouvelles-images 74
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
