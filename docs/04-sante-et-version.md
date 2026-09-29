# 04 — Santé et version

## Deux questions différentes

Un orchestrateur comme Kubernetes pose deux questions distinctes à une application :

| Sonde | Question | Si la réponse est non… |
|---|---|---|
| **Liveness** — `GET /health/live` | Le processus est-il encore capable de répondre ? | Le conteneur est **redémarré** |
| **Readiness** — `GET /health/ready` | Le service peut-il traiter des requêtes maintenant ? | Le conteneur **ne reçoit plus de trafic**, sans être redémarré |

### `/health/live`

Répond toujours `200 {"status":"ok"}` tant que le serveur HTTP fonctionne. Elle ne vérifie **aucune dépendance**, volontairement : si elle échouait parce que la base est indisponible, l'orchestrateur redémarrerait l'API en boucle sans rien résoudre.

### `/health/ready`

Exécute une vraie requête `SELECT 1` sur PostgreSQL, la seule dépendance de l'API.

```json
{ "status": "ready", "checks": { "database": "ok" } }
```

Elle répond `503` dans deux cas :

- la base ne répond pas : `{"status":"not-ready","checks":{"database":"error"}}` ;
- l'API est en cours d'arrêt : après réception de `SIGTERM`, elle se déclare non prête pour qu'on arrête de lui envoyer du trafic, termine les requêtes en cours puis s'arrête.

Pour l'observer : `docker compose stop db`, puis appelez les deux sondes. `/health/live` répond toujours `200` (le processus va bien), `/health/ready` répond `503` (il ne peut pas servir de requêtes). Relancez la base avec `docker compose start db` : l'API redevient prête sans redémarrer.

> Une sonde de readiness ne doit vérifier que des dépendances **réelles**. Annoncer un contrôle qui n'existe pas donnerait une fausse impression de sécurité.

### Côté frontend

nginx expose `/healthz`, qui répond `ok` dès que le serveur web fonctionne. Le frontend n'a pas de dépendance à vérifier pour servir ses fichiers.

### Dans Docker

Le `Dockerfile` du frontend déclare un `HEALTHCHECK` sur `/healthz`. Celui de l'API, que vous écrirez au TP1, devra en déclarer un aussi. `docker compose ps` affiche l'état `healthy` ou `unhealthy`, et Compose attend que l'API soit `healthy` avant de démarrer le frontend.

## La version affichée

### D'où vient-elle ?

| Composant | Source | Valeur de secours |
|---|---|---|
| API (`GET /version`) | Variables `APP_VERSION` et `GIT_COMMIT` | `0.0.0-local` et `unknown` |
| Interface (`GET /config.json`) | Variable `APP_VERSION` du conteneur nginx | `0.0.0-local` (fichier `public/config.json` en local) |

La version peut être fixée à deux moments :

- **au build**, avec `--build-arg APP_VERSION=1.2.0` : la valeur devient la valeur par défaut de l'image ;
- **à l'exécution**, avec `-e APP_VERSION=1.2.0` : la valeur remplace celle de l'image.

Bonne pratique : la version affichée doit correspondre au **tag de l'image**. La pipeline se chargera de passer la même valeur aux deux.

### Pourquoi la voir aussi clairement ?

Le bandeau en haut de l'interface affiche la version du frontend et celle de l'API, avec le commit. Sa **couleur est calculée à partir de la version** : une nouvelle version change la couleur, ce qui rend visible d'un coup d'œil :

- une **mise à jour** : la couleur change ;
- un **rollback** : l'ancienne couleur revient ;
- un **déploiement partiel** : le frontend et l'API n'affichent pas la même version.

## Exercice : observer une mise à jour et un rollback

```bash
# Version 1.0.0
docker compose up -d --build
# Ouvrez http://localhost:8080 et notez la couleur du bandeau

# "Déploiement" de la version 1.1.0
APP_VERSION=1.1.0 GIT_COMMIT=a1b2c3d docker compose up -d
# Rechargez la page : numéro et couleur ont changé

# "Rollback" vers 1.0.0
APP_VERSION=1.0.0 docker compose up -d
```

Questions :

1. Les réservations créées entre deux versions sont-elles conservées ? Pourquoi ?
2. Ici, seule la variable change : l'image est la même. Qu'est-ce qui changera quand chaque version aura sa propre image ?
3. Que se passe-t-il si vous arrêtez l'API pendant que l'interface est ouverte ?
