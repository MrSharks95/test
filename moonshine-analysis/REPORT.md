# moon-shine.fr — analyse technique du site Shopify (reconstruction « même type de site »)

Date de l'analyse : 14 octobre 2026. Tout a été fait en `bash` + `curl` (User-Agent Chrome 124), sans navigateur : le rendu WebGL n'a pas été observé, il est **déduit du code**. Les fichiers récupérés (HTML, JS, CSS, GLB, BIN, images) sont restés en local (`dl/`, `html/`, `extra/`, ignorés par git) ; ce dépôt ne contient que la documentation (`REPORT.md`, `ASSETS.csv`, `data/`). On documente la technique, on ne reproduit ni leurs assets ni leur code (seuls de courts extraits illustratifs figurent ci-dessous).

Pages analysées : `/`, `/products/coffret-integral-3-x-30-ml`, `/pages/faq`, `/collections/coffrets` (+ en complément : `/pages/collectible`, `/cart`, `/collections/all`, `/pages/nous-contacter`, `/pages/retours`, 3 fiches produit pour vérifier `MS2_PAGE`, `sitemap.xml`, `/products/<handle>.js`, `/cart.js`).

Un audit GPT du même site (PDF « Audit Moonshine Shopify 3D Auto », 24 p.) m'a été transmis : il est **largement confirmé** par mes relevés ; la section 12 liste ce qu'il confirme, ce qu'il manque et ce que je nuance.

---

## 1. Synthèse

