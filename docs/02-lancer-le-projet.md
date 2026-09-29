# 02 — Lancer le projet

## Option 1 : Docker Compose

Prérequis : Docker avec le plugin Compose, et le `Dockerfile` de l'API écrit lors du TP1.

```bash
docker compose up --build
```

Compose construit les deux images, crée un volume pour la base puis démarre, chacun **seulement quand le précédent est prêt** (`depends_on` avec `condition: service_healthy`) :

1. `db` (PostgreSQL) sur le port 5432 ;
2. `backend` sur le port 3000, qui applique les migrations puis charge les données initiales ;
3. `frontend` sur le port 8080.

Commandes utiles :

```bash
docker compose ps                 # état et santé des conteneurs
docker compose logs -f backend    # journaux de l'API
docker compose down               # arrêt (la base est conservée dans le volume)
docker compose down -v            # arrêt et suppression de la base
```

## Option 2 : sans conteneuriser l'API

Prérequis : Node.js 24 ou plus récent (`node --version`) et Docker pour la base.

```bash
docker compose up -d db
cd backend && npm install && npm run dev
```

L'API se connecte par défaut à `postgres://reservations:reservations@localhost:5432/reservations`, les identifiants de développement définis dans `compose.yaml`. Pour utiliser un autre serveur PostgreSQL, définissez `DATABASE_URL`.

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

## Lancer les tests

Les tests d'intégration de l'API ont besoin de la base :

```bash
docker compose up -d db
cd backend && npm test
```

Ils vident la table des réservations avant chaque test : relancez `npm run db:reset` ensuite si vous voulez retrouver les données de démonstration.

## Construire l'image du frontend seule

```bash
docker build -t reservations-frontend:1.0.0 --build-arg APP_VERSION=1.0.0 frontend
```

Le `Dockerfile` du frontend est **multi-étapes** :

- une première étape installe les dépendances et construit les fichiers statiques avec Vite ;
- l'image finale ne contient que nginx et ces fichiers, sans Node.js ni dépendances.

Pour démarrer, ce conteneur a besoin d'une API joignable à l'adresse `API_URL` : lancez-le avec Compose.
