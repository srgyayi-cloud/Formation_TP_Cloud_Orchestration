import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DEFAULT_DATABASE_URL } from '../src/config.js';
import { createDatabase, migrate } from '../src/db.js';
import { resetDatabase } from '../src/seed.js';

// Tests d'intégration : nécessitent un PostgreSQL (docker compose up -d db)
const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

// Date figée : les tests ne dépendent pas du jour d'exécution
const NOW = new Date('2030-01-10T08:00:00Z');

const valid = {
  customerName: 'Ada Test',
  email: 'ada@example.com',
  room: 'Hopper',
  date: '2030-01-20',
  startTime: '09:00',
  endTime: '10:00',
  participants: 3,
};

const db = createDatabase(DATABASE_URL);
const app = createApp({ db, config: { appVersion: '9.9.9', gitCommit: 'abc1234' }, now: () => NOW, logRequests: false });

beforeAll(async () => {
  await migrate(db);
});

beforeEach(async () => {
  await resetDatabase(db, NOW);
});

afterAll(async () => {
  await db.end();
});

describe('santé et version', () => {
  it('GET /health/live répond 200', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready vérifie la base', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('ok');
  });

  it('GET /health/ready répond 503 si la base est injoignable', async () => {
    const unreachable = createDatabase('postgres://nobody:nobody@127.0.0.1:1/nothing');
    const res = await request(createApp({ db: unreachable, config: { appVersion: 'x', gitCommit: 'x' }, logRequests: false })).get(
      '/health/ready',
    );
    await unreachable.end();
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('error');
  });

  it('GET /version renvoie la version configurée', async () => {
    const res = await request(app).get('/version');
    expect(res.body).toEqual({ version: '9.9.9', commit: 'abc1234' });
  });
});

describe('réservations', () => {
  it('liste les réservations initiales dans l’ordre chronologique', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toMatchObject({ date: '2030-01-11', startTime: '09:00', endTime: '12:00' });
    expect(res.body[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('crée une réservation valide', async () => {
    const res = await request(app).post('/api/reservations').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...valid, status: 'confirmed' });
    expect(res.headers.location).toBe(`/api/reservations/${res.body.id}`);
  });

  it('refuse des champs invalides avec le détail des erreurs', async () => {
    const res = await request(app).post('/api/reservations').send({ ...valid, email: 'pas-un-email' });
    expect(res.status).toBe(400);
    expect(res.body.details.email).toBeDefined();
  });

  it('refuse un créneau qui chevauche une réservation confirmée', async () => {
    await request(app).post('/api/reservations').send(valid);
    const res = await request(app).post('/api/reservations').send({ ...valid, startTime: '09:30', endTime: '11:00' });
    expect(res.status).toBe(409);
  });

  it('accepte un créneau contigu', async () => {
    await request(app).post('/api/reservations').send(valid);
    const res = await request(app).post('/api/reservations').send({ ...valid, startTime: '10:00', endTime: '11:00' });
    expect(res.status).toBe(201);
  });

  it('ne crée qu’une réservation sur deux demandes simultanées du même créneau', async () => {
    const [a, b] = await Promise.all([
      request(app).post('/api/reservations').send(valid),
      request(app).post('/api/reservations').send(valid),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('annule une réservation', async () => {
    const res = await request(app).delete('/api/reservations/1');
    expect(res.status).toBe(204);
    const list = await request(app).get('/api/reservations');
    expect(list.body.find((r: { id: number }) => r.id === 1).status).toBe('cancelled');
  });

  it('répond 404 pour une réservation inconnue', async () => {
    const res = await request(app).delete('/api/reservations/999');
    expect(res.status).toBe(404);
  });

  it('répond 400 pour un identifiant hors limites', async () => {
    const res = await request(app).delete('/api/reservations/99999999999');
    expect(res.status).toBe(400);
  });

  it('répond 400 pour un JSON mal formé', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Content-Type', 'application/json')
      .send('{"customerName":');
    expect(res.status).toBe(400);
  });
});
