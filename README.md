# Estimateur Kerplus

Application web d'estimation du coût de construction au Sénégal et de vente du
rapport technique détaillé Kerplus, destinée au site **Kerplus.sn**.

- Estimation indicative en moins de deux minutes (type de projet, surface, ville,
  niveau de finition), calculée **côté serveur**.
- Commande du rapport technique détaillé (50 000 FCFA par défaut, prix
  administrable).
- Paiement Wave par lien de collecte, **confirmé manuellement** après
  vérification — aucune validation automatique depuis le navigateur.
- Espace d'administration : simulations, clients, commandes, paiements,
  rapports, appels conseil et paramètres.

Interface intégralement en français. Fuseau `Africa/Dakar`. Devise `XOF`
(FCFA), montants stockés en entiers.

---

## 1. Stack technique

| Domaine          | Choix                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Framework        | Next.js 15 (App Router) + React 19 + TypeScript 5                                 |
| Style            | Tailwind CSS 3 + composants maison (charte Kerplus)                               |
| Base de données  | PostgreSQL 16 + Prisma 6                                                          |
| Validation       | Zod (client **et** serveur)                                                       |
| Authentification | Session JWT signée (`jose`) en cookie HttpOnly + bcrypt + CSRF                    |
| Paiement         | Adaptateurs `wave_link` (défaut) et `wave_api` (à activer avec la doc officielle) |
| PDF              | `pdf-lib` (génération) ou import d'un PDF final                                   |
| Email            | Interface `EmailProvider` → SMTP (nodemailer) ou mode `preview` (aucun envoi)     |
| Tests            | Vitest (unitaires + intégration) et Playwright (E2E)                              |

---

## 2. Installation

### Prérequis

- Node.js ≥ 20.11 (développé et testé avec Node 22)
- PostgreSQL 16 (ou Docker)

### Mise en route

```bash
git clone <dépôt>
cd Ker-plus
npm install

cp .env.example .env
# Renseigner au minimum DATABASE_URL et AUTH_SECRET
#   openssl rand -base64 48   → AUTH_SECRET

npm run db:migrate     # crée le schéma
npm run db:seed        # référentiels, paramètres, compte admin (si ADMIN_PASSWORD)
npm run dev            # http://localhost:3000
```

### Base de données via Docker

```bash
docker compose up -d db
# DATABASE_URL="postgresql://kerplus:kerplus@localhost:5432/kerplus?schema=public"
```

---

## 3. Commandes

| Commande                    | Rôle                                                |
| --------------------------- | --------------------------------------------------- |
| `npm run dev`               | Serveur de développement                            |
| `npm run build`             | Build de production (génère le client Prisma)       |
| `npm run start`             | Serveur de production                               |
| `npm run lint`              | ESLint                                              |
| `npm run typecheck`         | Vérification TypeScript                             |
| `npm run test`              | Tests unitaires **et** d'intégration (Vitest)       |
| `npm run test:unit`         | Tests unitaires seuls                               |
| `npm run test:integration`  | Tests d'intégration (nécessite `TEST_DATABASE_URL`) |
| `npm run test:e2e`          | Tests de bout en bout (Playwright)                  |
| `npm run verify`            | lint + typecheck + tests + build                    |
| `npm run db:migrate`        | Migration en développement                          |
| `npm run db:migrate:deploy` | Migration en production                             |
| `npm run db:seed`           | Seed idempotent                                     |
| `npm run db:reset`          | Réinitialise la base de développement               |
| `npm run admin:create`      | Crée ou met à jour un administrateur                |

### Tests

Les tests d'intégration s'exécutent sur la base `TEST_DATABASE_URL`, **jamais**
sur la base de développement ; ils vident les tables entre chaque test.

```bash
createdb kerplus_test
DATABASE_URL="postgresql://…/kerplus_test" npx prisma migrate deploy
npm test
```

Les tests E2E démarrent automatiquement un serveur de production sur le port
3100, appliquent les migrations et rechargent le seed :

```bash
npm run build
npm run test:e2e
```

> Si un Chromium est déjà présent sur la machine (CI, conteneur), indiquer son
> chemin plutôt que de le télécharger :
> `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/chemin/vers/chromium npm run test:e2e`

---

## 4. Compte administrateur

Deux méthodes, aucune ne place de mot de passe dans le dépôt :

