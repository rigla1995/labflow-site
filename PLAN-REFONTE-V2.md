# PLAN REFONTE V2 — Site vitrine LabFlow

> **Pour la prochaine session : lire ce fichier EN ENTIER avant de coder, puis attaquer directement.**
> Contexte produit/mémoire : fiche `site-vitrine-labflow` dans la mémoire persistante.

## 0. État actuel (V1 en prod, fonctionnelle)

- `https://labflow-tn.com` = ce repo, déployé par **push sur `main` → webhook Coolify** (vérifié, < 1 min).
- `https://app.labflow-tn.com` = l'application ; `https://api.labflow-tn.com` = l'API (endpoints publics actifs).
- Ce qui MARCHE et ne doit pas casser : redirections nginx `/login|/client|/admin|/portail|…` → app. ; formulaire
  demande d'accès branché sur `POST /api/public/demande-acces` (+ honeypot `website`, garde 3 s) ; calculateur
  branché sur `GET /api/public/tarifs-reference` ; carrousel partenaires sur `GET /api/public/partenaires`
  (masqué si vide) ; fichiers de preuve dans `assets/files/` ; robots/sitemap ; URLs des 6 pages.
- Compte démo « Dar Yasmine » seedé en local ET en prod (`scripts/seed-demo-vitrine.js` côté backend) —
  logins dans la fiche mémoire. Outils locaux : `node tools/serve.js` (port 8322), `npm run captures`.

## 1. Les 3 remarques client à corriger (le POURQUOI de la V2)

1. **« Site trop classique, pas attirant »** — il veut du moderne qui met en valeur ce que LabFlow propose :
   « finalement on propose presque un petit ERP ». → Refonte design complète (section 2) + positionnement
   « **le petit ERP des métiers de bouche** » assumé partout.
2. **Page demande d'accès** : pas de conditions de saisie affichées, page fade, formulaire trop grand.
   → Refonte UX du formulaire (section 3).
3. **Captures floues + certaines prises pendant le chargement.** → Re-shoot outillé (section 4).

## 2. Design V2 — direction retenue « MISE EN PLACE » (bento arrière-cuisine)

