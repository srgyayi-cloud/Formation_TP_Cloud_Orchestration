import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDatabase, type Database } from '../src/db.js';
import { seedIfEmpty } from '../src/seed.js';

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

let db: Database;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedIfEmpty(db, NOW);
  app = createApp({ db, config: { appVersion: '9.9.9', gitCommit: 'abc1234' }, now: () => NOW, logRequests: false });
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

  it('GET /health/ready répond 503 si la base est fermée', async () => {
    db.close();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('error');
  });

  it('GET /version renvoie la version configurée', async () => {
    const res = await request(app).get('/version');
    expect(res.body).toEqual({ version: '9.9.9', commit: 'abc1234' });
  });
});

describe('réservations', () => {
  it('liste les réservations initiales', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body[0].date).toBe('2030-01-11');
  });

  it('crée une réservation valide', async () => {
    const res = await request(app).post('/api/reservations').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...valid, status: 'confirmed' });
    expect(res.headers.location).toBe(`/api/reservations/${res.body.id}`);
  });

  it('refuse des champs invalides avec le détail des erreurs', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({ customerName: 'A', email: 'pas-un-email', room: 'Inconnue', date: '2030-02-30', startTime: '10:00', endTime: '09:00', participants: 0 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual(
      ['customerName', 'date', 'email', 'endTime', 'participants', 'room'].sort(),
    );
  });

  it('refuse une date passée', async () => {
    const res = await request(app).post('/api/reservations').send({ ...valid, date: '2030-01-09' });
    expect(res.status).toBe(400);
    expect(res.body.details.date).toMatch(/passé/);
  });

  it('refuse un nombre de participants supérieur à la capacité', async () => {
    const res = await request(app).post('/api/reservations').send({ ...valid, participants: 9 });
    expect(res.status).toBe(400);
    expect(res.body.details.participants).toBeDefined();
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

  it('répond 400 pour un JSON mal formé', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Content-Type', 'application/json')
      .send('{"customerName":');
    expect(res.status).toBe(400);
  });
});