```bash
# 1. Via le seed (variables d'environnement)
ADMIN_EMAIL="admin@kerplus.sn" ADMIN_PASSWORD="…" npm run db:seed

# 2. Via le script dédié (saisie interactive masquée)
npm run admin:create -- --email=admin@kerplus.sn --name="Awa Ndiaye" --role=ADMIN
```

Rôles : `ADMIN` (tout, dont les paramètres), `MANAGER` (commandes, paiements,
rapports), `VIEWER` (consultation).

Connexion : `/admin/login`.

---

## 5. Configuration du paiement

L'application n'invente aucune URL ni signature Wave. Deux modes existent.

### Mode « lien de paiement » (par défaut)

```env
PAYMENT_PROVIDER="wave_link"
WAVE_PAYMENT_URL="https://wave.com/pay/…"
```

- Le client est redirigé vers le lien Wave configuré.
- Le paiement reste au statut `PENDING`.
- **Aucune** commande n'est marquée payée après une simple redirection.
- Un administrateur confirme le paiement après vérification effective, en
  saisissant la référence de la transaction (`/admin/paiements` ou la fiche
  commande).

Le lien peut aussi être défini dans l'administration
(**Paramètres → Paiement → Lien de paiement Wave**), qui est prioritaire sur la
variable d'environnement.

### Mode « API »

À n'activer qu'avec la documentation et les identifiants officiels Wave :

```env
PAYMENT_PROVIDER="wave_api"
WAVE_API_BASE_URL="…"                  # fourni par la documentation officielle
WAVE_API_CHECKOUT_PATH="…"             # chemin de création de session
WAVE_API_KEY="…"
WAVE_WEBHOOK_SECRET="…"
WAVE_WEBHOOK_SIGNATURE_HEADER="…"      # nom de l'en-tête de signature
# Facultatif, si les noms de champs diffèrent :
WAVE_API_RESPONSE_URL_FIELD="wave_launch_url"
WAVE_API_RESPONSE_ID_FIELD="id"
```

Tant que ces variables ne sont pas renseignées, l'adaptateur refuse de créer un
paiement et affiche la liste des éléments manquants dans l'administration.

Webhook : `POST /api/webhooks/paiement`
La signature est vérifiée (HMAC-SHA256 du corps brut), l'idempotence est
garantie par la contrainte unique `(provider, eventId)`, et un montant divergent
est rejeté (HTTP 409).

**Ajouter un autre fournisseur** (Orange Money, carte, PayDunya, pawaPay) :
implémenter `PaymentProviderAdapter` (`src/lib/payments/types.ts`) et
enregistrer l'instance dans `src/lib/payments/registry.ts`. Aucune logique
métier n'est à modifier.

---

## 6. Emails

```env
EMAIL_PROVIDER="preview"   # aucun envoi : messages écrits dans storage/emails
# ou
EMAIL_PROVIDER="smtp"
SMTP_HOST="…"
SMTP_PORT="587"
SMTP_USER="…"
SMTP_PASSWORD="…"
EMAIL_FROM="Kerplus <contact@kerplus.sn>"
```

Trois messages sont envoyés : commande créée (paiement en attente), paiement
confirmé, rapport disponible. En mode `preview`, ils sont consultables dans
`storage/emails/` — pratique en développement, sans risque d'envoi involontaire.
Une configuration SMTP incomplète retombe automatiquement sur `preview`.

---

## 7. Traitement d'une commande

1. **Réception** — la commande apparaît dans `/admin/commandes` au statut
   « En attente de paiement ».
2. **Vérification du règlement** — contrôler la réception sur le compte Wave.
3. **Confirmation** — sur la fiche commande (ou `/admin/paiements`), saisir la
   référence de transaction puis confirmer. La commande passe en « Payée »,
   l'échéance est calculée et le client est notifié par email.
4. **Suivi** — notes internes, historique des actions et gestion de l'appel
   conseil depuis la même fiche.

Le statut « Payée » ne peut jamais être appliqué manuellement via le sélecteur
de statut : il découle exclusivement de la confirmation d'un paiement.

---

## 8. Préparation et envoi d'un rapport

1. Ouvrir la fiche commande → **Préparation du rapport**.
2. Saisir les postes (catégorie, libellé, montant, part, précisions). La somme
   est calculée et comparée à l'estimation de référence : tout écart supérieur à
   5 % est signalé.