- **Ce n'est pas un thème du Theme Store** : thème custom (`Shopify.theme.name = "Moonshine - V2 liens directs 12-10"`, `schema_name: "Bullet" 6.1.0`, `theme_store_id: null`). Toute l'expérience tient dans **deux fichiers** : `ms2-app.js` (772 Ko, bundle IIFE minifié : three.js r186 + Lenis 1.3.26 + code maison) et `ms2-app.css` (48 Ko), plus une **config JSON inline `window.MS2`** (~51 Ko) générée par Liquid dans chaque page.
- **Pas de GSAP / ScrollTrigger, pas de Swiper, Barba, Alpine, model-viewer, pas de séquence d'images, pas de vidéo**. La scène est un **canvas three.js `position: sticky`** piloté par le **scroll natif lissé par Lenis** : la position de scroll est convertie en un paramètre `t ∈ [0, 5]`, interpolé entre **6 poses clés** (smoothstep), et une boucle `requestAnimationFrame` lisse tout (exponentielles) à chaque frame.
- **Assets 3D** : 4 GLB (5,5 Mo, Meshopt + quantization, exportés par glTF-Transform 4.5.1, **sans textures ni animations** : tout l'éclairage, les matériaux et les mouvements sont faits en code) + **6 nuages de points `.bin` maison** (15,2 Mo : 3 univers × version complète/légère, format Uint32 + 8 octets/point).
- **Une seule section Liquid `ms2-boutique`** sert la home, les fiches produit et les collections : la page contient **deux « modes » (parfums / coffrets)**, un routeur JS (pushState/popstate) bascule entre eux et synchronise l'URL/titre avec le produit affiché. Panier via `/cart.js`, `/cart/add.js`, `/cart/change.js` ; checkout Shopify standard.
- **Design system** : fond noir, blanc + alphas, **une couleur d'accent par parfum** (`--accent`, animée via `@property`), Inter 400/500/600 pour le texte (uppercase, interlettrage 0.2em), Archivo Black / Jost 900 pour les titres, échelle fluide `clamp()`, deux breakpoints (1100 / 820 px), verre dépoli (`backdrop-filter`) partout.

---

## 2. Stack identifiée

| Composant | Version / preuve | Rôle |
|---|---|---|
| Shopify Online Store 2.0 | templates JSON (`template--<id>__main`), `Shopify.theme.schema_name = "Bullet"`, `schema_version 6.1.0`, `theme_store_id null` | Hébergement, catalogue, panier, checkout, formulaires |
| three.js | **r186** (`window.__THREE__ = "186"`, `revision: "186"`), embarqué dans le bundle | Rendu WebGL : flacons, coffrets, logo, nuages de points |
| GLTFLoader + **MeshoptDecoder** | `new GLTFLoader().setMeshoptDecoder(...)` ; GLB avec `EXT_meshopt_compression` + `KHR_mesh_quantization` | Chargement des 4 modèles |
| DRACOLoader / KTX2Loader | classes présentes (GLTFLoader générique) mais **aucun appel** `setDRACOLoader(...)` / `setKTX2Loader(...)` → **non utilisés** | — |
| PMREMGenerator | `fromScene()` sur une « pièce » de plans émissifs | Environnement studio sans HDR |
| Lenis | **1.3.26** (`window.lenis.version`), `new Lenis({ autoRaf: true, lerp: 0.09 })`, désactivé si `prefers-reduced-motion` | Scroll lissé ; `data-lenis-prevent` sur les overlays |
| GLSL maison | `ShaderMaterial` (nuages) + `onBeforeCompile` (métal brossé, verre teinté, étiquette émissive) | Particules, matériaux |
| Canvas 2D | loader (logo « M » en 5 200 points) | Écran de chargement |
| CSS 3D | `perspective` / `preserve-3d` / `rotateY() translateZ()` | Anneau de cartes à collectionner |
| History API + View Transitions | `pushState`, `replaceState`, `popstate`, `history.scrollRestoration = "manual"` ; CSS `@view-transition { navigation: auto }` + `::view-transition-old/new(root) { animation-duration: .35s }` | Routeur interne pour les pages boutique (transitions par classes CSS, aucun `startViewTransition` en JS) ; **fondu cross-document de 0.35 s** sur les vraies navigations (pages texte, panier) dans les navigateurs compatibles |
| glTF-Transform | `asset.generator = "glTF-Transform v4.5.1"` sur les 4 GLB | Pipeline d'optimisation 3D (dernier outil de la chaîne ; l'outil de modélisation n'est pas identifiable) |
| Scripts plateforme Shopify | perf-kit 3.10.2, privacy-banner, shop-js (cart sync), portable-wallets (checkout accéléré), shopify_pay storefront, hCaptcha `ce_storefront_forms_captcha_hcaptcha v1.5.3`, web-pixels-manager, trekkie, `standard-actions.js`, `speculationrules`, `/.well-known/ucp` | Analytics, consentement, paiement, anti-spam |
| Polices | Shopify Fonts CDN (`/cdn/fonts/...`, `@font-face` généré par Liquid, `font-display: swap`) | Inter n4/n5/n6 (woff2 + woff), Archivo Black n4, Jost n9 déclarée sous le nom « MS Titre » |

Absents (grep des bannières/signatures sur le bundle et le CSS) : gsap, ScrollTrigger, swiper, barba, alpine, `@google/model-viewer`, `<video>`, `<model-viewer>`, EffectComposer/UnrealBloom, HDR/KTX2/USDZ, séquence de frames numérotées.

---

## 3. Inventaire des assets (voir `ASSETS.csv` : 189 URLs, 48,0 Mo bruts)

### 3.1 Modèles 3D (GLB) — 5,49 Mo

| Fichier (clé manifeste) | Poids | Nœuds / meshes | Triangles | Sommets | Extensions | Matériaux dans le fichier |
|---|---|---|---|---|---|---|
| `models/moonshine.glb` (flacon + capsule) | 1 269 208 o | 35 / 27 | **295 482** | 188 227 | meshopt, quantization, **KHR_materials_transmission** | 2 (`Matériau_2` gris, `Material` rouge transmission 1) — remplacés en code |
| `models/boite.glb` (écrin coffret intégral) | 3 066 576 o | 35 / 12 | 46 972 | 54 610 | meshopt, quantization | 2 (`foam`, `Material.026`) |
| `models/boite2.glb` (coffret découverte : porte-clés + tube) | 289 636 o | 10 / 7 | 24 342 | 27 772 | meshopt, quantization | 0 |
| `models/logo.glb` (logo 3D du header) | 869 548 o | 1 / 1 | 23 178 | 69 534 | meshopt, quantization | 0 |

- **Aucune texture embarquée, aucune animation** dans les 4 fichiers (`textures: 0`, `images: 0`, `animations: 0`). Le réalisme vient des matériaux/lumières/shaders en JS.
- Nommage des nœuds du flacon : `Objet_1 … Objet_52`, `Objet_51_remesh`, `GLASS`, `RUBBER PARTS`, `SANDBBLASTED`, `THREAD`, `vis`, `WHITE THING`, `Calque 1`, `Défaut` (export type Cinema 4D/« Objet_n », francophone). Le code **regroupe les pièces par nom** : couvercle (`Objet_15, 13, 18, 19` → pivot calculé sur la géométrie), capuchon (`Objet_16, 52, 12, 20, 17, 14`), base vissée (`Objet_1, 3‑11, 50`), fourreau `Objet_51_remesh`, liquide `Objet_21‑25` (les 5 « Objet_21‑25 » sont aussi les flacons dans `boite.glb`, retirés au chargement et remplacés par des instances du vrai flacon).
- `boite.glb` : `Cube*` (coque/mousse), `Cylinder*`, trois groupes `Neutre.00x` (emplacements des flacons), `porte` (couvercle coulissant), `Objet_16 1` (logo). `boite2.glb` : `model_0` (porte-clés), `Cylinder` (tube), plans `goodplace / perfecttrap / vanillastate` (étiquettes des échantillons), `porte`.

### 3.2 Nuages de points (`.bin` maison) — 15,18 Mo

| Fichier | Points | Poids | Vérif `4 + 8·N` |
|---|---|---|---|
| `clouds/good-place.bin` | 425 373 | 3 402 988 o | ✔ |
| `clouds/good-place-light.bin` | 212 686 | 1 701 492 o | ✔ |
| `clouds/perfect-trap.bin` | 463 860 | 3 710 884 o | ✔ |
| `clouds/perfect-trap-light.bin` | 231 930 | 1 855 444 o | ✔ |
| `clouds/vanilla-state.bin` | 375 361 | 3 002 892 o | ✔ |
| `clouds/vanilla-state-light.bin` | 187 680 | 1 501 444 o | ✔ |

Format (lu dans le loader du bundle) : `Uint32 LE` = nombre de points, puis par point **8 octets** : `Int16 x, y, z` (÷ 32 000 → [‑1, 1]), `Uint8 luminance`, `Uint8 contour`. Les versions « light » = moitié des points (choisies sur `(pointer: coarse)`).

Lecture du placement en scène : `x,y` sont étalés comme une image (`x·2.6·(1+z·1.1)`, `y·2.6·(1+z·1.1)+0.35`), `z` devient une **profondeur** (`-z·9`), la luminance pilote l'intensité, le contour l'épaisseur du trait. Déduction : chaque nuage est un **relief 2,5D fabriqué à partir d'une illustration + carte de profondeur + détection de contours**, pas un scan 3D. Le générateur n'est pas exposé ; le format, lui, est trivial à reproduire (Node/Python).

### 3.3 Images

| Catégorie (clé manifeste / origine) | Fichiers | Poids | Dimensions / format réel |
|---|---|---|---|
| Photos produit (`/cdn/shop/files/…?width=2000`) | 83 | 10,50 Mo | originaux 2 500 × 2 500 (JPEG) et 1 324 × 1 324 (pyramides, PNG), redimensionnés par le CDN |
| Page collectibles (`ms2-co-badge-*`, `ms2-co-billet-*`, `ms2-co-stickers`) | 7 | **8,47 Mo** | **PNG de 1,4 à 2,4 Mo nommés `.webp`** ; le `src` passe par `&width=600` (resize CDN) mais le `data-full` de la lightbox charge l'original |
| Carrousel « univers » (`img/deco/<parfum>-N.webp`, 6/9/7 images) | 22 | 2,77 Mo | 675 × 1 200 (ratio 0.563) sauf 1 paysage 2 000 × 1 110 ; **JPEG/PNG renommés `.webp`** |
| Cartes à collectionner (`img/cards/<parfum>-N.webp`, 9 par univers) | 27 | 1,67 Mo | ~750 × 1 120 (ratio CSS `750/1120`), JPEG renommés |
| Contenu de boîte (`ms-h-co_badge_*`, `ms-h-co_stickers`) | 4 | 0,49 Mo | 1 200² / 1 600² JPEG |
| Thème (`img/brushed.jpg` 2 048², `img/logo-*.png`, `img/m-white.png` 1 922 × 1 084, `img/picto-*.png` 256², `about-*`, favicons, og) | 13 | 0,97 Mo | PNG alpha pour les pictos/logos (rasterisés en particules) |

51 fichiers ont une **extension trompeuse** (`.webp` contenant du JPEG/PNG) : le CDN Shopify les sert tels quels (`content-type` réel). **Aucune séquence de frames numérotées** : les suffixes `-1…-9` sont des carrousels/anneaux de cartes, pas des images d'animation.

### 3.4 Polices (0,30 Mo, Shopify Fonts CDN)

Inter 400 / 500 / 600 (woff2 ≈ 39 Ko chacun + woff), Archivo Black 400 (25 Ko), Jost 900 (12 Ko) déclarée `font-family: "MS Titre"`. Trois `<link rel="preload" as="font">` (Inter 400, Archivo Black, Jost). Les familles sont injectées en variables CSS depuis les réglages du thème :

```css
html:root { --police-texte: "Inter", sans-serif; --police-affiche: "Archivo Black", …; --police-titre: "MS Titre", "Archivo Black", … }
```

### 3.5 Code

| Fichier | Poids brut | Contenu |
|---|---|---|
| `ms2-app.js` | 771 744 o (une seule IIFE, pas de sourcemap) | ~28 Ko de **données produit par défaut** en tête (textes, notes, ingrédients, 3 parfums + 2 coffrets), puis three.js, Lenis, shaders GLSL en template strings (commentaires en français), modules : routeur, loader, scène parfums, scène coffrets, nuage, logo, menu, panier, formulaires, lightbox, anneau de cartes |
| `ms2-app.css` | 47 822 o (minifié, 1 ligne) | tout le style ; `@font-face` et variables de police sont inline dans le HTML (Liquid) |
| HTML | 116–131 Ko par page | dont ~51 Ko de `window.MS2` (config + photos + métadonnées) |

### 3.6 Ordre de grandeur du chargement initial (poids bruts, hors gzip/brotli du CDN)

Home desktop : HTML 125 Ko + CSS 48 Ko + JS 772 Ko + polices ≈ 155 Ko + `m-white.png` 30 Ko (loader) + `logo.glb` 870 Ko + `moonshine.glb` 1,27 Mo + `brushed.jpg` 311 Ko + 1 nuage complet 3,0–3,7 Mo + picto ≈ **6,5–7,2 Mo**, plus ≈ 0,8 Mo de scripts plateforme Shopify. Mobile (`pointer: coarse`) : nuage « light » → ≈ 5,0–5,4 Mo. Ensuite, sur `pointer: fine` sans `saveData`, la scène coffrets est **préchargée en idle après 2,5 s** (`boite.glb` 3,07 Mo + `boite2.glb` 0,29 Mo + `logo-boite.png`). Les carrousels et photos produit sont en `loading="lazy"` / préchargés à l'approche de la fiche.

---

## 4. Architecture Shopify (templates / sections / données)

### 4.1 Templates et sections (OS 2.0, une section « main » par template)

| URL | `<body>` | Section rendue | `window.MS2_PAGE` |
|---|---|---|---|
| `/` (index) | `class="is-loading" data-ms2-page="parfums"` | `ms2-boutique` | `{ page: "parfums", sel: "", variant: "capsule", fiche: false }` |
| `/products/coffret-good-place-30-ml` | idem | `ms2-boutique` | `{ page: "parfums", sel: "good-place", variant: "capsule", fiche: true }` |
| `/products/recharge-good-place-30-ml` | idem | `ms2-boutique` | `{ …, variant: "parfum", fiche: true }` |
| `/products/coffret-integral-3-x-30-ml` | `data-ms2-page="coffrets"` | `ms2-boutique` | `{ page: "coffrets", sel: "coffret-01", variant: "capsule", fiche: true }` |
| `/products/coffret-decouverte` | idem | `ms2-boutique` | `{ page: "coffrets", sel: "coffret-02", … }` |
| `/collections/coffrets` | `data-ms2-page="coffrets"` | `ms2-boutique` | `{ page: "coffrets", sel: "" }` |
| `/collections/all` | `data-ms2-page="parfums"` | `ms2-boutique` | mode parfums |
| `/pages/faq`, `/pages/retours`, `/pages/nous-contacter` | `class="simple-page" data-ms2-page="texte"` | `ms2-texte` | — |
| `/pages/collectible` | `class="simple-page" data-ms2-page="collectibles"` | `ms2-collectibles` | — |
| `/cart` | `class="simple-page" data-ms2-page="panier"` | `ms2-panier` | — |

Conséquence : **le même HTML de boutique (les deux modes) est servi sur 4 templates** ; Liquid ne change que les attributs `data-ms2-page`/`MS2_PAGE`, le `<title>`, le canonical, les `og:*` et le JSON-LD (`WebSite` + `Organization` sur la home, `Product` complet avec images sur les fiches). Les 8 produits sont dans le sitemap et ont une vraie URL indexable.

### 4.2 La config `window.MS2` (générée par Liquid)

```js
window.MS2 = {
  produits: { pt: { capsule: {…}, recharge: {…} }, gp: {…}, vs: {…}, ci: {…}, cd: {…} },
  boite:    { pt: { carte, badge, billet, stickers, recharge: {…} }, gp, vs, ci },
  cartes:   { pt: [], gp: [], vs: [] },          // vide → repli sur les assets du thème
  panier:   { nb: 0 }, devise: "EUR", format: "€{{amount_with_comma_separator}}",
  routes:   { racine, panier, ajout: "/cart/add", modif: "/cart/change", compte, commande: "/checkout", coffrets },
  assets:   { "models/moonshine.glb": "//…/t/29/assets/ms2-moonshine.glb?v=…", … }  // 69 clés → asset_url
}
```

Chaque produit porte : `id`, `handle`, `url`, `titre`, `prix` (formaté), `dispo`, `variante` (ID de variante à ajouter), `meta` (**metafields** : `famille`, `accroche`, `description_longue`, `notes_tete/coeur/fond`, `contenu`, `parfumeur`, `concentration`, `cible`, `origine`, `notes_accueil`, `ingredients` en rich-text, `boite_note`) et `photos[]` (`u` avec `&width=2000`, `w`, `h`, `alt`, `hors` = exclue de la galerie principale). Le manifeste `assets` fait le pont entre des **clés logiques** (`img/deco/good-place-1.webp`) et les URLs versionnées du CDN : le JS n'écrit jamais une URL d'asset en dur (`S(cle)`).

### 4.3 Ce que Liquid rend vs ce que le JS remplit

- **Liquid** : squelette complet des deux modes (hero, 5 panneaux, fiche, volet infos, carrousel), header, nav, menu (6 entrées numérotées 01‑06 : Nos parfums `/`, Nos coffrets `/collections/coffrets`, Les collectibles `/pages/collectible`, À propos `/pages/contact`, Questions `/pages/faq` `data-pane="faq"`, Contact `/pages/nous-contacter` `data-pane="contact"`), **panneaux FAQ et Contact inclus dans toutes les pages** (le contenu FAQ est dupliqué dans `/pages/faq`), footer (newsletter, colonnes, `shop.enabled_payment_types` → icônes), formulaires Shopify (`form_type=customer` newsletter / alerte-stock avec `contact[tags]`, formulaire contact), config JSON, SEO.
- **JS** : tous les champs produit (`[data-f]`, `[data-title]`, `[data-price]`, `[data-photos]`, `[data-notes]`, `[data-pyramid]`, `[data-info]`, `[data-ingredients]`…) sont **vides dans le HTML** et remplis au runtime depuis `MS2` (le `<h1>` ne contient que « Moonshine » en repli). Les textes des panneaux 1‑3 (« Capuchon aimanté », « Parfum interchangeable », « Fermeture à vis ») sont en dur dans le HTML (section/blocks). Le panier (drawer et page `/cart`) est entièrement rendu côté client.

### 4.4 Panier, formulaires, navigation

- Lecture `GET /cart.js` au chargement et sur `pageshow` (bfcache) ; ajout `POST /cart/add.js` `{ items: [{ id: <variante>, quantity: 1 }] }` puis relecture `/cart.js` et ouverture du drawer ; quantité/suppression `POST /cart/change.js` `{ id: <line key>, quantity }` (0 = retirer) ; erreurs affichées depuis `description`/`message` ; badge `#cart-count`. Commander → `/checkout`.
- Newsletter / alerte retour en stock : formulaires `customer` Shopify avec tags `newsletter`, `alerte-stock`, `alerte-<handle>` ; l'état du formulaire est sauvé en `sessionStorage` avant l'envoi puis restauré après la redirection Shopify (`?customer_posted=true`, ou `form_type=customer&form_key` = défi hCaptcha à revalider), les paramètres sont ensuite nettoyés par `replaceState`.
- Les panneaux du menu changent l'URL (`replaceState` vers `/pages/faq` ou `/pages/nous-contacter`, mémorisation de l'URL précédente dans `history.state.ms2Avant`) et la restaurent à la fermeture ou sur `popstate`.

