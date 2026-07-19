# Déploiement du site vitrine LabFlow

Site statique servi par nginx (Dockerfile inclus). Décision actée : **vitrine sur `labflow-tn.com`**, application déplacée sur **`app.labflow-tn.com`** (l'API reste sur `api.labflow-tn.com`).

## 1. Coolify — nouvelle application « labflow-site »
1. Coolify → + New Resource → Application → ce dépôt GitHub (`labflow-site`), branche `main`.
2. Build pack : **Dockerfile** (à la racine). Port exposé : **80**.
3. Domaine : `labflow-tn.com` (+ `www.labflow-tn.com` si souhaité, avec redirection www → apex).
4. Activer le webhook de déploiement sur push `main` (comme les 2 autres apps).

## 2. Coolify — déplacer l'application client sur app.
1. Application existante `fiche-technique-frontend` → Domains : remplacer `labflow-tn.com` par **`app.labflow-tn.com`**.
2. DNS (registrar) : ajouter un enregistrement **A `app` → IP du serveur** (même IP que l'apex). Laisser `api` inchangé.
3. Attendre la génération du certificat Let's Encrypt pour `app.labflow-tn.com`.

## 3. Redirections des anciennes URLs de l'app (important)
Les clients ont des favoris vers `labflow-tn.com/login`, `/client/...`, `/admin/...`, `/portail`, `/invite/...`, `/reset-password`.
Le nginx du SITE redirige ces chemins vers `app.labflow-tn.com` : voir le bloc « redirections app » à ajouter dans
`nginx.conf` ci-dessous une fois `app.` actif :

```nginx
  location ~ ^/(login|client|admin|portail|invite|reset-password|forgot-password|error) {
    return 301 https://app.labflow-tn.com$request_uri;
  }
```

(Non inclus par défaut pour ne rien casser tant que `app.` n'existe pas — l'ajouter au moment de la bascule, dans le
server block AVANT `location /`.)

## 4. Backend — variables à vérifier
- `APP_URL` (utilisé dans les emails d'activation/invitation) doit pointer vers **https://app.labflow-tn.com** après la bascule.
- CORS : actuellement ouvert (`app.use(cors())`) — le formulaire du site fonctionne. Si le CORS est restreint un jour,
  autoriser `https://labflow-tn.com`.

## 5. Compte démo « Dar Yasmine » en production
Depuis le terminal du conteneur backend dans Coolify :
```bash
node scripts/seed-demo-vitrine.js
```
- Idempotent (purge et recrée le compte démo à chaque exécution).
- N'envoie AUCUN email de création (comptes créés en SQL) ; seuls 3-4 emails d'expédition B2B partent vers des alias
  `m.khelil.prof+acheteurX@gmail.com`.
- Identifiants : `demo@dar-yasmine.tn` / `DemoVitrine2026!` (client), `gerant@dar-yasmine.tn` (gérant),
  `m.khelil.prof+acheteur1..4@gmail.com` / `Portail2026!` (portail).

## 6. Après mise en ligne
- Remplacer le numéro WhatsApp placeholder (`wa.me/21600000000`) dans `index.html`.
- Compléter les blocs `[À COMPLÉTER]` de `mentions-legales.html` et `confidentialite.html`.
- Ajouter les partenaires : back-office → Espace « Site LabFlow » → Configuration Partenaires (logo + visibilité).
- Regénérer les captures si l'UI évolue : `npm install` puis `npm run captures` (backend+frontend locaux démarrés, seed exécuté).