3. Compléter la synthèse, les hypothèses, les délais, les recommandations et les
   exclusions, puis indiquer la personne qui valide le rapport.
4. **Enregistrer le rapport**, puis :
   - **Générer le PDF** à partir des données saisies, ou
   - **Importer un PDF final** (PDF uniquement, 15 Mo maximum, type et signature
     du fichier vérifiés).
5. **Prévisualiser le PDF** (accès réservé aux administrateurs authentifiés).
6. **Envoyer au client** : un lien de téléchargement aléatoire (32 octets),
   stocké haché, expirable et révocable, est généré et envoyé par email. La
   commande passe en « Livrée ».

Les fichiers sont stockés hors de `public/` (`REPORT_STORAGE_DIR`) et ne sont
accessibles que via `/rapport/[token]`. Le lien peut être renouvelé ou révoqué à
tout moment.

Aucun rapport n'est généré automatiquement à partir de pourcentages génériques :
les montants sont saisis et validés par Kerplus.

---

## 9. Paramètres administrables

`/admin/parametres` permet de gérer, sans modification de code :

- types de projets et leurs coefficients ;
- villes/zones et leurs coefficients ;
- niveaux de finition, prix au m² et descriptions ;
- variation de la fourchette (±10 % par défaut) ;
- prix du rapport, délai de livraison annoncé, durée de l'appel conseil ;
- lien de paiement Wave et instructions de paiement ;
- coordonnées Kerplus, numéro WhatsApp, informations légales ;
- textes d'avertissement, hypothèses, postes exclus et facteurs de variation ;
- activation/désactivation de l'estimateur et de la commande.

Un référentiel déjà utilisé par une simulation **ne peut pas être supprimé** :
il est désactivé, afin de préserver l'historique. Chaque simulation conserve un
instantané des prix et coefficients appliqués : une évolution tarifaire ne
modifie jamais une estimation passée.

---

## 10. Sécurité

- Sessions administrateur : JWT HS256, cookie `HttpOnly` + `Secure` +
  `SameSite=Lax`, durée configurable.
- Mots de passe hachés avec bcrypt (coût 12), politique minimale imposée.
- Protection CSRF par double soumission sur toutes les actions d'administration.
- Rôles vérifiés côté serveur à chaque action ; le rôle et l'état actif sont
  relus en base à chaque requête.
- Limitation de fréquence (estimation, commande, connexion, téléchargement,
  webhook), champ honeypot et CAPTCHA optionnel (`CAPTCHA_PROVIDER`).
- Validation stricte de toutes les entrées (Zod) ; aucun montant transmis par le
  navigateur n'est accepté.
- En-têtes de sécurité (`nosniff`, `X-Frame-Options`, HSTS, Permissions-Policy),
  `noindex` sur `/admin`, `/commande` et `/rapport`.
- Journal d'audit horodaté ; les secrets et empreintes sont masqués dans les
  journaux ; les adresses IP ne sont stockées que sous forme d'empreinte salée.
- PDF : type et taille contrôlés, aucun accès direct au système de fichiers,
  liens de téléchargement expirables et révocables.

---

## 11. Déploiement

### Mise en ligne rapide pour un testeur (domaine temporaire)

GitHub Pages ne convient pas : l'application nécessite un serveur Node et une
base PostgreSQL. Le dépôt est prêt pour un déploiement en un clic sur **Render**
(`render.yaml`), qui fournit un domaine temporaire
`https://<nom-du-service>.onrender.com`.

1. Pousser la branche sur GitHub.
2. Render → **New → Blueprint** → sélectionner le dépôt et la branche.
   Le blueprint crée la base PostgreSQL et le service web à partir du
   `Dockerfile` ; `AUTH_SECRET` est généré automatiquement.
3. Renseigner les variables marquées « à saisir » :
   - `ADMIN_EMAIL` et `ADMIN_PASSWORD` (compte administrateur initial, ≥ 12
     caractères avec majuscule, minuscule et chiffre) ;
   - `WAVE_PAYMENT_URL` (facultatif en recette) ;
   - `NEXT_PUBLIC_SITE_URL` : l'URL attribuée par Render, à renseigner après le
     premier déploiement puis relancer le service.
4. Au démarrage, le conteneur applique les migrations et le seed
   (`SEED_ON_START=true`) : référentiels, paramètres et compte administrateur.