---

## 5. Structure DOM et couches

### 5.1 Ordre du `<body>` (home)

1. `header.top` (fixed, z 30) : `a.logo > canvas#logo-gl` (logo 3D), `#cart-btn` (+ compteur), `#menu-btn` (burger).
2. `nav.hero-nav` (fixed, z 29) : « Nos parfums » / « Nos coffrets » (`aria-current` mis à jour par le routeur).
3. `aside#cart.cart` (fixed sous le header, z 25, verre dépoli, drawer).
4. `nav#menu` (fixed inset 0, z 20, `backdrop-filter: blur(18px)`) : `ul` des 6 entrées + `section.menu-pane[data-pane-id="faq"]` (accordéon `<details>` + newsletter) + `section.menu-pane[data-pane-id="contact"]` (formulaire).
5. `div#shopify-section-…__main.shopify-section.ms2-boutique` :
   - `#loader` (fixed, z 100) : `canvas#loader-gl` + barre.
   - `#bg` (fixed, z 0) : dégradé radial teinté par `--accent`, opacité `--bg-o`.
   - `.mode[data-mode="parfums"]` : `.gl-wrap` (absolute, `pointer-events: none`, z 1, hauteur = hero + story) > `canvas.gl` (**sticky, 100lvh**) · `#switcher` (fixed, tablist des 3 parfums) · `#scroll-next` (fixed) · `main` (z 2) > `section#collection.hero` (100svh) · `section#parfum.story` (**500vh**) > `.sticky` (100vh) > 5 `article.panel` (le 5ᵉ = `.sheet`, la fiche) · `section#univers` (carrousel) ; puis `aside#info.info` (fixed à droite, z 30).
   - `.mode[data-mode="coffrets"]` (`hidden`) : même schéma avec `section#collection-coffrets.hero` + `section#coffret.story.story-short` (100vh) + `aside#info-coffrets`.
   - `.mode-pied > footer`.
