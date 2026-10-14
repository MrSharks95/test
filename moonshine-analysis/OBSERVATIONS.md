# Observations dans Chromium headless (rendu WebGL logiciel)

Captures réalisées avec Playwright + Chromium 1194 (headless), WebGL rendu par **SwiftShader** (CPU) : les images sont fidèles en composition, couleurs et états, mais **pas en fluidité** (≈ 2–10 s par image au lieu de 16 ms). Pour compenser, le plafond du pas de temps de la boucle de rendu du site a été relevé à la volée (0,05 s → 0,5 s) et chaque capture attend un nombre d'images rendues, pas une durée. Les durées JS (420 ms, 1,9 s…) restent celles du code ; seules les captures sont ralenties.


## Desktop 1280 × 800 (parcours complet)

Événements : `bundle-dt-cap-patched` {"replacements": 4} · `domcontentloaded` {"ms": 3375} · `webgl` {"gl": {"version": "WebGL 2.0 (OpenGL ES 3.0 Chromium)", "renderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)", "maxTex": 8192}} · `loaded` {"ok": true, "ms": 118, "sinceNav": 15288} · `frame_time_ms_swiftshader` {"ft": 3438}

### A00-loader.jpg — écran de chargement (logo M en particules canvas 2D + barre)

![écran de chargement (logo M en particules canvas 2D + barre)](screens/A00-loader.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(18, 185, 255) · classes body `is-loading` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A01-hero.jpg — hero après intro (3 flacons en anneau, nuage de points, nom + 3 notes)

![hero après intro (3 flacons en anneau, nuage de points, nom + 3 notes)](screens/A01-hero.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A01b-hero-pointeur.jpg — hero, pointeur en haut à gauche (parallaxe + répulsion du nuage)

![hero, pointeur en haut à gauche (parallaxe + répulsion du nuage)](screens/A01b-hero-pointeur.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t0_5.jpg — scroll t=0.5 (attente 15898 ms)

![scroll t=0.5 (attente 15898 ms)](screens/A02-t0_5.jpg)

URL `/` · mode `parfums` · scrollY 400 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.700 · `--hero-o` 0.000 · classes body `is-scrolled` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t1.jpg — scroll t=1 (attente 7943 ms)

![scroll t=1 (attente 7943 ms)](screens/A02-t1.jpg)

URL `/` · mode `parfums` · panneau actif `0` « Eau de parfum / Perfect Trap » · scrollY 800 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t1_5.jpg — scroll t=1.5 (attente 6657 ms)

![scroll t=1.5 (attente 6657 ms)](screens/A02-t1_5.jpg)

URL `/` · mode `parfums` · panneau actif `1` « La capsule / Capuchon aimanté » · scrollY 1200 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t2.jpg — scroll t=2 (attente 5610 ms)

![scroll t=2 (attente 5610 ms)](screens/A02-t2.jpg)

URL `/` · mode `parfums` · panneau actif `1` « La capsule / Capuchon aimanté » · scrollY 1600 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t2_5.jpg — scroll t=2.5 (attente 5563 ms)

![scroll t=2.5 (attente 5563 ms)](screens/A02-t2_5.jpg)

URL `/` · mode `parfums` · panneau actif `2` « La capsule / Parfum interchangeable » · scrollY 2000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t3.jpg — scroll t=3 (attente 4547 ms)

![scroll t=3 (attente 4547 ms)](screens/A02-t3.jpg)

URL `/` · mode `parfums` · panneau actif `2` « La capsule / Parfum interchangeable » · scrollY 2400 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t3_5.jpg — scroll t=3.5 (attente 4368 ms)

![scroll t=3.5 (attente 4368 ms)](screens/A02-t3_5.jpg)

URL `/` · mode `parfums` · panneau actif `3` « La capsule / Fermeture à vis » · scrollY 2800 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t4.jpg — scroll t=4 (attente 4417 ms)

![scroll t=4 (attente 4417 ms)](screens/A02-t4.jpg)

URL `/` · mode `parfums` · panneau actif `3` « La capsule / Fermeture à vis » · scrollY 3200 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t4_5.jpg — scroll t=4.5 (attente 4520 ms)

![scroll t=4.5 (attente 4520 ms)](screens/A02-t4_5.jpg)

URL `/` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 3600 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A02-t5.jpg — scroll t=5 (attente 6315 ms)

![scroll t=5 (attente 6315 ms)](screens/A02-t5.jpg)

URL `/` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A03-fiche-depliee.jpg — fiche dépliée (Lire la suite)

![fiche dépliée (Lire la suite)](screens/A03-fiche-depliee.jpg)

URL `/` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A04-variante-parfum.jpg — variante « Parfum 30 ml » : la capsule se démonte / disparaît, URL et prix changent

![variante « Parfum 30 ml » : la capsule se démonte / disparaît, URL et prix changent](screens/A04-variante-parfum.jpg)

URL `/products/recharge-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « ParfumPERFECT TRAP 30 ml » €49,00 · variante `parfum` · 7 photos · titre « Parfum PERFECT TRAP 30 ml - Moonshine »

### A04b-variante-capsule.jpg — retour variante capsule

![retour variante capsule](screens/A04b-variante-capsule.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Capsule + Parfum PERFECT TRAP 30 ml - Moonshine »

### A05-volet-infos.jpg — volet « Plus d'informations » (contenu de boîte, ingrédients, notice)

![volet « Plus d&#x27;informations » (contenu de boîte, ingrédients, notice)](screens/A05-volet-infos.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story info-open` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Capsule + Parfum PERFECT TRAP 30 ml - Moonshine »

### A05b-lightbox.jpg — lightbox photo produit

![lightbox photo produit](screens/A05b-lightbox.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story lightbox-open` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Capsule + Parfum PERFECT TRAP 30 ml - Moonshine »

### A06-univers.jpg — carrousel d'ambiance #univers (le canvas est passé derrière, rendu suspendu : past-story)

![carrousel d&#x27;ambiance #univers (le canvas est passé derrière, rendu suspendu : past-story)](screens/A06-univers.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4760 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled past-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Capsule + Parfum PERFECT TRAP 30 ml - Moonshine »

### A07-footer.jpg — pied de page

![pied de page](screens/A07-footer.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 5285 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled past-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Capsule + Parfum PERFECT TRAP 30 ml - Moonshine »

### A08-parfum-1.jpg — switcher : parfum 1 (changement de couleur d'accent + morphing du nuage)

![switcher : parfum 1 (changement de couleur d&#x27;accent + morphing du nuage)](screens/A08-parfum-1.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(18, 185, 255) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A08-parfum-2.jpg — switcher : parfum 2 (changement de couleur d'accent + morphing du nuage)

![switcher : parfum 2 (changement de couleur d&#x27;accent + morphing du nuage)](screens/A08-parfum-2.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(138, 52, 0) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Vanilla State » · fiche « Capsule + ParfumVANILLA STATE 30 ml » €89,00 · variante `capsule` · 11 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A08-parfum-3.jpg — switcher : parfum 3 (changement de couleur d'accent + morphing du nuage)

![switcher : parfum 3 (changement de couleur d&#x27;accent + morphing du nuage)](screens/A08-parfum-3.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A09-drag.jpg — après un drag horizontal sur le flacon (rotation + inertie)

![après un drag horizontal sur le flacon (rotation + inertie)](screens/A09-drag.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A09b-clic-bouchon.jpg — après clic sur la zone du bouchon (couvercle à ressort)

![après clic sur la zone du bouchon (couvercle à ressort)](screens/A09b-clic-bouchon.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A10-menu.jpg — menu plein écran (verre dépoli)

![menu plein écran (verre dépoli)](screens/A10-menu.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · classes body `menu-open` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A11-pane-faq.jpg — panneau FAQ du menu (URL réécrite en /pages/faq)

![panneau FAQ du menu (URL réécrite en /pages/faq)](screens/A11-pane-faq.jpg)

URL `/pages/faq` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · classes body `menu-open` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A11b-pane-contact.jpg — panneau Contact du menu (URL réécrite en /pages/nous-contacter)

![panneau Contact du menu (URL réécrite en /pages/nous-contacter)](screens/A11b-pane-contact.jpg)

URL `/pages/nous-contacter` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · classes body `menu-open` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A12-panier.jpg — drawer panier (vide)

![drawer panier (vide)](screens/A12-panier.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(196, 8, 8) · `--bg-o` 0.400 · `--hero-o` 1.000 · classes body `cart-open` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### A13-saut-fiche.jpg — après « Voir le produit » : saut animé vers la fiche, URL synchronisée

![après « Voir le produit » : saut animé vers la fiche, URL synchronisée](screens/A13-saut-fiche.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Capsule + Parfum PERFECT TRAP 30 ml - Moonshine »

### B00-transition-coffrets.jpg — transition vers le mode coffrets (is-leaving)

![transition vers le mode coffrets (is-leaving)](screens/B00-transition-coffrets.jpg)

URL `/collections/coffrets` · mode `coffrets` · scrollY 0 · `--accent` rgb(95, 113, 134) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Coffret Intégral (3 x 30 ml) + Capsule » €129,00 · variante `None` · 9 photos · titre « Nos coffrets de parfum - Moonshine »

### B01-coffrets-hero.jpg — coffrets : hero (l'écrin s'ouvre 1,9 s après l'arrivée)

![coffrets : hero (l&#x27;écrin s&#x27;ouvre 1,9 s après l&#x27;arrivée)](screens/B01-coffrets-hero.jpg)

URL `/collections/coffrets` · mode `coffrets` · scrollY 0 · `--accent` rgb(95, 113, 134) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Coffret Intégral (3 x 30 ml) + Capsule » €129,00 · variante `None` · 9 photos · titre « Nos coffrets de parfum - Moonshine »

### B01b-coffrets-hero-ouvert.jpg — coffrets : écrin ouvert

![coffrets : écrin ouvert](screens/B01b-coffrets-hero-ouvert.jpg)

URL `/collections/coffrets` · mode `coffrets` · scrollY 0 · `--accent` rgb(95, 113, 134) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Coffret Intégral (3 x 30 ml) + Capsule » €129,00 · variante `None` · 9 photos · titre « Nos coffrets de parfum - Moonshine »

### B02-coffret-suivant.jpg — coffrets : coffret suivant (translation 1,7 s)

![coffrets : coffret suivant (translation 1,7 s)](screens/B02-coffret-suivant.jpg)

URL `/collections/coffrets` · mode `coffrets` · scrollY 0 · `--accent` rgb(95, 113, 134) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Perfect Trap » · fiche « Coffret Découverte (3 x 2 ml) + Porte-clés » €39,00 · variante `None` · 7 photos · titre « Nos coffrets de parfum - Moonshine »

### B03-coffret-fiche.jpg — coffrets : fiche produit

![coffrets : fiche produit](screens/B03-coffret-fiche.jpg)

URL `/products/coffret-decouverte` · mode `coffrets` · panneau actif `0` « Coffret / Coffret Découverte (3 x 2 ml) + Porte-clés » · scrollY 800 · `--accent` rgb(95, 113, 134) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Coffret Découverte (3 x 2 ml) + Porte-clés » €39,00 · variante `None` · 7 photos · titre « Coffret Découverte (3 x 2 ml) + Porte-clés - Moonshine »

### B04-retour-arriere.jpg — après retour navigateur (popstate)

![après retour navigateur (popstate)](screens/B04-retour-arriere.jpg)

URL `/products/coffret-perfect-trap-30-ml` · mode `parfums` · panneau actif `4` « Boisé épicé / Capsule + ParfumPERFECT TRAP 30 ml » · scrollY 4000 · `--accent` rgb(196, 8, 8) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Perfect Trap » · fiche « Capsule + ParfumPERFECT TRAP 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

Console (erreurs/avertissements) : `warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` · `warning: THREE.Material: parameter 'map' has value of undefined.` · `warning: THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`

Réseau observé (459 requêtes abouties, 15 échouées — les échecs sont des balises analytics/monorail annulées) :

| Type | Requêtes | Transféré (compressé) |
|---|---|---|
| fetch | 31 | 14.15 Mo |
| image | 191 | 2.33 Mo |
| script | 36 | 1.16 Mo |
| other | 171 | 957 Ko |
| font | 5 | 155 Ko |
| document | 4 | 35 Ko |
| stylesheet | 2 | 13 Ko |
| ping | 19 | 12 Ko |
| **total** | 459 | **18.79 Mo** |

Les 25 plus lourdes (taille réellement transférée, encodage) :

| Ressource | Type | Transféré | Encodage | Fin (ms après navigation) |
|---|---|---|---|---|
| `/cdn/shop/t/29/assets/ms2-nuage-perfect-trap.bin` | fetch | 3.54 Mo | — | 305 |
| `/cdn/shop/t/29/assets/ms2-nuage-good-place.bin` | fetch | 3.25 Mo | — | 294 |
| `/cdn/shop/t/29/assets/ms2-nuage-vanilla-state.bin` | fetch | 2.87 Mo | — | 267 |
| `/cdn/shop/t/29/assets/ms2-boite.glb` | fetch | 2.12 Mo | br | 245 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 775 Ko | br | 408 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 775 Ko | br | 313 |
| `/cdn/shop/t/29/assets/ms2-app.js` | script | 754 Ko | br | 959 |
| `/cdn/shop/t/29/assets/ms2-logo.glb` | fetch | 669 Ko | br | 1661 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 238 Ko | — | 172 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 237 Ko | — | 75 |
| `/cdn/shop/t/29/assets/ms2-boite2.glb` | fetch | 202 Ko | br | 313 |
| `/cdn/shopifycloud/checkout-web/assets/c1/164ad2e3.DdMk9LNW.js` | other | 183 Ko | br | 145 |
| `https://www.googletagmanager.com/gtag/js` | script | 154 Ko | zstd | 766 |
| `/cdn/shopifycloud/checkout-web/assets/c1/6a2fc6d6.G4RRoQ8b.js` | other | 90 Ko | br | 231 |
| `/cdn/shopifycloud/checkout-web/assets/c1/4b4bc88f.DTFWGZY2.js` | other | 84 Ko | br | 132 |
| `/cdn/wpm/bb5acf91awd18c8882p8c792781mb6692debm.js` | script | 82 Ko | br | 130 |
| `/cdn/shop/t/29/assets/ms2-logo-boite.png` | image | 63 Ko | — | 123 |
| `/cdn/shop/t/29/assets/ms2-deco-perfect-trap-2.webp` | image | 54 Ko | — | 138 |
| `/cdn/shop/t/29/assets/ms2-deco-perfect-trap-2.webp` | image | 54 Ko | — | 123 |
| `/cdn/shopifycloud/checkout-web/assets/c1/f8706cb6.Cz4EARWX.js` | other | 46 Ko | br | 100 |
| `/cdn/shop/files/goodplace_box_P_PerfectTrap_3ecd0b2a-ab48-4efc-b101-74a2fc9c5c6d.jpg` | image | 45 Ko | — | 67 |
| `/cdn/shopifycloud/checkout-web/assets/c1/2c1ab0fe.DloHZ3Y1.js` | other | 41 Ko | br | 124 |
| `/cdn/fonts/inter/inter_n5.d7101d5e168594dd06f56f290dd759fba5431d97.woff2` | font | 39 Ko | — | 165 |
| `/cdn/fonts/inter/inter_n6.771af0474a71b3797eb38f3487d6fb79d43b6877.woff2` | font | 39 Ko | — | 1621 |
| `/cdn/fonts/inter/inter_n4.b2a3f24c19b4de56e8871f609e73ca7f6d2e2bb9.woff2` | font | 39 Ko | — | 96 |

Ordre de chargement des 40 premières ressources significatives (ms depuis la navigation) :

| Début | Fin | Ressource | Transféré |
|---|---|---|---|
| 1791979181021 | 500 | `/` | 32 Ko |
| 1791979181536 | 71 | `/cdn/shopifycloud/storefront/assets/storefront/storefronts.moderate.specrules-eb468f32.jso` | 1 Ko |
| 1791979181536 | 98 | `/cdn/shop/t/29/assets/ms2-app.css` | 11 Ko |
| 1791979181537 | 83 | `/cdn/shopifycloud/portable-wallets/latest/accelerated-checkout-backwards-compat.css` | 2 Ko |
| 1791979181538 | 96 | `/cdn/fonts/inter/inter_n4.b2a3f24c19b4de56e8871f609e73ca7f6d2e2bb9.woff2` | 39 Ko |
| 1791979181538 | 94 | `/cdn/fonts/archivo_black/archivoblack_n4.b08d53f45e5ceb17a38677219b15fcdd9c5f3519.woff2` | 25 Ko |
| 1791979181540 | 78 | `/cdn/fonts/jost/jost_n9.cd269fa9adcae864ab1df15826ceb2fd310a3d4a.woff2` | 13 Ko |
| 1791979181540 | 394 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/loader.init-shop-cart-sync.fr.esm.js` | 1 Ko |
| 1791979181540 | 394 | `cdn.shopify.com/storefront/standard-actions.js` | 5 Ko |
| 1791979181648 | 959 | `/cdn/shop/t/29/assets/ms2-app.js` | 754 Ko |
| 1791979181653 | 202 | `/checkouts/internal/preloads.js` | 3 Ko |
| 1791979181662 | 395 | `cdn.shopify.com/shopifycloud/storefront/assets/storefront/origin_trials-318ab40a.js` | 1 Ko |
| 1791979181662 | 426 | `https://shop.app/checkouts/internal/preloads.js` | 0 Ko |
| 1791979181663 | 262 | `/cdn/shopifycloud/storefront/assets/storefront/load_feature-1bd60354.js` | 4 Ko |
| 1791979181664 | 198 | `/cdn/shopifycloud/storefront/assets/shopify_pay/storefront-f0e26bdf.js` | 20 Ko |
| 1791979181664 | 137 | `/cdn/shopifycloud/storefront/assets/storefront/autosizes-84416378.js` | 2 Ko |
| 1791979181664 | 261 | `/cdn/shopifycloud/perf-kit/shopify-perf-kit-3.10.2.min.js` | 27 Ko |
| 1791979181664 | 290 | `/cdn/shopifycloud/privacy-banner/storefront-banner.js` | 27 Ko |
| 1791979181665 | 130 | `/cdn/wpm/bb5acf91awd18c8882p8c792781mb6692debm.js` | 82 Ko |
| 1791979181665 | 136 | `/cdn/shopifycloud/storefront/assets/shop_events_listener-4e26a9ce.js` | 4 Ko |
| 1791979181665 | 171 | `/cdn/s/trekkie.storefront.32ff6085714fe9c4d5859e332c5de5f8759a859e.min.js` | 35 Ko |
| 1791979181710 | 165 | `/cdn/fonts/inter/inter_n5.d7101d5e168594dd06f56f290dd759fba5431d97.woff2` | 39 Ko |
| 1791979181879 | 3097 | `/web-pixels@b5acf91awd18c8882p8c792781mb6692deb/web-pixel-shopify-app-pixel@0530/sandbox/w` | 1 Ko |
| 1791979181929 | 1114 | `https://otlp-http-production.shopifysvc.com/v1/metrics` | 0 Ko |
| 1791979181930 | 117 | `/web-pixels@b5acf91awd18c8882p8c792781mb6692deb/custom/web-pixel-shopify-custom-pixel@0530` | 1 Ko |
| 1791979181930 | 125 | `/web-pixels@b5acf91awd18c8882p8c792781mb6692deb/app/web-pixel-4626514303@a3321ca85cf5aaf6b` | 6 Ko |
| 1791979182088 | 980 | `/cdn/wpm/sb5acf91awd18c8882p8c792781mb6692debm.js` | 27 Ko |
| 1791979182581 | 888 | `https://shop.app/pay/session` | 3 Ko |
| 1791979184304 | 1972 | `/cart.js` | 1 Ko |
| 1791979184306 | 1661 | `/cdn/shop/t/29/assets/ms2-logo.glb` | 669 Ko |
| 1791979184311 | 1631 | `/cdn/shop/t/29/assets/ms2-picto-perfect-trap.png` | 7 Ko |
| 1791979184311 | 1634 | `/cdn/shop/t/29/assets/ms2-picto-vanilla-state.png` | 3 Ko |
| 1791979184311 | 1856 | `/cdn/shop/t/29/assets/ms2-picto-good-place.png` | 4 Ko |
| 1791979184312 | 168 | `/cdn/shop/t/29/assets/ms2-m-white.png` | 14 Ko |
| 1791979184312 | 1621 | `/cdn/fonts/inter/inter_n6.771af0474a71b3797eb38f3487d6fb79d43b6877.woff2` | 39 Ko |
| 1791979184312 | 408 | `/cdn/shop/t/29/assets/ms2-moonshine.glb` | 775 Ko |
| 1791979184360 | 409 | `/cdn/shop/files/PT.jpg` | 7 Ko |
| 1791979184361 | 283 | `/cdn/shop/files/goodplace_UP_Qfocuscapsule_RED_29ca1707-5e5d-45c4-87d1-f000bb20a5a5.jpg` | 7 Ko |
| 1791979184361 | 285 | `/cdn/shop/files/goodplace_up_box_O_P_PerfectTrap_bd3a7111-d85d-460c-95e2-9ec371c86e34.jpg` | 8 Ko |
| 1791979184361 | 285 | `/cdn/shop/files/PerfectTrap_RefillFocus_focusup_462d2672-d125-48ba-8dbd-52a9ff50b936.jpg` | 7 Ko |

Navigation (Performance API) : TTFB 365 ms · DOMContentLoaded 3331 ms · load 12998 ms · HTML transféré 30 Ko (décodé 123 Ko).


## Pages secondaires et arrivées directes

Événements : `bundle-dt-cap-patched` {"replacements": 4} · `bundle-dt-cap-patched` {"replacements": 4} · `bundle-dt-cap-patched` {"replacements": 4} · `loaded-coffrets-direct` {"ok": true, "ms": 15520} · `bundle-dt-cap-patched` {"replacements": 4} · `loaded-recharge-direct` {"ok": true, "ms": 9648}

### C01-collectible.jpg — page collectibles : anneau de cartes CSS 3D

![page collectibles : anneau de cartes CSS 3D](screens/C01-collectible.jpg)

URL `/pages/collectible` · scrollY 0 · `--accent` rgb(95, 113, 134) · classes body `simple-page` · titre « Les collectibles - Moonshine »

### C01b-collectible-suite.jpg — page collectibles : badges / billets

![page collectibles : badges / billets](screens/C01b-collectible-suite.jpg)

URL `/pages/collectible` · scrollY 900 · `--accent` rgb(95, 113, 134) · classes body `simple-page is-scrolled` · titre « Les collectibles - Moonshine »

### C02-faq.jpg — page FAQ (template ms2-texte)

![page FAQ (template ms2-texte)](screens/C02-faq.jpg)

URL `/pages/faq` · scrollY 0 · `--accent` rgb(95, 113, 134) · classes body `simple-page` · titre « Questions fréquentes - Moonshine »

### C03-coffrets-direct.jpg — arrivée directe sur /collections/coffrets

![arrivée directe sur /collections/coffrets](screens/C03-coffrets-direct.jpg)

URL `/collections/coffrets` · mode `coffrets` · scrollY 0 · `--accent` rgb(95, 113, 134) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Good Place » · fiche « Coffret Intégral (3 x 30 ml) + Capsule » €129,00 · variante `None` · 9 photos · titre « Nos coffrets de parfum - Moonshine »

### C04-fiche-recharge-directe.jpg — arrivée directe sur une fiche recharge (fiche ouverte, variante parfum)

![arrivée directe sur une fiche recharge (fiche ouverte, variante parfum)](screens/C04-fiche-recharge-directe.jpg)

URL `/products/recharge-good-place-30-ml` · mode `parfums` · panneau actif `4` « Musc floral / ParfumGOOD PLACE 30 ml » · scrollY 4000 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-rapide is-scrolled in-story` · parfum sélectionné « Good Place » · fiche « ParfumGOOD PLACE 30 ml » €49,00 · variante `parfum` · 7 photos · titre « Parfum GOOD PLACE 30 ml - Moonshine »

Console (erreurs/avertissements) : `warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` · `warning: THREE.Material: parameter 'map' has value of undefined.` · `warning: THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`

Réseau observé (411 requêtes abouties, 42 échouées — les échecs sont des balises analytics/monorail annulées) :

| Type | Requêtes | Transféré (compressé) |
|---|---|---|
| fetch | 50 | 16.78 Mo |
| script | 144 | 4.65 Mo |
| image | 95 | 2.71 Mo |
| font | 19 | 582 Ko |
| other | 48 | 576 Ko |
| document | 10 | 130 Ko |
| stylesheet | 8 | 51 Ko |
| ping | 37 | 23 Ko |
| **total** | 411 | **25.47 Mo** |

Les 25 plus lourdes (taille réellement transférée, encodage) :

| Ressource | Type | Transféré | Encodage | Fin (ms après navigation) |
|---|---|---|---|---|
| `/cdn/shop/t/29/assets/ms2-nuage-good-place.bin` | fetch | 3.25 Mo | — | 158 |
| `/cdn/shop/t/29/assets/ms2-nuage-good-place.bin` | fetch | 3.25 Mo | — | 134 |
| `/cdn/shop/t/29/assets/ms2-boite.glb` | fetch | 2.12 Mo | br | 578 |
| `/cdn/shop/t/29/assets/ms2-boite.glb` | fetch | 2.12 Mo | br | 289 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 775 Ko | br | 344 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 775 Ko | br | 224 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 774 Ko | br | 413 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 774 Ko | br | 217 |
| `/cdn/shop/t/29/assets/ms2-app.js` | script | 754 Ko | br | 814 |
| `/cdn/shop/t/29/assets/ms2-app.js` | script | 754 Ko | br | 964 |
| `/cdn/shop/t/29/assets/ms2-app.js` | script | 754 Ko | br | 641 |
| `/cdn/shop/t/29/assets/ms2-app.js` | script | 754 Ko | br | 905 |
| `/cdn/shop/t/29/assets/ms2-logo.glb` | fetch | 669 Ko | br | 1791 |
| `/cdn/shop/t/29/assets/ms2-logo.glb` | fetch | 669 Ko | br | 215 |
| `/cdn/shop/t/29/assets/ms2-logo.glb` | fetch | 669 Ko | br | 145 |
| `/cdn/shop/t/29/assets/ms2-logo.glb` | fetch | 669 Ko | br | 1584 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 237 Ko | — | 66 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 237 Ko | — | 87 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 237 Ko | — | 107 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 237 Ko | — | 104 |
| `/cdn/shop/t/29/assets/ms2-boite2.glb` | fetch | 202 Ko | br | 136 |
| `/cdn/shop/t/29/assets/ms2-boite2.glb` | fetch | 202 Ko | br | 234 |
| `/cdn/shopifycloud/checkout-web/assets/c1/164ad2e3.DdMk9LNW.js` | other | 183 Ko | br | 105 |
| `/cdn/shop/t/29/assets/ms2-deco-good-place-4.webp` | image | 159 Ko | — | 134 |
| `https://www.googletagmanager.com/gtag/js` | script | 154 Ko | zstd | 595 |

Ordre de chargement des 40 premières ressources significatives (ms depuis la navigation) :

| Début | Fin | Ressource | Transféré |
|---|---|---|---|
| 1791978494829 | 1005 | `/pages/collectible` | 30 Ko |
| 1791978495549 | 105 | `/cdn/shopifycloud/storefront/assets/storefront/storefronts.moderate.specrules-eb468f32.jso` | 1 Ko |
| 1791978495551 | 111 | `/cdn/fonts/inter/inter_n4.b2a3f24c19b4de56e8871f609e73ca7f6d2e2bb9.woff2` | 38 Ko |
| 1791978495553 | 92 | `/cdn/fonts/archivo_black/archivoblack_n4.b08d53f45e5ceb17a38677219b15fcdd9c5f3519.woff2` | 26 Ko |
| 1791978495553 | 97 | `/cdn/fonts/jost/jost_n9.cd269fa9adcae864ab1df15826ceb2fd310a3d4a.woff2` | 12 Ko |
| 1791978495553 | 109 | `/cdn/shop/t/29/assets/ms2-app.css` | 11 Ko |
| 1791978495860 | 114 | `/checkouts/internal/preloads.js` | 4 Ko |
| 1791978495860 | 206 | `https://shop.app/checkouts/internal/preloads.js` | 0 Ko |
| 1791978495864 | 69 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/loader.init-shop-cart-sync.fr.esm.js` | 1 Ko |
| 1791978495864 | 38 | `cdn.shopify.com/storefront/standard-actions.js` | 5 Ko |
| 1791978495867 | 92 | `/cdn/shopifycloud/portable-wallets/latest/accelerated-checkout-backwards-compat.css` | 2 Ko |
| 1791978495927 | 67 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.document_DMcRsBXN.esm.js` | 1 Ko |
| 1791978495927 | 74 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.init_Dv7J5vjh.esm.js` | 1 Ko |
| 1791978495927 | 99 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/client.init-shop-cart-sync_BV3vxy_u.fr.esm` | 1 Ko |
| 1791978495928 | 86 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.register_Cxs_K5wz.esm.js` | 14 Ko |
| 1791978495930 | 68 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.tslib-es6_CHHZATl5.esm.js` | 1 Ko |
| 1791978495931 | 88 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.networkErrorMessages_DIkDbO6W.esm.js` | 1 Ko |
| 1791978495933 | 75 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.defineInitFunction_CIjOjzsO.esm.js` | 1 Ko |
| 1791978495933 | 102 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/client.shop-cart-sync_Cdio0l8R.fr.esm.js` | 3 Ko |
| 1791978495934 | 75 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.window_CAbVMZox.esm.js` | 1 Ko |
| 1791978495935 | 84 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.casing_U_9x-Om3.esm.js` | 5 Ko |
| 1791978495937 | 68 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.utils_CY1J4tRu.esm.js` | 3 Ko |
| 1791978495938 | 90 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.v4_D2VNBPfk.esm.js` | 1 Ko |
| 1791978495944 | 91 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.useUserRecognitionSignal_Dwelwsuo.es` | 1 Ko |
| 1791978495945 | 82 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.storage_DQF5v-OM.esm.js` | 1 Ko |
| 1791978495945 | 87 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.authorize_DINGMyE5.esm.js` | 1 Ko |
| 1791978495945 | 96 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.hooks_CPbkKXUY.esm.js` | 1 Ko |
| 1791978495952 | 93 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.useEventListener_DTq8AI6V.esm.js` | 1 Ko |
| 1791978495953 | 100 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.validators_09U1U9sZ.esm.js` | 1 Ko |
| 1791978495971 | 814 | `/cdn/shop/t/29/assets/ms2-app.js` | 754 Ko |
| 1791978495973 | 235 | `cdn.shopify.com/shopifycloud/storefront/assets/storefront/origin_trials-318ab40a.js` | 1 Ko |
| 1791978495980 | 275 | `/cdn/shopifycloud/storefront/assets/storefront/load_feature-1bd60354.js` | 4 Ko |
| 1791978495981 | 285 | `/cdn/shopifycloud/storefront/assets/storefront/autosizes-84416378.js` | 2 Ko |
| 1791978495982 | 278 | `/cdn/shopifycloud/storefront/assets/shopify_pay/storefront-f0e26bdf.js` | 20 Ko |
| 1791978495983 | 279 | `/cdn/shopifycloud/privacy-banner/storefront-banner.js` | 27 Ko |
| 1791978495988 | 278 | `/cdn/shopifycloud/perf-kit/shopify-perf-kit-3.10.2.min.js` | 27 Ko |
| 1791978496026 | 210 | `/cdn/shopifycloud/storefront/assets/shop_events_listener-4e26a9ce.js` | 4 Ko |
| 1791978496026 | 209 | `/cdn/s/trekkie.storefront.32ff6085714fe9c4d5859e332c5de5f8759a859e.min.js` | 35 Ko |
| 1791978496026 | 217 | `/cdn/wpm/bb5acf91awd18c8882p8c792781mb6692debm.js` | 82 Ko |
| 1791978496066 | 189 | `/cdn/fonts/inter/inter_n5.d7101d5e168594dd06f56f290dd759fba5431d97.woff2` | 39 Ko |


## Mobile 390 × 844 (iPhone, pointer: coarse)

Événements : `bundle-dt-cap-patched` {"replacements": 4} · `loaded` {"ok": true, "ms": 6785, "sinceNav": 9015} · `frame_time_ms_swiftshader` {"ft": 932} · `media` {"mq": {"coarse": true, "w820": true, "dpr": 2}}

### M01-hero.jpg — mobile : hero

![mobile : hero](screens/M01-hero.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(18, 185, 255) · `--bg-o` 0.400 · `--hero-o` 1.000 · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M02-t1.jpg — mobile : scroll t=1

![mobile : scroll t=1](screens/M02-t1.jpg)

URL `/` · mode `parfums` · panneau actif `0` « Eau de parfum / Good Place » · scrollY 844 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M02-t2.jpg — mobile : scroll t=2

![mobile : scroll t=2](screens/M02-t2.jpg)

URL `/` · mode `parfums` · panneau actif `1` « La capsule / Capuchon aimanté » · scrollY 1688 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M02-t3.jpg — mobile : scroll t=3

![mobile : scroll t=3](screens/M02-t3.jpg)

URL `/` · mode `parfums` · panneau actif `2` « La capsule / Parfum interchangeable » · scrollY 2532 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M02-t4.jpg — mobile : scroll t=4

![mobile : scroll t=4](screens/M02-t4.jpg)

URL `/` · mode `parfums` · panneau actif `3` « La capsule / Fermeture à vis » · scrollY 3376 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled can-continue in-story` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M02-t5.jpg — mobile : scroll t=5

![mobile : scroll t=5](screens/M02-t5.jpg)

URL `/` · mode `parfums` · panneau actif `4` « Musc floral / Capsule + ParfumGOOD PLACE 30 ml » · scrollY 4220 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M03-fiche-depliee.jpg — mobile : fiche dépliée

![mobile : fiche dépliée](screens/M03-fiche-depliee.jpg)

URL `/` · mode `parfums` · panneau actif `4` « Musc floral / Capsule + ParfumGOOD PLACE 30 ml » · scrollY 4220 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M04-infos.jpg — mobile : volet infos

![mobile : volet infos](screens/M04-infos.jpg)

URL `/` · mode `parfums` · panneau actif `4` « Musc floral / Capsule + ParfumGOOD PLACE 30 ml » · scrollY 4220 · `--accent` rgb(18, 185, 255) · `--bg-o` 1.000 · `--hero-o` 0.000 · classes body `is-scrolled in-story info-open` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

### M05-menu.jpg — mobile : menu

![mobile : menu](screens/M05-menu.jpg)

URL `/` · mode `parfums` · scrollY 0 · `--accent` rgb(18, 185, 255) · `--bg-o` 0.400 · `--hero-o` 1.000 · classes body `menu-open` · parfum sélectionné « Good Place » · fiche « Capsule + ParfumGOOD PLACE 30 ml » €89,00 · variante `capsule` · 12 photos · titre « Moonshine - Eaux de parfum | Agence de voyages olfactifs »

Console (erreurs/avertissements) : `warning: THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` · `warning: THREE.Material: parameter 'map' has value of undefined.`

Réseau observé (155 requêtes abouties, 15 échouées — les échecs sont des balises analytics/monorail annulées) :

| Type | Requêtes | Transféré (compressé) |
|---|---|---|
| fetch | 10 | 3.04 Mo |
| image | 51 | 1.62 Mo |
| script | 36 | 1.16 Mo |
| other | 41 | 637 Ko |
| font | 5 | 155 Ko |
| document | 2 | 33 Ko |
| stylesheet | 2 | 13 Ko |
| ping | 8 | 4 Ko |
| **total** | 155 | **6.64 Mo** |

Les 25 plus lourdes (taille réellement transférée, encodage) :

| Ressource | Type | Transféré | Encodage | Fin (ms après navigation) |
|---|---|---|---|---|
| `/cdn/shop/t/29/assets/ms2-nuage-good-place-light.bin` | fetch | 1.63 Mo | — | 112 |
| `/cdn/shop/t/29/assets/ms2-deco-good-place-1.webp` | image | 817 Ko | — | 139 |
| `/cdn/shop/t/29/assets/ms2-moonshine.glb` | fetch | 775 Ko | br | 239 |
| `/cdn/shop/t/29/assets/ms2-app.js` | script | 754 Ko | br | 785 |
| `/cdn/shop/t/29/assets/ms2-logo.glb` | fetch | 670 Ko | br | 930 |
| `/cdn/shop/t/29/assets/ms2-brushed.jpg` | image | 237 Ko | — | 97 |
| `/cdn/shopifycloud/checkout-web/assets/c1/164ad2e3.DdMk9LNW.js` | other | 183 Ko | br | 100 |
| `https://www.googletagmanager.com/gtag/js` | script | 154 Ko | zstd | 541 |
| `/cdn/shopifycloud/checkout-web/assets/c1/6a2fc6d6.G4RRoQ8b.js` | other | 90 Ko | br | 89 |
| `/cdn/shopifycloud/checkout-web/assets/c1/4b4bc88f.DTFWGZY2.js` | other | 85 Ko | br | 94 |
| `/cdn/wpm/bb5acf91awd18c8882p8c792781mb6692debm.js` | script | 82 Ko | br | 128 |
| `/cdn/shop/t/29/assets/ms2-deco-good-place-2.webp` | image | 66 Ko | — | 102 |
| `/cdn/shopifycloud/checkout-web/assets/c1/f8706cb6.Cz4EARWX.js` | other | 46 Ko | br | 110 |
| `/cdn/shop/files/goodplace_box_P_Perfectplace_7daafb17-3a6e-469d-8636-34d8339ab2ad.jpg` | image | 43 Ko | — | 192 |
| `/cdn/shopifycloud/checkout-web/assets/c1/2c1ab0fe.DloHZ3Y1.js` | other | 41 Ko | br | 84 |
| `/cdn/fonts/inter/inter_n5.d7101d5e168594dd06f56f290dd759fba5431d97.woff2` | font | 39 Ko | — | 96 |
| `/cdn/fonts/inter/inter_n6.771af0474a71b3797eb38f3487d6fb79d43b6877.woff2` | font | 39 Ko | — | 861 |
| `/cdn/fonts/inter/inter_n4.b2a3f24c19b4de56e8871f609e73ca7f6d2e2bb9.woff2` | font | 39 Ko | — | 84 |
| `/cdn/shop/files/Card_O2.jpg` | image | 37 Ko | — | 128 |
| `/cdn/s/trekkie.storefront.32ff6085714fe9c4d5859e332c5de5f8759a859e.min.js` | script | 35 Ko | br | 91 |
| `/cdn/shop/files/GOODPLACE_KITSAMPL_GROUPAGE_281ef281-a7e9-4b48-9ff4-b73fa3f7860d.jpg` | image | 35 Ko | — | 321 |
| `/cdn/shop/t/29/assets/ms-h-co_stickers.jpg` | image | 34 Ko | — | 126 |
| `/cdn/shopifycloud/checkout-web/assets/c1/ecbc70a8.CvSNpSl9.js` | other | 33 Ko | br | 158 |
| `/cdn/shop/t/29/assets/ms-h-co_badge_gp.jpg` | image | 33 Ko | — | 140 |
| `/` | document | 31 Ko | br | 571 |

Ordre de chargement des 40 premières ressources significatives (ms depuis la navigation) :

| Début | Fin | Ressource | Transféré |
|---|---|---|---|
| 1791979105951 | 571 | `/` | 31 Ko |
| 1791979106478 | 84 | `/cdn/fonts/inter/inter_n4.b2a3f24c19b4de56e8871f609e73ca7f6d2e2bb9.woff2` | 39 Ko |
| 1791979106479 | 86 | `/cdn/fonts/archivo_black/archivoblack_n4.b08d53f45e5ceb17a38677219b15fcdd9c5f3519.woff2` | 25 Ko |
| 1791979106479 | 98 | `/cdn/shop/t/29/assets/ms2-app.css` | 11 Ko |
| 1791979106479 | 97 | `/cdn/fonts/jost/jost_n9.cd269fa9adcae864ab1df15826ceb2fd310a3d4a.woff2` | 12 Ko |
| 1791979106512 | 199 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/loader.init-shop-cart-sync.fr.esm.js` | 1 Ko |
| 1791979106513 | 67 | `/cdn/shopifycloud/portable-wallets/latest/accelerated-checkout-backwards-compat.css` | 2 Ko |
| 1791979106521 | 187 | `cdn.shopify.com/storefront/standard-actions.js` | 5 Ko |
| 1791979106592 | 785 | `/cdn/shop/t/29/assets/ms2-app.js` | 754 Ko |
| 1791979106593 | 450 | `https://shop.app/checkouts/internal/preloads.js` | 0 Ko |
| 1791979106595 | 147 | `/cdn/shopifycloud/storefront/assets/shopify_pay/storefront-f0e26bdf.js` | 20 Ko |
| 1791979106595 | 155 | `/cdn/shopifycloud/storefront/assets/storefront/load_feature-1bd60354.js` | 4 Ko |
| 1791979106595 | 161 | `/checkouts/internal/preloads.js` | 3 Ko |
| 1791979106595 | 200 | `cdn.shopify.com/shopifycloud/storefront/assets/storefront/origin_trials-318ab40a.js` | 1 Ko |
| 1791979106596 | 150 | `/cdn/shopifycloud/perf-kit/shopify-perf-kit-3.10.2.min.js` | 27 Ko |
| 1791979106596 | 153 | `/cdn/shopifycloud/privacy-banner/storefront-banner.js` | 27 Ko |
| 1791979106612 | 110 | `/cdn/shopifycloud/storefront/assets/storefront/autosizes-84416378.js` | 2 Ko |
| 1791979106613 | 128 | `/cdn/wpm/bb5acf91awd18c8882p8c792781mb6692debm.js` | 82 Ko |
| 1791979106618 | 91 | `/cdn/s/trekkie.storefront.32ff6085714fe9c4d5859e332c5de5f8759a859e.min.js` | 35 Ko |
| 1791979106618 | 89 | `/cdn/shopifycloud/storefront/assets/shop_events_listener-4e26a9ce.js` | 4 Ko |
| 1791979106630 | 96 | `/cdn/fonts/inter/inter_n5.d7101d5e168594dd06f56f290dd759fba5431d97.woff2` | 39 Ko |
| 1791979107104 | 575 | `https://shop.app/pay/session` | 3 Ko |
| 1791979107122 | 413 | `https://monorail-edge.shopifysvc.com/v1/produce` | 1 Ko |
| 1791979107154 | 97 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/client.init-shop-cart-sync_BV3vxy_u.fr.esm` | 1 Ko |
| 1791979107155 | 98 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.init_Dv7J5vjh.esm.js` | 1 Ko |
| 1791979107155 | 111 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.tslib-es6_CHHZATl5.esm.js` | 1 Ko |
| 1791979107155 | 107 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.document_DMcRsBXN.esm.js` | 1 Ko |
| 1791979107155 | 108 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.register_Cxs_K5wz.esm.js` | 14 Ko |
| 1791979107155 | 106 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.networkErrorMessages_DIkDbO6W.esm.js` | 1 Ko |
| 1791979107155 | 109 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/client.shop-cart-sync_Cdio0l8R.fr.esm.js` | 3 Ko |
| 1791979107156 | 111 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.casing_U_9x-Om3.esm.js` | 5 Ko |
| 1791979107156 | 110 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.window_CAbVMZox.esm.js` | 1 Ko |
| 1791979107156 | 109 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.defineInitFunction_CIjOjzsO.esm.js` | 1 Ko |
| 1791979107156 | 112 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.authorize_DINGMyE5.esm.js` | 1 Ko |
| 1791979107156 | 110 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.v4_D2VNBPfk.esm.js` | 1 Ko |
| 1791979107156 | 112 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.useUserRecognitionSignal_Dwelwsuo.es` | 1 Ko |
| 1791979107156 | 113 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.useEventListener_DTq8AI6V.esm.js` | 1 Ko |
| 1791979107156 | 115 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.validators_09U1U9sZ.esm.js` | 1 Ko |
| 1791979107156 | 114 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.storage_DQF5v-OM.esm.js` | 1 Ko |
| 1791979107156 | 116 | `cdn.shopify.com/shopifycloud/shop-js/modules/v2/chunk.hooks_CPbkKXUY.esm.js` | 1 Ko |
