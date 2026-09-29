import type { Database } from './db.js';
import { ReservationRepository, type NewReservation, type ReservationStatus } from './reservations.js';

interface SeedEntry extends Omit<NewReservation, 'date'> {
  inDays: number;
  status?: ReservationStatus;
}

// Dates relatives au jour du lancement : les données restent toujours dans le futur
const SEED: SeedEntry[] = [
  { customerName: 'Alice Martin', email: 'alice.martin@example.com', room: 'Turing', inDays: 1, startTime: '09:00', endTime: '12:00', participants: 8 },
  { customerName: 'Karim Benali', email: 'karim.benali@example.com', room: 'Lovelace', inDays: 1, startTime: '14:00', endTime: '17:30', participants: 12 },
  { customerName: 'Sophie Durand', email: 'sophie.durand@example.com', room: 'Hopper', inDays: 2, startTime: '09:30', endTime: '11:00', participants: 4 },
  { customerName: 'Thomas Petit', email: 'thomas.petit@example.com', room: 'Turing', inDays: 3, startTime: '13:00', endTime: '18:00', participants: 10 },
  { customerName: 'Léa Moreau', email: 'lea.moreau@example.com', room: 'Lovelace', inDays: 5, startTime: '09:00', endTime: '17:00', participants: 15, status: 'cancelled' },
  { customerName: 'Julien Roux', email: 'julien.roux@example.com', room: 'Hopper', inDays: 7, startTime: '10:00', endTime: '12:00', participants: 6 },
];

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return toIsoDate(copy);
}

export function seedIfEmpty(db: Database, now: Date = new Date()): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM reservations').get();
  if (Number(row?.count ?? 0) > 0) return 0;

  const repository = new ReservationRepository(db);
  for (const { inDays, status, ...entry } of SEED) {
    repository.create({ ...entry, date: addDays(now, inDays) }, status);
  }
  return SEED.length;
}

export function resetDatabase(db: Database, now: Date = new Date()): number {
  db.exec("DELETE FROM reservations; DELETE FROM sqlite_sequence WHERE name = 'reservations';");
  return seedIfEmpty(db, now);
}
