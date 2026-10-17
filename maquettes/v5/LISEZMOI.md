# Maquettes V5-1 — site vitrine LabFlow (17/10/2026)

Quatre pages à regarder dans le navigateur, jamais mises en ligne (branche locale `feat/v5-maquettes`).

## Ouvrir

Depuis le dossier du site :

    node tools/serve.js

puis :

- http://localhost:8322/maquettes/v5/accueil-a.html — Accueil A, thème Nuit conservé, accroche « Du bon de livraison au bilan. »
- http://localhost:8322/maquettes/v5/accueil-b.html — Accueil B, thème Nuit, hero « parcours » (facture → stock → écriture → bilan), accroche « Vous photographiez la facture. LabFlow fait le reste, jusqu'au bilan. »
- http://localhost:8322/maquettes/v5/accueil-c.html — Accueil C, variante claire, accroche « Achats, stock, ventes, comptabilité : un seul logiciel, votre comptable dedans. »
- http://localhost:8322/maquettes/v5/approvisionnements.html — page métier « Approvisionnements & factures »

Une barre en bas à gauche permet de passer d'une maquette à l'autre. Les captures (bureau, mobile, menus) sont dans `captures/`.

## Ce qui est vrai, ce qui est provisoire

- Les captures d'écran réelles (tableau de bord, commandes, facture) sont celles du site actuel.
- Les écrans « Vérifier la facture », « écriture d'achat », « bilan » et « dépôt de la pièce » sont des **compositions schématiques** : ils seront remplacés par de vraies captures au lot V5-2.
- La vidéo du hero est la boucle actuelle ; la vidéo recomposée (2 min) est prévue au lot V5-2.
- Les pages Comptabilité, Ventes & clients, Métiers & sites n'existent pas encore (lot V5-3) : leurs liens pointent vers les sections correspondantes de l'accueil.
- Budgets respectés : accueil ≈ 650 mots de prose (≤ 900), page Approvisionnements ≈ 560 (≤ 700).

## À décider

1. Accroche : A, B ou C.
2. Hero : vidéo seule (A, C) ou texte + parcours à droite, vidéo dessous (B).
3. Thème : Nuit (A, B) ou clair (C). Les deux peuvent se combiner avec n'importe quelle accroche.
4. La page Approvisionnements : ordre et contenu des cinq sections.