6. `div#lightbox` (fixed, z 40, `role="dialog"`).
7. `<script>window.MS2 = …</script>`, `<script src="ms2-app.js" defer>`.

### 5.2 Fixed / sticky / flux

| Élément | Position | Rôle |
|---|---|---|
| `canvas.gl` | `sticky; top: 0; height: 100lvh` dans `.gl-wrap` absolu | le canvas suit le scroll sur toute la hauteur hero + story, puis se fait recouvrir par `#univers` et le footer |
| `.story .sticky` | `sticky; top: 0; height: 100vh; overflow: hidden; touch-action: pan-y` | contient les panneaux de texte, absolus (`top: 50%`, gauche desktop / bas mobile) |
| `.top`, `.hero-nav`, `.switcher`, `.scroll-next`, `#bg`, `#menu`, `.cart`, `.info`, `.lightbox`, `#loader` | `fixed` | chrome d'interface, overlays |
| `.more-close` (fiche étendue mobile) | `sticky; top: 0` | bouton « Réduire » qui reste visible |
| `#univers`, footer, pages texte | flux normal | |

Pile z : `#bg` 0 < `.gl-wrap` 1 < `main` 2 < `.switcher`/`.scroll-next` 10 < `#menu` 20 < `.cart` 25 < `.hero-nav` 29 < `.top`/`.info` 30 < `.lightbox` 40 < `#loader` 100.

### 5.3 Classes d'état sur `<body>` (pilotées par JS, exploitées par le CSS)

`is-loading` (overflow hidden + loader visible) · `is-rapide` / `is-relais` (loader court / loader de transition) · `is-leaving` (fondu de sortie de mode, 300 ms) · `is-scrolled` (> 24 px : fond du header) · `in-story` / `past-story` (affiche/masque le switcher) · `can-continue` (bouton « écran suivant ») · `is-swapping` (changement de parfum : textes du hero en `opacity 0 + blur(6px) + translateY(6px)` pendant 420 ms) · `is-jumping` (saut animé vers la fiche) · `is-dragging` · `menu-open` · `cart-open` · `info-open` · `lightbox-open` · `cart-busy` · `.sheet.more-open` (fiche dépliée).

---

## 6. Schéma de la scène, chapitre par chapitre (mode parfums)

### 6.1 Mapping scroll → paramètre `t`

`hero` = 100svh ; `#parfum.story` = 500vh dont 400vh « utiles ». Avec `y` = scrollY, `n` = `offsetTop` de la story, `r` = hauteur story − viewport :

- `t = y / n` dans le hero (0 → 1),
- `t = 1 + 4 · clamp((y − n) / r)` dans la story (1 → 5).

Panneau actif = `round(t) − 1` (aucun si `t < 0.55`) ; `--bg-o = 0.4 + 0.6·clamp(t)` ; `--hero-o = 1 − clamp(2.2·t)` (le hero disparaît vite). `t` est lissé à chaque frame (`tSmooth += (t − tSmooth)·(1 − e^(−7·dt))`) puis **interpolé entre 6 poses** (`smoothstep` entre `floor(t)` et `floor(t)+1`). La caméra ne bouge jamais (fov 30°, z = 4.4) : ce sont les objets qui se déplacent.

### 6.2 Les 6 poses du flacon sélectionné (desktop ; `T` = demi-largeur visible)

| `t` | Chapitre / panneau | Pose (x, y, échelle, rotations) | Ce qui se passe |
|---|---|---|---|
| 0 | **Hero** « Eau de parfum / NOM / 3 notes » | x 0, y 0.22, s ≤ 1.08, rz −0.1, auto-rotation 1× | 3 flacons en anneau (rayon ≈ `0.62·T/sin(120°)`), le sélectionné devant et éclairé (envMap 0.82 vs 0.02), les deux autres derrière, assombris ; nuage de points plein écran ; flottement `sin(t·0.8)·0.03` ; parallaxe pointeur (ry ±0.25, rx ±0.12) ; drag horizontal pour tourner le flacon (inertie), clic sur le bouchon → couvercle, clic sur un flacon arrière → sélection, swipe tactile → parfum suivant |
| 1 | panneau 0 « Eau de parfum » (nom, notes, pyramide, intro) | x 0.3·T, y 0.32·… , s 1.3, ry 0.7, spin 0.35 | les 2 autres flacons sortent du champ (`±u·(2.2·T+1)`), le nuage recule (z −2.6 → −4.1, alpha ×0.65) et **se transforme en pictogramme** du parfum (`uLogo` de 0.2 à 1) |
| 2 | panneau 1 « Capuchon aimanté » | y −1.42, **s 3**, rx 0.38, ry 1.7 | gros plan sur le haut ; le capuchon se **soulève légèrement** (0.023 u, `t ∈ [1.4, 1.9]`) |
| 3 | panneau 2 « Parfum interchangeable » | y 0.06, s 1.6, ry 3.4, rz −0.32 | capuchon **levé de 0.22 u** (`t ∈ [2.08, 2.58]`), **base dévissée** (2 tours, descente 0.026 u, `t ∈ [2.35, 2.85]`), fourreau glissé (0.04 u) |
| 4 | panneau 3 « Fermeture à vis » | y 1.05, s 2.8, rx −0.32, ry 4.7 | vue par dessous ; tout se **revisse** (`t ∈ [3.3, 3.75]`) |
| 5 | panneau 4 = **fiche** (`.sheet`) : titre, prix, photos, description, variantes, « Ajouter au panier » | x 0.36·T, s ≤ 1.35, rx 0.15, ry 6.7, **rz 1.22** (incliné), spin 0.4 | flacon couché à droite de la fiche ; variante « Parfum 30 ml » → **la capsule disparaît** (capuchon levé, fourreau/base fondus en 1.9 s) pour montrer la recharge ; `replaceState` vers `/products/<handle>` ; « Lire la suite » déplie la fiche ; « Plus d'informations » ouvre `aside.info` (contenu de boîte, ingrédients, notice) |

Mobile (`aspect < 0.85` ou ≤ 820 px) : x = 0, y décalé de +0.32, échelles ×0.72, et les poses 0 et 5 sont **recalculées pour tenir entre le header et le pied du hero / au‑dessus de la fiche** (`setHeroArea`, `setSheetArea` via `ResizeObserver`).

