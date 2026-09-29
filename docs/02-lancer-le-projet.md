# 02 — Lancer le projet

## Option 1 : Docker Compose

Prérequis : Docker avec le plugin Compose, et le `Dockerfile` de l'API écrit lors du [TD 06](06-td-conteneuriser-api.md).

```bash
docker compose up --build
```

Compose construit les deux images, crée un volume pour la base puis démarre :

1. `backend` sur le port 3000 ;
2. `frontend` sur le port 8080, **seulement quand le backend est prêt** (`depends_on` avec `condition: service_healthy`).

Commandes utiles :

```bash
docker compose ps                 # état et santé des conteneurs
docker compose logs -f backend    # journaux de l'API
docker compose down               # arrêt (la base est conservée dans le volume)
docker compose down -v            # arrêt et suppression de la base
```

## Option 2 : sans Docker

Prérequis : Node.js 24 ou plus récent (`node --version`).

```bash
cd backend && npm install && npm run dev
```

Dans un second terminal :

```bash
cd frontend && npm install && npm run dev
```

Ouvrez http://localhost:5173. Le serveur Vite relaie `/api` et `/version` vers `http://localhost:3000`.

## Données initiales

Au démarrage, si la table des réservations est **vide**, l'API insère six réservations de démonstration, dont une annulée. Leurs dates sont calculées **à partir du jour du lancement** (J+1 à J+7) : elles restent donc toujours dans le futur.

Pour repartir de zéro :

```bash
cd backend
npm run db:reset
```

En local, la base est stockée dans `backend/data/reservations.db`. Ce dossier est ignoré par Git.

## Construire l'image du frontend seule

```bash
docker build -t reservations-frontend:1.0.0 --build-arg APP_VERSION=1.0.0 frontend
```

Le `Dockerfile` du frontend est **multi-étapes** :

- une première étape installe les dépendances et construit les fichiers statiques avec Vite ;
- l'image finale ne contient que nginx et ces fichiers, sans Node.js ni dépendances.

Pour démarrer, ce conteneur a besoin d'une API joignable à l'adresse `API_URL` : lancez-le avec Compose.
