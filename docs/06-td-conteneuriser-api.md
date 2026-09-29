# 06 — TD : conteneuriser l'API

## Objectif

Écrire `backend/Dockerfile` et `backend/.dockerignore`, puis compléter le service `backend` de `compose.yaml`, pour que l'API soit livrable sous forme d'**image versionnée, traçable et observable**.

Le frontend est déjà conteneurisé : inspirez-vous de `frontend/Dockerfile` si besoin.

Durée indicative : 1 h.

## Ce que vous devez savoir sur l'API

| Élément | Valeur |
|---|---|
| Runtime | Node.js **24** minimum (la base utilise le module intégré `node:sqlite`) |
| Installation des dépendances | `npm ci` (utilise `package-lock.json`) |
| Compilation | `npm run build` → code JavaScript dans `dist/` |
| Démarrage | `node --disable-warning=ExperimentalWarning dist/server.js` |
| Dépendances nécessaires à l'exécution | celles de `dependencies` uniquement (`npm ci --omit=dev`) |
| Port | `3000` (variable `PORT`) |
| Base de données | fichier SQLite, chemin donné par `DATABASE_PATH` |
| Version | variables `APP_VERSION` et `GIT_COMMIT`, renvoyées par `GET /version` |
| Santé | `GET /health/live` et `GET /health/ready` (voir [04](04-sante-et-version.md)) |
| Arrêt | l'API s'arrête proprement à la réception de `SIGTERM` |

## Critères de réussite

Votre travail est validé quand **chaque vérification ci-dessous donne le résultat attendu**. Les commandes sont à lancer depuis la racine du dépôt.

| # | Critère | Vérification | Points |
|---|---|---|---|
| 1 | L'image se construit en injectant la version | `docker build -t reservations-backend:1.0.0 --build-arg APP_VERSION=1.0.0 --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) backend` | 2 |
| 2 | Le conteneur démarre et répond | `docker run -d --name api -p 3000:3000 -v reservations-data:/data reservations-backend:1.0.0` puis `curl localhost:3000/health/ready` → `200` | 2 |
| 3 | La version vient de l'image | `curl localhost:3000/version` → `1.0.0` et le commit | 2 |
| 4 | La version peut être remplacée sans reconstruire | relancer avec `-e APP_VERSION=1.0.1` → `/version` affiche `1.0.1` | 2 |
| 5 | Docker connaît l'état de santé | `docker ps` affiche `(healthy)` moins de 30 s après le démarrage | 2 |
| 6 | Les données survivent au conteneur | créer une réservation, `docker rm -f api`, relancer avec le même volume → la réservation est toujours là | 3 |
| 7 | Le conteneur ne tourne pas en root | `docker exec api id` → un utilisateur autre que `uid=0` | 2 |
| 8 | L'image ne contient que le nécessaire | `docker run --rm reservations-backend:1.0.0 sh -c "ls; ls node_modules \| grep -c typescript"` → pas de dossier `src`, `0` | 2 |
| 9 | L'arrêt est propre | `time docker stop api` prend moins de 3 s et `docker logs api` affiche « SIGTERM reçu » | 2 |
| 10 | L'ensemble démarre avec Compose | `docker compose up --build` → http://localhost:8080 affiche les réservations et la version de l'API | 1 |
| | | **Total** | **20** |

Bonus : le contexte envoyé au build (ligne « transferring context ») reste de l'ordre de quelques centaines de kilo-octets, même après un `npm install` et un lancement local.

## Questions à préparer pour la restitution

1. Pourquoi utiliser **deux étapes** (`FROM … AS build` puis une seconde image) ? Que contiendrait l'image avec une seule étape ?
2. Quelle différence entre `ARG` et `ENV` ? Pourquoi a-t-on besoin des deux pour la version ?
3. Pourquoi le critère 9 échoue-t-il avec `CMD node dist/server.js` ou `CMD npm start`, et réussit-il avec la forme `CMD ["node", …]` ?
4. Votre `HEALTHCHECK` appelle-t-il `/health/live` ou `/health/ready` ? Justifiez.
5. Que se passerait-il si deux conteneurs de l'API partageaient le même volume ?
6. Dans quel ordre copier les fichiers pour que Docker réutilise son cache quand seul le code change ?

## Indices

<details>
<summary>Indice 1 — structure générale</summary>

Une première étape part de `node:24-alpine`, installe **toutes** les dépendances et compile. La seconde repart d'une image `node:24-alpine` propre, installe uniquement les dépendances de production et récupère `dist/` depuis la première étape avec `COPY --from=…`.
</details>

<details>
<summary>Indice 2 — version</summary>

`ARG APP_VERSION=0.0.0-local` rend la valeur disponible pendant le build. `ENV APP_VERSION=${APP_VERSION}` l'inscrit dans l'image pour l'exécution. Une option `-e` au `docker run` la remplace.
</details>

<details>
<summary>Indice 3 — utilisateur et volume</summary>

L'image `node` fournit déjà un utilisateur `node`. Le dossier de la base doit exister et lui appartenir **avant** l'instruction `USER node`. Pensez à fixer `DATABASE_PATH` sur ce dossier.
</details>

<details>
<summary>Indice 4 — HEALTHCHECK</summary>

Les images Alpine contiennent `wget` (BusyBox) mais pas `curl` :

`HEALTHCHECK CMD wget -qO /dev/null http://127.0.0.1:3000/<chemin> || exit 1`
</details>

<details>
<summary>Indice 5 — Compose</summary>

Le frontend attend que le backend soit `healthy` (`depends_on` … `condition: service_healthy`) : sans `HEALTHCHECK` dans votre image, il ne démarrera jamais. Déclarez un volume nommé et montez-le sur le dossier de la base.
</details>