5. Transmettre au testeur l'URL publique et, séparément, les identifiants
   `/admin/login`.

`SEO_INDEXING=false` est actif par défaut sur ce blueprint : le domaine
temporaire n'est pas référencé.

**Limites de l'offre gratuite Render** : le service s'endort après 15 minutes
d'inactivité (premier appel ≈ 30 s), le disque n'est pas persistant — les PDF
générés sont perdus à chaque redémarrage — et la base gratuite expire au bout
de 30 jours. Pour une recette longue, passer le service en offre payante et
décommenter la section `disk` de `render.yaml` (montage sur `/app/storage`).

Autres hébergeurs adaptés au même `Dockerfile` : **Railway** (volume persistant
dès l'offre d'essai, domaine `*.up.railway.app`), **Fly.io**, ou toute VM avec
`docker compose`. **Vercel** convient à Next.js mais son système de fichiers est
éphémère : le stockage des PDF devrait alors être déporté vers un service objet
(S3, R2) via une adaptation de `src/lib/services/reports.ts`.

### Docker

```bash
export AUTH_SECRET="$(openssl rand -base64 48)"
export ADMIN_EMAIL="admin@kerplus.sn" ADMIN_PASSWORD="…"
docker compose up -d --build
# Le conteneur applique les migrations puis le seed idempotent au démarrage
# (SEED_ON_START=true par défaut dans docker-compose.yml).
```

Le service `app` expose une sonde `/api/health` (utilisée par le `HEALTHCHECK`)
et monte un volume persistant pour les rapports PDF.

### Hébergement Node classique

```bash
npm ci
npm run build
DATABASE_URL="…" ./scripts/migrate-production.sh
npm run start
```

### Sauvegardes

```bash
# Base de données (quotidienne, à conserver hors serveur applicatif)
pg_dump "$DATABASE_URL" -Fc -f kerplus-$(date +%F).dump

# Rapports PDF
tar czf kerplus-rapports-$(date +%F).tar.gz storage/reports

# Restauration
pg_restore -d "$DATABASE_URL" --clean --if-exists kerplus-2026-01-31.dump
```

### Notes de déploiement

- `AUTH_SECRET` est obligatoire en production (≥ 32 caractères) : l'application
  refuse de démarrer sinon.
- `NEXT_PUBLIC_SITE_URL` doit correspondre au domaine public (liens de
  téléchargement, emails, sitemap, canonical).
- `REPORT_STORAGE_DIR` doit pointer vers un volume persistant.
- La limitation de fréquence est en mémoire : en déploiement multi-instances,
  remplacer le magasin de `src/lib/security/rate-limit.ts` par Redis.

---

## 12. Structure du projet

```
prisma/                     schéma, migrations, seed idempotent
scripts/                    création d'admin, migration de production
src/
  app/
    page.tsx                landing + estimateur
    commande/[reference]/   confirmation de commande
    rapport/[token]/        téléchargement sécurisé du PDF
    admin/                  espace protégé (login + pages et actions serveur)
    api/                    estimation, commandes, webhook, export, santé
    (pages légales, sitemap, robots)
  components/               ui/, estimator/, admin/, layout/
  lib/
    estimation/             constantes et calcul (pur, testé)
    services/               estimation, commandes, paiements, rapports
    payments/               adaptateurs (wave_link, wave_api) + registre
    email/                  fournisseurs (smtp, preview) + gabarits
    pdf/                    génération du rapport
    security/               rate limiting, CSRF, IP, CAPTCHA
    validation/             schémas Zod
tests/                      unitaires + intégration (Vitest)
e2e/                        parcours de bout en bout (Playwright)
```

---

## 13. Points nécessitant une intervention de Kerplus

- **Identifiants Wave** : le mode API reste inactif tant que la documentation et
  les clés officielles ne sont pas fournies.
- **Informations légales** : forme juridique, RCCM, NINEA, siège, directeur de
  publication et hébergeur sont à renseigner dans l'administration ; aucune
  donnée juridique fictive n'est publiée.
- **Coordonnées** : téléphone, WhatsApp et adresse conditionnent l'affichage des
  blocs de contact.
- **Logo** : aucun logo officiel n'ayant été fourni, l'identité repose sur le
  texte « Kerplus.sn ».