Après la story : `#univers` (carrousel d'ambiance : 6–9 images par parfum, `scroll-snap-type: x mandatory`, ratio par image en `--r`, flèches masquées sur tactile, masque dégradé 8 % aux bords) puis le footer.

### 6.3 Mode coffrets (`/collections/coffrets`, fiches coffret)

Hero (coffret fermé → **le couvercle s'ouvre après 1.9 s**) puis `story-short` = 100vh avec la fiche directement. 2 poses seulement (hero : y 0.2, s ≤ 5 ; fiche : x 0.27·T, s ≤ 5.6 ; mobile : recentrage au‑dessus de la fiche). Flèches/switch : **translation latérale entre coffrets en 1.7 s** (cubic in/out), le coffret non sélectionné recule (z −1.3, échelle ×0.74, matériaux assombris ×0.3). Ouverture : porte coulissante (descente 0.46 u) ou relevée (z +0.42 pour le coffret découverte), `open` ease `x^2.3` sur 1.25 s, logo de porte en plan émissif. Les particules forment le **logo script** (picto `logo-script.png`, 425 k/464 k points aléatoires, teinte bleu‑gris `(0.62, 0.7, 0.82)`, haut `#3a3f5c`), et s'estompent quand on atteint la fiche.

### 6.4 Chargement et transitions de page

- **Loader** (`#loader`, canvas 2D) : le `M` blanc (`m-white.png`) rasterisé à 420 px → **5 200 points** (40 % sur les contours), dessinés en `globalCompositeOperation: lighter` ; barre de progression `scaleX` lissée ; attend `document.fonts.ready` + GLB + nuage ; minimum 500 ms ; fondu 0.9 s (+0.2 s). Visite déjà vue dans la session (`sessionStorage.ms2-vu`) → loader court 0.45 s ; premier parfum affiché tiré au sort puis mémorisé (`ms2-premier`).
- **Routeur** : intercepte les clics sur `a[href]` internes connus (`/`, `/collections/coffrets`, `/products/<handle>` présents dans `MS2`) → `pushState({ms2: état})`, titre, fermeture des overlays ; même mode → `aller(état)` (sélection + saut animé jusqu'à la fiche) ; autre mode → `body.is-leaving` 300 ms, `sortir()` (arrêt du rendu), scroll 0, affichage du `.mode`, `entrer()` ; si la scène n'est pas prête, loader « relais » avec sa propre progression. `popstate` rejoue l'état. Pendant la navigation (après une première interaction), `suivre()` fait un `replaceState` pour que **l'URL reflète toujours le produit visible** (`/products/…` sur la fiche, `/` ou `/collections/coffrets` sinon).

---

## 7. Mécanique d'animation détaillée

### 7.1 Boucle et lissage

Une boucle `rAF` par scène (`THREE.Clock`, `dt` plafonné à 50 ms), mise en pause (`setRunning(false)`) quand on a dépassé la story et pendant le mode inactif. Tout est lissé par exponentielles `1 − e^(−k·dt)` : scroll k = 7, pointeur k = 5 (parallaxe) et k = 22 (souris du nuage), couleurs du nuage k = 2.5, angle d'anneau k = 4, auto‑rotation k = 1.5. Intro : les flacons « tombent » en place (`(1 − intro)³`, `intro += 0.55·dt` ≈ 1.8 s). Le **saut** vers la fiche (`jump`) interpole les poses avec un cubic in/out sur 1.7 s pendant que Lenis saute instantanément au scroll cible après 340 ms.

### 7.2 Renderer, caméra, lumières, environnement (scène parfums)

- `WebGLRenderer({ antialias: true, alpha: true })`, **ACESFilmic**, exposition 1, `setPixelRatio(min(dpr, coarse ? 1.5 : 2))`, `transmissionResolutionScale = 0.5` sur tactile. Fond transparent : la couleur vient de `#bg` (CSS) et du nuage.
- `PerspectiveCamera(30°, …, 0.1, 50)` à z 4.4 ; 2 `DirectionalLight` blanches 1.5 en (±3.5, 1.5, −5).
- **Environnement sans HDR** : une scène auxiliaire noire (#040404) avec 6–7 plans `MeshBasicMaterial` gris (intensités 1 → 9) placés comme des softbox (dessus, côtés, sol, fond), convertie par `PMREMGenerator.fromScene(scene, 0.03)`. Même technique pour le logo du header (`rf`).

### 7.3 Le flacon (matériaux et pièces)

| Pièce | Matériau (valeurs du code) |
|---|---|
| Fourreau alu | `MeshStandardMaterial` #C4C4CC, metalness 1, roughness 0.32, **shader « brossé »** (`onBeforeCompile`) : texture `brushed.jpg` projetée selon 3 axes pondérés par la normale (stries horizontales sur les flancs, droites dessus), module couleur ±22 %, rugosité ±70 %, normale perturbée |
| Capuchon | #FFFFFF metalness 1 roughness 0.05 ; pièces caoutchouc #0B0B0B roughness 0.8 ; plastique #E8E8E8 roughness 0.5 |
| Verre externe | `MeshPhysicalMaterial` blanc teinté 25 % vers la couleur « glow », roughness 0.02, `transparent`, opacity 0.14, clearcoat 1, envMapIntensity 2.2, `depthWrite: false` |
| **Liquide** | `MeshPhysicalMaterial` : `transmission: 1`, `ior: 1.36`, `thickness: 0.22`, `attenuationColor` = couleur du parfum, `attenuationDistance: 0.14` (× échelle), emissive = glow, roughness 0.02 |
| Bulles | `InstancedMesh` de **30 sphères** (`SphereGeometry(1, 10, 8)`, `MeshBasicMaterial` glow→blanc 75 %), montée 0.015–0.055 u/s, ondulation `sin(1.3·t + φ)·0.05`, fondu en haut/bas |
| Normales | le code **corrige localement les normales** d'une bande de `Objet_51` (secteur angulaire 156–163°, hauteur −0.425…−0.38) pour supprimer un défaut de reflet |

Le modèle est chargé **une fois** et instancié 3 fois ; normalisé (centré, hauteur = 1). Couvercle : ressort amorti `vel += ((cible − angle)·k − vel·c)·dt` avec cible −90°, k = 190 (ouverture) / 150, amortissement 11 / `2√150` (fermeture critique), angle borné ≤ 0. Drag : `rotate(dx / innerWidth · 16)` + vitesse résiduelle amortie `e^(−1.7·t)` ; auto‑rotation 0.3 rad/s × facteur de pose (1, 0.35, 0.08, 0.08, 0.08, 0.4), interrompue pendant le drag. Raycasting (`Raycaster`) pour le survol (curseur `pointer` / `grab`), la sélection et le bouchon (`hitSelected` teste un cylindre projeté).

### 7.4 Le nuage de points

- `Points` + `ShaderMaterial` (`transparent`, `depthWrite: false`, `blending: AdditiveBlending`), `frustumCulled = false`. Attributs par point : `position`, `aLum`, `aEdge`, `aNear`, `aSeed`, `aLogo` (3), `aLogoRim`, `aFrom` (3), `aFromLogo` (3) → **17 floats/point ≈ 28,9 Mo** pour 425 k points (côté JS, puis GPU) ; les géométries sont mises en cache par URL.
- Uniforms : `uTime`, `uProgress` (0 → 1 à 0.4/s : les points partent de `aFrom` — positions aléatoires ±3/±6, ou **positions du nuage précédent** lors d'un changement de parfum → morphing d'un décor à l'autre), `uPointScale` (= pixelRatio × 7.5 desktop / 6 mobile, ×1.3 tactile), `uWave` (`(t mod 5)·6.4` : une **onde lumineuse toutes les 5 s**), `uLogo`/`uLogoOffset`/`uLogoScale`/`uLogoSpin`/`uLogoWave`/`uLogoAlpha` (morph vers le pictogramme), `uColor` (couleur du parfum mélangée 60 % au glow puis **normalisée en luminance** jusqu'à ×2.6), `uTopColor` (#6B1FC7 violet par défaut, `#c8601a` pour Vanilla State), `uGain`, `uKeep` (les points très lumineux résistent au vignettage), `uMouse` (répulsion locale), `uAlpha`, `uResolution`, `uAspect`.
- Fragment : disque doux (`gl_PointCoord`), intensité = `0.025 + proche² · 0.35 + contour · 2.4 + lum^1.5 · 0.1 + lum³ · 1.6`, vignettage long aux bords (`smoothstep` 0–50 % en x, 0–55 % en bas, 0–18 % en haut), dégradé couleur **accent en bas → violet sombre en haut**, bas plus lumineux (×1.6). Mode pictogramme : points uniformes couleur du parfum, arêtes plus brillantes (`aLogoRim`).
- Pictogramme : PNG alpha rasterisé en canvas 256 px (1 024 px pour le logo script), seuil alpha, **45 % des points sur les contours**, 6 % éparpillés, 3 % très loin, jitter gaussien.
- Échelle du groupe ajustée au viewport pour couvrir l'écran ; z −2.6 (hero) → −4.1 (story) ; alpha 1 → 0.65.

### 7.5 Transitions d'interface (CSS)

```css
.panel { opacity: 0; visibility: hidden; transition: opacity .5s, visibility 0s linear .5s; }
.panel.is-active { opacity: 1; visibility: visible; transition-delay: .15s, 0s; }
.panel > * { transform: translateY(26px); transition: transform .8s cubic-bezier(.2,.8,.2,1); }  /* + delay 60 ms par enfant */
@property --accent { syntax: "<color>"; inherits: true; initial-value: #12b9ff; }
:root { transition: --accent .9s; }   /* la couleur d'accent fond d'un parfum à l'autre */
```

Le JS écrit `--accent` / `--accent-ui` (`color-mix(in srgb, accent 35%, glow)`) sur `<html>`, `--bg-o`, `--hero-o`, `--r` (ratios du carrousel), `--picto` (masque CSS des pictos), `--title-w` (ajuste la largeur des 3 notes sous le nom pour les aligner), `--ar` (ratio de la lightbox).

### 7.6 Anneau de cartes (page collectibles, CSS 3D)

`.cards3d { perspective: 1150px; perspective-origin: 50% 42% }`, `.cards-ring { transform-style: preserve-3d; aspect-ratio: 750/1120; width: var(--card-w) }` avec `--card-w: clamp(150px, 15vw, 220px)`. Chaque `figure.card3d` : `rotateY(i · 360/n) translateZ(var(--radius))`, `--radius = card-w · (0.5 / tan(π/n)) · 1.077`. L'anneau entier : `translateZ(−radius) rotateX(−5deg) rotateY(p)`. Drag : `p += dx · 0.32` (°), vitesse mémorisée puis inertie qui converge vers **−9 °/s** au repos (0 en reduced‑motion) ; luminosité par carte `0.3 + 0.7·cos(angle)^1.5` ; changement d'univers avec fondu 350 ms ; clic/Entrée → lightbox. Même composant réutilisé pour les cartes d'embarquement (`data-images`).

### 7.7 Logo du header

Scène three.js dédiée dans `canvas#logo-gl` : `logo.glb` (normales recalculées), `MeshStandardMaterial` #E6E6EC metalness 1 roughness 0.17 + shader qui augmente la rugosité aux angles rasants, env PMREM, caméra fov 5° (téléobjectif), **pixel ratio × 3** (sur‑échantillonnage, le canvas est petit), oscillation `ry = sin(0.9·t)·0.42`, `rx = sin(0.6·t)·0.06`. Repli : `<img m-white.png>` si WebGL échoue (seul repli explicite du site).

### 7.8 Accessibilité / reduced motion

`@media (prefers-reduced-motion: reduce) { * { transition-duration: 10ms !important; animation: none !important } }` ; Lenis non instancié ; logo et anneau immobiles ; **mais les boucles WebGL (flacons, nuage) continuent**. Rôles ARIA (`tablist`/`tab`, `radiogroup`/`radio`, `dialog`, `aria-expanded/-hidden/-busy`), navigation clavier (Espace sur les onglets, Échap ferme menu/panier), `.sr` (clip-path) pour les labels. Pas de repli visuel si WebGL est indisponible dans la scène principale (le HTML reste utilisable mais le hero est vide).

---

## 8. Design system (tokens relevés)

### 8.1 Couleurs

| Token | Valeur | Usage |
|---|---|---|
| fond | `#000` (`html`, `body`, `.univers`) | base noire partout |
| `--ink` | `#fff` | texte |
| `--dim` | `#ffffff8c` | eyebrows, nav inactive |
| `--line` | `#ffffff38` | filets, bordures des boutons ronds |
| `--accent` | Good Place `#12b9ff` (glow `#45cdff`) · Vanilla State `#8a3400` (glow `#ee7d1c`) · Perfect Trap `#c40808` (glow `#d81a0c`) · pages simples `#5f7186` | dégradé `#bg`, particules, liquide, pictos, états actifs |
| `--accent-ui` | `color-mix(in srgb, accent 35%, glow)` (ou `#fff`) | liens actifs, halos (`text-shadow 0 0 8px / 24px`) |
| haut du nuage | `#6b1fc7` (violet), `#c8601a` (Vanilla), `#3a3f5c` (coffrets) | dégradé vertical des particules |
| surfaces verre | `#000000d1` (menu), `#0a0a0ae6` (volet infos), `#0e0e108c` (panier), `#000c` (lightbox), `#00000040` (boutons ronds), `#ffffff0a` | + `backdrop-filter` |
| erreur | `#ff8a7a` | messages de formulaire |
| échelle d'alphas blancs | `0a 0d 0f 12 1a 29 38 40 4d 59 8c 9e b3 d9 db e6` | bordures, textes secondaires, halos |

### 8.2 Typographie

- `body` : Inter, **11 px / 500 / 1.7, `text-transform: uppercase`, `letter-spacing: .2em`** (toute l'UI est en capitales espacées) ; `.body` (paragraphes) : Inter 15 px (14 px mobile) / 400 / 1.65 / `.04em`, pas de capitales, couleur `#ffffffdb`.
- Titres `.script` : `--script` = Archivo Black (`--titre` = « MS Titre » = Jost 900 pour les grands titres), `line-height 1.05`, `letter-spacing 0` ou `-.005em` en capitales.
- Échelle fluide : `.hero-name` `clamp(44px, 6vw, 92px)` ; titres de panneaux/fiche `clamp(28px–44px, 3–6.4vw, 48–104px)` ; `.price` 22 px ; eyebrows/labels 9–13 px ; interlettrages `.08em .1em .12em .14em .16em .2em .24em`. Graisses utilisées : 400, 500, 600.
- Mobile : `.script` titres passent en uppercase + ajustement `--title-w` pour centrer les 3 notes.

### 8.3 Espacements, formes, composants

- `--pad: clamp(16px, 2.6vw, 40px)` (marge latérale) ; grilles `gap` 6–22 px ; `.panel` largeur `min(440px, 34vw)` à gauche (desktop), collé en bas (`bottom: 84px`) sur mobile ; `.sheet` `bottom: 70px` et `max-height: calc(100svh − 180px)` dépliée.
- Rayons : 2 / 6 / 7 / 10 / 14 px / 50 % (boutons ronds 52 px et 46/42 px). Bouton principal `.btn` : blanc sur noir, 40 px de haut, **halo `box-shadow: 0 0 24px #ffffff59`** (36 px au survol + `translateY(−1px)`).
- Verre dépoli : `backdrop-filter: blur(6px)` (boutons ronds), `14px` (lightbox), `18px` (menu), `22px` (volet infos), `26px saturate(1.2)` (panier).
- Effets : `mask-image` (fondu latéral du carrousel, pictos en masque CSS), `clip-path` (sr-only, lightbox), `text-shadow` halos, `filter: drop-shadow` colorée sur le picto sélectionné, `radial-gradient` teintés (`#bg`, blocs newsletter), `scroll-snap`, `overscroll-behavior: contain`, `100svh` (hero) / `100lvh` (canvas), `touch-action: pan-y`.
- Keyframes : `breathe` (opacité/échelle du hint), `hint` (flèche qui descend), `picto-spin` (rotation 360°), `scroll-next` (bouton « continuer » qui pulse).

### 8.4 Mouvements (easings / durées)

| Easing | Usage |
|---|---|
| `cubic-bezier(.2,.8,.2,1)` | entrée des enfants de panneau (.8 s) |
| `cubic-bezier(.22,1,.36,1)` | volet infos (.6 s), panier |
| `cubic-bezier(.65,0,.2,1)`, `cubic-bezier(.65,0,.35,1)` | transitions de lightbox / éléments |
| `ease-in-out` | keyframes |

Durées CSS : 120–180 ms (micro-états), 240–300 ms (hover, fondu de sortie), 350–450 ms (menu, swap, lightbox, scroll-next), 500–600 ms (panneaux, volet), 800–900 ms (enfants de panneau, `--accent`, loader), 1.1 s (visibilité du loader), 1.8–2.2 s (keyframes). Durées JS : swap parfum 420 ms, saut fiche 1.7 s, variante 280 ms de fondu + 1.9 s de démontage, coffret 1.7 s / porte 1.25 s / première ouverture 1.9 s, onde particules 5 s, assemblage nuage ≈ 2.5 s.

### 8.5 Breakpoints

CSS : `(width <= 1100px)` (footer), `(width <= 820px)` (layout mobile : panneaux en bas, switcher centré en bas, nav compacte), `(width <= 820px) and (height <= 780px)`, `(hover: none), (pointer: coarse)` (flèches masquées), `prefers-reduced-motion`. JS : `(max-width: 820px)`, `aspect < 0.85`, `(pointer: coarse)` (DPR 1.5, nuage light, transmission ½), `(pointer: fine)` + `navigator.connection.saveData` (préchargement de l'autre mode).

---

## 9. Ce que le site fait déjà pour la performance (et ce qu'il ne fait pas)

Fait : un seul bundle `defer`, polices préchargées + `swap`, `loading="lazy"` sur toutes les images secondaires, images produit redimensionnées par le CDN (`?width=`), nuages « light » et DPR 1.5 sur tactile, `transmissionResolutionScale 0.5`, rendu suspendu hors de la zone utile, préchargement en idle conditionné (`pointer: fine`, pas de `saveData`), cache des géométries, 1 seul GLB de flacon instancié, loader court en revisite, `speculationrules`.

Pas fait / risques : bundle de 772 Ko chargé aussi sur les pages texte et le panier ; 295 k triangles pour le flacon (×3) et ombres 2 048² sur les coffrets ; 29 Mo de buffers par nuage (plusieurs en cache) ; boucles rAF toujours planifiées ; pas de repli si WebGL échoue ; PNG de 1,4–2,4 Mo en lightbox ; contenu produit absent du HTML initial (H1 générique, prix/titres vides avant JS) ; `history.scrollRestoration = "manual"` + URL réécrite au scroll (à surveiller pour l'analytics et le SEO).

---

## 10. Plan de reconstruction (notre propre contenu, notre propre code)

### 10.1 Principes

1. **Shopify reste la source de vérité** (produits, variantes, prix, stock, metafields, panier, checkout) ; l'expérience 3D est une **couche de présentation** dans une section Liquid configurable.
2. **Rendre le contenu essentiel en Liquid** (H1, nom, prix, description, image de repli, bouton d'achat fonctionnel) puis **enrichir** en JS ; le canvas ne doit jamais être le seul moyen de comprendre ou d'acheter.
3. Reproduire la **mécanique** (sticky canvas + scroll normalisé + poses clés + lissage + particules + routeur de modes), pas les fichiers : modèles, textures, nuages, pictos, textes et photos sont à créer.

### 10.2 Arborescence de thème à créer (OS 2.0)

```
theme/
  layout/theme.liquid            # <head> (preload polices, @font-face via settings, CSS), header/nav, menu + panneaux, cart drawer, lightbox, config JSON, app.js defer
  templates/
    index.json                   # section boutique (mode "produits")
    product.json                 # section boutique (mode déduit du type/collection du produit, fiche ouverte)
    collection.json              # section boutique (mode "coffrets" ou "produits")
    page.json  page.faq.json  page.collectibles.json  cart.json  404.json
  sections/
    xx-boutique.liquid           # les 2 modes : hero, story (N panneaux = blocks), fiche, volet infos, carrousel univers ; schema : textes des panneaux, produits/collections à mettre en scène, couleur/glow/nuage par produit
    xx-texte.liquid  xx-collectibles.liquid  xx-panier.liquid
    header-group.json  footer.liquid  menu.liquid (FAQ/contact panes)
  snippets/
    config-json.liquid           # window.APP = { produits, routes, devise, assets manifeste }
    product-json.liquid          # un produit → {id, handle, url, titre, prix, dispo, variante, meta (metafields), photos}
    assets-manifest.liquid       # clés logiques → asset_url (models/, clouds/, img/)
    seo-jsonld.liquid  form-newsletter.liquid  form-alerte.liquid  form-contact.liquid  faq-pane.liquid
  assets/
    app.js (bundle : three + lenis + modules)  app.css
    models/*.glb  clouds/*.bin  img/deco/*  img/cards/*  img/picto-*.png  img/brushed.jpg  img/logo-*.png
  config/settings_schema.json    # polices (font_picker ×3), couleurs par univers, produits à mettre en scène, textes, options perf (DPR max, nuage light)
  locales/fr.default.json  en.json   # textes externalisés
```

Metafields produit à définir (namespace `fiche`) : `famille`, `accroche`, `description_longue`, `notes_tete/coeur/fond`, `contenu`, `concentration`, `cible`, `origine`, `notes_accueil`, `ingredients` (rich text), `couleur`, `glow`, `nuage` (fichier), `picto` (fichier). Metaobject `coffret` pour le contenu de boîte (cartes, badges, stickers).

### 10.3 Modules JS à écrire (bundle unique via esbuild/Vite, sortie IIFE, code‑split possible : `app-core.js` pour les pages simples, `app-scene.js` chargé seulement sur la boutique)

`router` (modes, pushState/popstate, synchro URL, titres) · `loader` (canvas 2D + progression agrégée) · `scene-products` (renderer, env PMREM, flacon instancié, poses, interactions) · `scene-kits` · `cloud` (loader .bin, shaders, morph, picto) · `ui-panels` (scroll → t, classes body, variables CSS) · `cart` (`/cart.js`, `/cart/add.js`, `/cart/change.js`, drawer + page) · `menu` (panes, URL) · `forms` (Shopify customer/contact + restauration d'état) · `gallery-lightbox` · `cards-ring` · `logo` · `a11y` (reduced motion, clavier, fallback WebGL).

### 10.4 Pipeline 3D et nuages

- Modéliser le produit avec des **pièces séparées et nommées** selon les mouvements voulus (ex. `cap`, `sleeve`, `base`, `glass`, `liquid`, `label`, `trigger`…), pivots placés à la modélisation (pas recalculés depuis la géométrie), UV propres pour l'étiquette. Export GLB → `gltf-transform` (`weld`, `quantize`, `meshopt`, `simplify`) ; viser **30–80 k triangles** pour le produit vedette (Moonshine en a 295 k), 1 seul GLB instancié.
- Matériaux et lumières en code (comme eux) : env PMREM « studio de plans », métal brossé par shader + texture de stries 1–2 K, verre `MeshPhysicalMaterial` (transmission uniquement si le produit est translucide ; sinon l'omettre : c'est le poste GPU le plus cher), bulles optionnelles.
- Nuages : script Node/Python **image + carte de profondeur (ex. depth estimation) + détection de contours → .bin (Uint32 + 8 o/point)**, deux densités (full/light), 200–450 k points max desktop, 100–200 k mobile.
- Pictos : PNG alpha 256² (rasterisés en particules) ; logo script PNG alpha ~1 500 px de large.

### 10.5 Points de vigilance perf mobile (à intégrer dès le départ)

1. **LCP / contenu** : nom, prix, image packshot et CTA rendus par Liquid avant le JS ; image de repli `<img>` dans le hero remplacée par le canvas une fois prêt ; `noscript`/erreur WebGL → le packshot reste.
2. **Budget réseau** : viser < 3 Mo au premier écran mobile (GLB ≤ 500 Ko, nuage light ≤ 1 Mo, bundle ≤ 300 Ko gz) ; différer le second mode à l'idle et seulement sur `pointer: fine` / sans `saveData` ; `fetchpriority` sur le GLB du hero.
3. **GPU** : DPR plafonné (1.5 tactile, 2 desktop) ; pas de transmission/clearcoat sur mobile ou résolution ½ ; ombres uniquement sur desktop (ou 1 024²) ; `frustumCulled` géré ; **arrêter les rAF** quand l'onglet est caché (`visibilitychange`), quand le canvas est hors écran (`IntersectionObserver`) et pendant les overlays.
4. **Mémoire** : 1 nuage en mémoire à la fois (disposer les géométries des autres univers), attributs en `Int16`/`Uint8` normalisés côté GPU plutôt que 17 floats/point, éviter les copies JS.
5. **Scroll** : `position: sticky` + canvas = OK, mais pas de `scroll` listener lourd : lire `scrollY` dans la rAF ; `touch-action: pan-y` sur le hero ; tester `100svh/100lvh` sur iOS (barre d'adresse) ; Lenis désactivé sur tactile si jank ; `overscroll-behavior` sur les overlays.
6. **Images** : vrais WebP/AVIF (pas de JPEG renommés), `srcset`/`sizes` via `image_url` Shopify, lightbox sur une taille ≤ 2 000 px, pas de PNG de 2 Mo.
7. **`backdrop-filter`** : limiter la surface floutée sur mobile (coût iOS), préférer des fonds semi‑opaques.
8. **Accessibilité / motion** : `prefers-reduced-motion` doit aussi figer les scènes WebGL (pose statique) ; focus visible ; tout achetable au clavier.
9. **SEO / analytics** : canonical et JSON-LD par produit (déjà bien chez eux), envoyer un `page_view` à chaque `pushState`, ne réécrire l'URL au scroll qu'après interaction, garder des liens `<a href>` réels.
10. **Recette** : iPhone Safari + Android Chrome réels, 4G simulée, WebGL désactivé, produit en rupture, retour arrière après transition, éditeur de thème (sections configurables sans casser la scène).

### 10.6 Ordre de travail conseillé

1. Un **prototype de scène** (1 produit, poses hero → fiche, mobile) hors Shopify, avec le vrai GLB optimisé. 2. La section Liquid + config JSON + panier (fiche fonctionnelle sans 3D). 3. Intégration scène + routeur de modes. 4. Nuages/pictos, second mode (coffrets), collectibles. 5. Recette perf/a11y, éditeur de thème, publication.

---

## 11. Checklist « transposition » (contenu propre, autre catégorie de produit)

Le même squelette narratif fonctionne pour n'importe quel produit à mécanique (flacon spray, bidon, outil…) : **Hero** (3 produits en anneau, sélection) → **Chapitres** (1 panneau par bénéfice, 1 mouvement 3D par panneau : ouverture, démontage, zoom sur la buse/gâchette, résultat) → **Fiche** (variantes, prix, photos, achat) → **Univers** (carrousel) → **Coffrets/kits** (boîte qui s'ouvre). À préparer : 3 produits avec couleur + glow, un GLB par forme de contenant (pièces nommées), 1 illustration + profondeur par univers pour le nuage, 1 picto par univers, 6–9 visuels d'ambiance par univers, textes des panneaux, metafields.

---

## 12. Confrontation avec l'audit GPT (PDF fourni)

**Confirmé par mes relevés** : three.js r186, Lenis 1.3.26 (`lerp 0.09`), glTF‑Transform 4.5.1, Meshopt + quantization, aucune texture/animation dans les GLB, format BIN (Uint32 + 3×Int16 + 2×Uint8, `taille = 4 + 8·N`, versions light sur `pointer: coarse`), 6 poses / story 500vh / caméra fixe, panier `/cart.js` `/cart/add.js` `/cart/change.js`, pushState/replaceState/popstate, thème « Bullet 6.1.0 », polices (Inter 400/500/600, Archivo Black, Jost 900 « MS Titre »), couleurs (#12B9FF/#45CDFF, #8A3400/#EE7D1C, #C40808/#D81A0C), seuils 1100/820/780, loader 5 200 points, toutes les durées (420 ms, 0.9 s, 1.9 s, 1.7 s, 1.25 s, 60 ms, −9 °/s), triangles (46 972 / 24 342 / 23 178 / 295 482), 17 composantes/point ≈ 28,9 Mo, absence de HDR/EffectComposer/Draco/KTX2, P0 « contenu rempli par JS ».

**Nuances** : (1) son inventaire de « 69 ressources / 25,9 Mo » ne couvre que le manifeste `MS2.assets` ; en ajoutant les 83 photos produit (10,5 Mo), les 7 PNG de la page collectibles (8,5 Mo), les polices et les scripts plateforme on arrive à **189 URLs / 48 Mo** (`ASSETS.csv`). (2) « History API / View Transitions » : exact pour les navigations complètes (`@view-transition { navigation: auto }`, 0.35 s), mais les transitions entre modes de la boutique sont des classes CSS pilotées par le routeur, sans `startViewTransition`. (3) Ses « Interface desktop … observés dans le navigateur » ne concernent pas le rendu WebGL (lui aussi indisponible) : comme ici, la chorégraphie est déduite du code.

**Ce que le PDF ne couvre pas et que ce rapport ajoute** : les tokens du design system (§ 8), la carte DOM / couches / classes d'état (§ 5), le partage Liquid ↔ JS et les 4 types de sections (`ms2-boutique`, `ms2-texte`, `ms2-collectibles`, `ms2-panier`) avec `MS2_PAGE` par template (§ 4), la structure complète de `window.MS2` et le manifeste d'assets, la synchronisation URL au scroll et dans le menu, le flux alerte‑stock/hCaptcha, le nommage des nœuds GLB et leur regroupement par le code, les paramètres chiffrés des poses et des matériaux (§ 6–7), l'origine probable des nuages (image + profondeur + contours), les **51 fichiers à extension trompeuse** et le poids réel des PNG collectibles, le carrousel d'ambiance, les détails de la scène coffrets (ombres 2 048², porte, étiquettes), le loader, les scripts plateforme Shopify.

---

## 13. Fichiers du dossier

- `REPORT.md` — ce rapport.
- `ASSETS.csv` — 189 lignes : `url, type, poids_octets, content_type, notes` (clé manifeste, format réel, dimensions, extension trompeuse).
- `data/glb_meta.json` — en‑têtes des 4 GLB (nœuds, meshes, triangles, matériaux, extensions). `data/bin_meta.json` — points/poids des 6 nuages. `data/img_dims.tsv` — dimensions/formats réels des images. `data/http_log.tsv` — codes HTTP, tailles, content‑types. `data/manifest_ms2_assets.tsv` — les 69 clés logiques → URL.
- Non versionnés (`.gitignore`) : `html/` (4 pages), `extra/` (pages complémentaires, sitemaps, `product.js`), `dl/` (161 assets, 37 Mo), fichiers de travail.

Méthode : `curl -sL -A <UA Chrome>` ; extraction des URLs par regex (`/cdn/shop/t/29/assets/`, `/cdn/shop/files/`, manifeste `window.MS2.assets`, `data-full`, `data-images`) ; téléchargement en parallèle (`xargs -P8`) ; `file`/`identify` pour les formats ; lecture des en‑têtes GLB (JSON du chunk 0) et BIN (`struct`) en Python ; grep des signatures (`__THREE__`, `lenisVersion`, `setMeshoptDecoder`, `cart/add`, `pushState`, `customElements`, `gsap`…) ; reformatage du bundle (découpe sur `;function`/`;let`) pour lire les modules.
