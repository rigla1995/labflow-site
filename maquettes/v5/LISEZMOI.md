# Maquettes V5-1 — site vitrine LabFlow (17/10/2026)

Sept pages à regarder dans le navigateur, jamais mises en ligne (branche locale `feat/v5-maquettes`).
**Accueil B retenu par le client le 17/10.** Remarques du même jour appliquées : menu « Produits » (avec s, aligné),
badges « Nouveau » retirés, carte « métiers » remplacée par « Tout commerce qui achète, stocke, produit et vend ».

## Ouvrir

    node C:\Users\CHAHDONj\labflow-site\tools\serve.js

puis http://localhost:8322/maquettes/v5/ suivi de :

- `accueil-b.html` — **l'accueil retenu** (thème Nuit, hero « parcours »). `accueil-a.html` et `accueil-c.html` restent pour mémoire.
- `approvisionnements.html` — Approvisionnements & factures
- `comptabilite.html` — Comptabilité (LabFlow Compta, cabinets)
- `ventes-clients.html` — Ventes & clients, pros et particuliers (carnet, portail, quatre états, facture)
- `stock-suivi.html` — Stock, production & suivi (stock par site, fiches techniques, inventaires, tableau de bord avec tous ses choix, sites et gérants)

Une barre en bas à gauche permet de passer d'une maquette à l'autre. Les captures (bureau, mobile, menus) sont dans `captures/`.

## Ce qui est vrai, ce qui est provisoire

- Captures réelles : tableau de bord, stock, fiche technique, commandes, facture (celles du site actuel).
- Écrans schématiques, à remplacer au lot V5-2 : vérification de facture, dépôt, écriture d'achat, plan de comptes,
  bilan et état de résultat, dossiers du cabinet, carnet des clients, portail, barre de filtres du tableau de bord.
- La vidéo du hero est la boucle actuelle ; la vidéo recomposée (2 min) et les clips de 30 à 45 s sont prévus au lot V5-2.
- Budgets : accueil B ≈ 745 mots de prose (≤ 900) ; pages entre 430 et 525 (≤ 700).

## À décider

1. Les trois nouvelles pages (Comptabilité, Ventes & clients, Stock & suivi) : ordre et contenu des sections.
2. La carte « Pour qui » de l'accueil : la formulation « tout commerce qui achète, stocke, produit et vend ».
