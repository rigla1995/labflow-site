FROM nginx:alpine

# ⚠️ POINT DE RUPTURE : ce COPY est EXPLICITE, fichier par fichier. Un COPY qui
# cite un fichier inexistant fait échouer le build — Coolify laisse alors le site
# EN LIGNE DANS SA VERSION PRÉCÉDENTE, c'est-à-dire avec les prix. Toute
# suppression ou tout renommage de page doit être répercuté ici DANS LE MÊME
# COMMIT. Les 13 fichiers ci-dessous sont vérifiés présents à la racine du dépôt.
# Rappel D1 : tarifs.html est CONSERVÉE — ne pas la retirer de cette ligne.

COPY nginx.conf /etc/nginx/conf.d/default.conf

# 10 pages (V5 19/10/2026 : accueil + 4 pages Produits + tarifs, demande d'accès, merci, légales) + 404.html (filet
# d'erreur, servie par error_page) + robots + sitemap. tools/verify-pages.js vérifie que chaque page de PAGES est citée ici.
COPY index.html approvisionnements.html comptabilite.html ventes-clients.html stock-suivi.html tarifs.html demande-acces.html merci.html mentions-legales.html confidentialite.html 404.html robots.txt sitemap.xml /usr/share/nginx/html/

# assets/ : css (v4.css seule — v2.css et v3.css supprimées), fonts, img, files, video.
COPY assets /usr/share/nginx/html/assets

EXPOSE 80
