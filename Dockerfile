FROM nginx:alpine

# ⚠️ POINT DE RUPTURE : ce COPY est EXPLICITE, fichier par fichier. Un COPY qui
# cite un fichier inexistant fait échouer le build — Coolify laisse alors le site
# EN LIGNE DANS SA VERSION PRÉCÉDENTE, c'est-à-dire avec les prix. Toute
# suppression ou tout renommage de page doit être répercuté ici DANS LE MÊME
# COMMIT. Les 9 fichiers ci-dessous sont vérifiés présents à la racine du dépôt.
# Rappel D1 : tarifs.html est CONSERVÉE — ne pas la retirer de cette ligne.

COPY nginx.conf /etc/nginx/conf.d/default.conf

# 6 pages + 404.html (filet d'erreur, servie par error_page) + robots + sitemap.
COPY index.html tarifs.html demande-acces.html merci.html mentions-legales.html confidentialite.html 404.html robots.txt sitemap.xml /usr/share/nginx/html/

# assets/ : css (v3.css seule — v2.css supprimée), fonts, img, files, video.
COPY assets /usr/share/nginx/html/assets

EXPOSE 80