Issue d'un panel de 3 directions + jury. Parti pris : le bento matérialise l'ERP — l'emboîtement des modules
est MONTRÉ (tuiles reliées, pricing = assemblages de tuiles, sélecteur métier qui recompose la grille).
Majoritairement CLAIR (lisible pour un patron non-tech) avec exactement **2 zones sombres** (« l'arrière-cuisine ») :
la section Système+Cascade et le CTA final. Chaleur tunisienne : fond lin, accent safran, récit de la journée réelle.

### 2.1 Tokens (`:root`, centralisés)
```css
--bg-lin:#F7F5F1; --surface:#FFF; --border-sable:#E7E2D9;
--bg-nuit:#101322; --surface-nuit:#151B2E; --border-nuit:#232B42;
--encre:#1A1F2E; --encre-2:#5A6072; --texte-nuit:#E8EAF2; --texte-nuit-2:#9AA3C7;
--ciel:#0EA5E9; --indigo:#6366F1; --violet:#A855F7;
--grad-marque:linear-gradient(135deg,#0EA5E9,#6366F1,#A855F7);
--safran:#E39A2E; --vert-marge:#0F9D6E; /* #3DDC97 sur sombre */
--ambre-dt:#B8721F; /* montants DT sur clair ; #FFB454 sur sombre */
```
- Radius : 16px tuiles, 12px cadres capture, 999px pills. Ombres claires douces + glow indigo (pseudo-élément)
  derrière les captures sur sombre. Liseré hover dégradé via `::after` masqué 1px. Transitions entre mondes :
  bandeaux inclinés `clip-path`.
- **Typo** : titres **Bricolage Grotesque** variable (OFL, subset latin woff2 ~38 Ko, preload, `font-display:swap`,
  fallback system-ui) — EXIT le Palatino. Corps : pile système 17px/1.6. Chiffres/DT/ticket : `ui-monospace` +
  `tabular-nums`. H1 `clamp(2.6rem,6vw,4.4rem)`, ls -0.02em. Si le subset de police est impossible à produire,
  repli : pile système graisse 800 (ne pas bloquer là-dessus).

### 2.2 Structure de page (index.html — 11 sections, dans cet ordre)
1. **Header sticky 64px** translucide + blur, trait sable au scroll, bascule sombre sur les zones nuit (classe via
   l'observer). Logo losange + 4 ancres (Le système, Votre métier, Tarifs→tarifs.html, FAQ) + pill CTA dégradée.
2. **Hero (clair)** grid 45/55 : eyebrow pill « Le petit ERP des métiers de bouche — conçu en Tunisie » (point
   dégradé pulsant) ; H1 « **Tout votre labo. Un seul système.** » — « système » souligné par un path SVG dégradé
   qui se dessine ; sous-titre 2 lignes ; CTA + lien ghost « Voir le système en 2 min ↓ ». À droite : **mini-bento
   6 tuiles auto-assemblé au load** (crop dashboard KPI marge, stock+jauge, production+compteur, portail B2B,
   facture+timbre, tuile losange LF) + 3 connecteurs pointillés. Mobile : 2 colonnes sous le texte, sans connecteurs.
3. **Problème « Le coût du flou » (clair)** : 3 post-its désalignés (pertes non mesurées / coût au doigt mouillé /
   stock sur Excel) + flèches griffonnées SVG, face à une 4ᵉ carte droite LabFlow. H2 « Vous savez faire. Mais
   savez-vous ce que ça vous rapporte ? ». Sortie par bandeau incliné vers le sombre.
4. **LE SYSTÈME (sombre, bento maître)** : eyebrow « Un petit ERP, pas une pile d'outils ». Grid 12 col en
   `grid-template-areas` NOMMÉES et commentées. 9 tuiles numérotées 01→09 (Stocks 2×2 capture+jauge PMP ·
   Appros · Pertes sparkline · Production 2×1 avec lignes d'ingrédients qui se décrémentent · Fiches techniques
   1×2 arbre de recette · Transferts · Ventes multi-canaux 2×1 · Portail B2B 2×2 capture · Facture fiscale+timbre)
   + tuile centrale « **moteur de valorisation** » (losange LF pulsant 4s). Connecteurs SVG dégradés convergeant
   vers le moteur, points de flux animés. Sur les grandes tuiles : cartouche **Entrées/Sorties**, mention
   « s'emboîte avec → 03, 07 », badges verts en cascade (« déduit automatiquement », « PMP recalculé »).
   <900px : 2 colonnes, connecteurs masqués, numéros/badges conservés.
5. **LA CASCADE (sombre, bloc signature)** : 3 cartes chaînées « Prix d'achat farine 2,400 → 2,650 DT/kg » →
   « Coût de revient croissant recalculé 0,842 → 0,895 DT » → « Marge dashboard 67 % → 65 % », propagation en
   3 temps (0/600/1200 ms) avec count-up mono au premier passage. Titre « Touchez un chiffre. Tout le système
   suit. » (⚠️ vérifier le réalisme des montants DT avec le compte démo). Reduced-motion : statique fléché.
6. **UNE JOURNÉE DANS VOTRE LABO (clair)** : timeline 6 étapes horodatées (6h appro → 22h marges), pastilles
   heure safran, mini-tuile rappel qui s'allume à l'entrée dans le viewport. Desktop rail horizontal, mobile liste.
7. **VOTRE MÉTIER (clair)** : onglets 7 métiers → `data-metier` sur le conteneur, bascule CSS pure, TOUT le
   contenu dans le HTML (SEO). Chaque métier : bento miniature recomposé (tuiles pertinentes 100 %, autres 30 %)
   + 3 bénéfices en langage patron + 1 capture crop ciblée.
8. **PREUVES « Rien de maquillé » (clair)** : les 3 fichiers réels en objets physiques (facture PDF coin plié CSS,
   exports Excel bandeau vert, nom + poids réels affichés). Encart « Toutes les captures sortent d'un compte de
   démonstration réel. Montants en DT. » Partenaires : rangée statique grisée (fetch conservé, masquée si vide).
9. **TARIFS + CALCULATEUR (clair, vedette sombre)** : 3 formules en assemblages de tuiles (Premium = la tuile
   Espace Produit se clipse au scroll) ; calculateur conservé (branché tarifs-reference : prix + remises +
   onboarding runtime) mais rejoué en **TICKET DE CAISSE** (bords crantés clip-path, mono, total count-up,
   réimpression slide-down). CTA emporte la config (localStorage `lf_calc` — conserver la clé).
10. **FAQ (clair)** : `details/summary` dégraissés, 4 thèmes, 8 questions max (reprendre les réponses V1
    fact-checkées — ne pas réécrire les faits).
11. **CTA FINAL (sombre, miroir du hero)** : bento en fond 8 %, H2 « Votre système vous attend. », **bouton vers
    demande-acces.html** (PAS de mini-formulaire dupliqué — la page dédiée reste l'unique point d'entrée API)
    + réassurances. Footer dense même fond.

### 2.3 Mise en scène des captures
Cadre signature 100 % CSS : faux chrome navigateur (barre 28px, 3 pastilles aux couleurs du logo, pill URL
« app.labflow-tn.com »), coins 12px. **Crops chirurgicaux partout** sauf le dashboard maître. Jamais recolorées
(les captures restent claires — sur le sombre, c'est l'effet « écrans allumés »). Tilt 3D réservé aux 2 grandes
tuiles du bento maître. Cartes-loupe : crop 2× du chiffre clé + chiffre doublé en HTML mono. Micro-mention
« compte de démonstration » près de tout KPI. `<picture>` AVIF + WebP, srcset 2 tailles, lazy partout sauf hero
(`fetchpriority=high`). Sur mobile : stat-chips HTML remplacent les chiffres des captures rétrécies.

### 2.4 Motion (100 % CSS + vanilla ≤ 15 Ko)
UN IntersectionObserver (classe `.in`) + rAF pour les count-up. Auto-assemblage hero (450ms, stagger 80ms) ;
révélations translateY(24px) ; connecteurs stroke-dashoffset puis flux en boucle lente (MAX une animation
ambiante par viewport) ; hover tuiles translateY(-4px)+liseré ; sheen CTA ; pulsation losange 4s ; fil conducteur
vertical rempli au scroll ; ticket slide-down. INTERDITS : animer width/height/top ; scroll-jacking ; sticky-scrollytelling ;
libs. `prefers-reduced-motion` : double débrayage (CSS + matchMedia), états finaux complets.

### 2.5 Budgets & vigilance (contractuels)
Première vue < 500 Ko, page < 1,5 Mo, images totales < 900 Ko (≤ 120 Ko/capture), 1 police (~38 Ko), JS < 15 Ko.
Contrastes AA à vérifier (#9AA3C7/#101322, #5A6072/#F7F5F1, #B8721F/blanc, #3DDC97/#151B2E). Sombre limité à
2 zones. Bento : UNE idée par tuile, titres 3 mots. Connecteurs jamais recalculés en JS, masqués <900px, le bento
doit rester compréhensible sans eux. Mobile = première classe (grille 2 col, carrousels scroll-snap, CTA pleine
largeur). **Montrer le hero + la section Système au client en preview locale AVANT de refondre le reste**
(valider : duo clair/sombre, nouvelle typo, montants de la Cascade, refonte du formulaire).

## 3. Refonte demande-acces.html (remarque 2)

Layout **split-screen** : à gauche le formulaire en **2 étapes compactes** ; à droite (desktop) un panneau sombre
`--bg-nuit` avec les 3 étapes « comment ça se passe » (24 h → démo → devis), les réassurances et un crop produit —
fini la page fade. Mobile : panneau replié en bandeau au-dessus.

- **Étape 1 « Vos coordonnées »** : nom, email, téléphone (préfixe `+216` affiché en dur, masque de saisie
  `XX XXX XXX` appliqué à la frappe). **Étape 2 « Votre activité »** : ville, type (7 options), nb points de vente,
  labo oui/non, B2B oui/non, message (compteur 0/2000). Barre de progression 1/2 → 2/2, bouton « Continuer »
  bloqué tant que l'étape est invalide, retour possible.
- **Conditions de saisie VISIBLES** : aide de format sous chaque champ AVANT la saisie (ex. téléphone :
  « 8 chiffres, commence par 2, 5, 7 ou 9 ») ; validation en direct au blur puis à la frappe après première
  erreur ; états par champ : focus (ring indigo) / valide (✓ vert + bordure `--vert-marge`) / erreur (bordure
  rouge + message précis SOUS le champ, `aria-live="polite"`, `aria-invalid`).
- Consentement : phrase courte + case, texte légal complet en dépliable `details` (le contenu 2004-63 existant).
- Conserver À L'IDENTIQUE : payload API (`POST /api/public/demande-acces`, mêmes clés camelCase), honeypot
  `website`, garde 3 s, normalisation téléphone (strip espaces/tirets), récap config `lf_calc` (restylé ticket),
  redirection merci.html, message d'erreur réseau. État « Envoi… » avec spinner sur le bouton.

## 4. Re-shoot des captures (remarque 3)

Causes V1 : attentes fixes (pages capturées en cours de chargement) + pleines pages 1440px écrasées dans des
cartes de 360px (flou) + PNG lourds. Refonte de `tools/capture.js` :

1. **Attente de DONNÉES, pas de délai** : après `domcontentloaded`, `page.waitForFunction` sur (a) présence de
   montants (`/\d\s?DT/` dans la zone cible), (b) absence de spinners/textes « Chargement », puis 500 ms de marge.
   Réessayer 1× si vide. (La SSE de la cloche casse `networkidle2` — ne PAS l'utiliser.)
2. **Crops ciblés** par `screenshot({ clip })` sur les zones qui prouvent, à dpr 2 : KPI marge (dashboard),
   colonne Valeur DT (stock), arbre de recette + coût (produits — ouvrir la fiche technique du Mille-feuille si
   accessible), ligne de déduction (production), stepper 4 états (commandes), timbre fiscal (facture), jauge PMP.
   Garder 2 pleines pages max : dashboard (hero) et portail catalogue.
3. **Export AVIF + WebP 2 tailles** (ajouter `sharp` en devDependency, script de post-traitement) ≤ 120 Ko chacune,
   nommage `nom@1x.avif|webp` / `nom@2x.…`. Mettre à jour les `<picture>` du site.
4. Prérequis : backend+frontend locaux démarrés, seed Dar Yasmine exécuté (déjà en place), login
   `demo@dar-yasmine.tn`. Vérifier CHAQUE image à l'œil (outil Read) avant intégration.

## 5. Ordre d'exécution conseillé

1. Lire ce plan + fiche mémoire → 2. Re-shoot captures (section 4) → 3. Nouvelle feuille `assets/css/v2.css`
(tokens) + refonte `index.html` (sections 1→11) → 4. **Point de validation client** (preview locale hero+Système)
→ 5. `demande-acces.html` (section 3) → 6. `tarifs.html` au nouveau design (tuiles + ticket) → 7. merci/légales :
alignement tokens → 8. Vérifs : `node tools/serve.js` + navigateur (desktop, 390px, reduced-motion, console,
poids réseau), parcours formulaire complet local → 9. Push `main` (auto-deploy) → 10. Vérif prod (curl 200/301,
parcours réel, Ctrl+Shift+R).

## 6. Verrous (ne pas toucher / ne pas casser)

- URLs des 6 pages + ancres `#tarifs` `#faq` `#fonctionnalites` `#pourqui` (ou rediriger proprement), robots/sitemap.
- nginx : bloc redirections app + fix `$uri/` (raison d'être documentée dans les commentaires).
- Contrats API publics (payloads exacts) et clé localStorage `lf_calc`.
- Interdits copy fact-checkés : pas d'essai gratuit / inscription / CB / codes promo ; pas de chiffres clients
  inventés ; pas d'export PDF d'historiques ; « Basique = sans fiches techniques » est FAUX avec labo ; un seul
  CTA « Demander un accès » ; mention « tarifs de référence — devis au contrat ».
- FR uniquement ; numéro WhatsApp encore placeholder (`wa.me/21600000000`) ; blocs légaux `[À COMPLÉTER]`.
