import express, { type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config.js';
import { pingDatabase, type Database } from './db.js';
import { ReservationRepository, ROOMS, validateReservation } from './reservations.js';
import { toIsoDate } from './seed.js';

// Plus grand identifiant possible (colonne integer de PostgreSQL)
const MAX_ID = 2_147_483_647;

export interface AppOptions {
  db: Database;
  config: Pick<Config, 'appVersion' | 'gitCommit'>;
  // Passe à true pendant l'arrêt : le service n'accepte plus de nouveau trafic
  isShuttingDown?: () => boolean;
  now?: () => Date;
  logRequests?: boolean;
}

export function createApp({
  db,
  config,
  isShuttingDown = () => false,
  now = () => new Date(),
  logRequests = true,
}: AppOptions) {
  const app = express();
  const reservations = new ReservationRepository(db);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  // Journal d'accès minimal, sans les sondes de santé appelées en boucle
  app.use((req, res, next) => {
    if (!logRequests || req.path.startsWith('/health')) return next();
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // Liveness : le processus répond. Aucune dépendance vérifiée.
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness : le service peut traiter des requêtes, donc PostgreSQL répond.
  app.get('/health/ready', async (_req, res) => {
    if (isShuttingDown()) {
      res.status(503).json({ status: 'shutting-down', checks: { database: 'skipped' } });
      return;
    }
    try {
      await pingDatabase(db);
      res.json({ status: 'ready', checks: { database: 'ok' } });
    } catch {
      res.status(503).json({ status: 'not-ready', checks: { database: 'error' } });
    }
  });

  app.get('/version', (_req, res) => {
    res.json({ version: config.appVersion, commit: config.gitCommit });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json(Object.entries(ROOMS).map(([name, capacity]) => ({ name, capacity })));
  });

  app.get('/api/reservations', async (_req, res) => {
    res.json(await reservations.list());
  });

  app.post('/api/reservations', async (req, res) => {
    const validation = validateReservation(req.body, toIsoDate(now()));
    if (!validation.ok) {
      res.status(400).json({ error: 'validation', message: 'Données invalides.', details: validation.errors });
      return;
    }
    const result = await reservations.create(validation.value);
    if (!result.ok) {
      const { conflict } = result;
      res.status(409).json({
        error: 'conflict',
        message: `La salle ${conflict.room} est déjà réservée le ${conflict.date} de ${conflict.startTime} à ${conflict.endTime}.`,
      });
      return;
    }
    res.status(201).location(`/api/reservations/${result.reservation.id}`).json(result.reservation);
  });

  app.delete('/api/reservations/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || id > MAX_ID) {
      res.status(400).json({ error: 'validation', message: "L'identifiant doit être un entier positif." });
      return;
    }
    if (!(await reservations.cancel(id))) {
      res.status(404).json({ error: 'not_found', message: `Réservation ${id} introuvable.` });
      return;
    }
    res.status(204).end();
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route inconnue.' });
  });

  app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'validation', message: 'Le corps de la requête doit être un JSON valide.' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'internal', message: 'Erreur interne.' });
  });

  return app;
}
