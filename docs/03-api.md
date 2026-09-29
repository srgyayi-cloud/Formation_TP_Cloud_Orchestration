# 03 — Référence de l'API

Toutes les réponses sont en JSON. Les exemples supposent l'API sur `http://localhost:3000`.

## Récapitulatif

| Méthode | Chemin | Rôle | Réponses |
|---|---|---|---|
| `GET` | `/api/reservations` | Liste toutes les réservations, triées par date | `200` |
| `POST` | `/api/reservations` | Crée une réservation | `201`, `400`, `409` |
| `DELETE` | `/api/reservations/:id` | Annule une réservation | `204`, `400`, `404` |
| `GET` | `/api/rooms` | Liste les salles et leur capacité | `200` |
| `GET` | `/health/live` | Le processus répond-il ? | `200` |
| `GET` | `/health/ready` | Le service peut-il traiter des requêtes ? | `200`, `503` |
| `GET` | `/version` | Version et commit de l'API | `200` |

## Lister les réservations

```bash
curl http://localhost:3000/api/reservations
```

```json
[
  {
    "id": 1,
    "customerName": "Alice Martin",
    "email": "alice.martin@example.com",
    "room": "Turing",
    "date": "2030-01-11",
    "startTime": "09:00",
    "endTime": "12:00",
    "participants": 8,
    "status": "confirmed",
    "createdAt": "2030-01-10T08:00:00Z"
  }
]
```

## Créer une réservation

```bash
curl -i -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Ada Lovelace","email":"ada@example.com","room":"Hopper","date":"2030-01-20","startTime":"09:00","endTime":"10:00","participants":3}'
```

Réponse `201 Created`, avec un en-tête `Location: /api/reservations/<id>` et la réservation créée.

### Règles de validation

| Champ | Règle |
|---|---|
| `customerName` | Texte de 2 à 100 caractères |
| `email` | Adresse e-mail valide |
| `room` | `Turing` (12 places), `Lovelace` (20 places) ou `Hopper` (8 places) |
| `date` | Date réelle au format `AAAA-MM-JJ`, pas dans le passé |
| `startTime`, `endTime` | Format `HH:MM` ; la fin est après le début |
| `participants` | Entier entre 1 et la capacité de la salle |

Si un ou plusieurs champs sont invalides, la réponse est `400` avec le détail **de chaque champ en erreur** :

```json
{
  "error": "validation",
  "message": "Données invalides.",
  "details": {
    "email": "L'adresse e-mail est invalide.",
    "participants": "La salle Hopper accueille au maximum 8 personnes."
  }
}
```

### Conflit de créneau

Une salle ne peut pas avoir deux réservations **confirmées** qui se chevauchent le même jour. Un créneau qui commence exactement à la fin d'un autre est accepté.

```json
{
  "error": "conflict",
  "message": "La salle Hopper est déjà réservée le 2030-01-20 de 09:00 à 10:00."
}
```

## Annuler une réservation

```bash
curl -i -X DELETE http://localhost:3000/api/reservations/1
```

- `204 No Content` : la réservation passe au statut `cancelled`. Annuler une réservation déjà annulée renvoie aussi `204`.
- `404 Not Found` : aucune réservation avec cet identifiant.
- `400 Bad Request` : l'identifiant n'est pas un entier positif.

## Santé et version

Voir [04 — Santé et version](04-sante-et-version.md).
