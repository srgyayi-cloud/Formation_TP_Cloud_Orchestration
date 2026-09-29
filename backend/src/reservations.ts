import type { Database } from './db.js';

export const ROOMS: Record<string, number> = {
  Turing: 12,
  Lovelace: 20,
  Hopper: 8,
};

export type ReservationStatus = 'confirmed' | 'cancelled';

export interface NewReservation {
  customerName: string;
  email: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: number;
}

export interface Reservation extends NewReservation {
  id: number;
  status: ReservationStatus;
  createdAt: string;
}

export type ValidationResult =
  | { ok: true; value: NewReservation }
  | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

// `today` au format YYYY-MM-DD : une réservation ne peut pas être dans le passé
export function validateReservation(body: unknown, today: string): ValidationResult {
  const errors: Record<string, string> = {};
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
  if (customerName.length < 2 || customerName.length > 100) {
    errors.customerName = 'Le nom doit contenir entre 2 et 100 caractères.';
  }

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) {
    errors.email = "L'adresse e-mail est invalide.";
  }

  const room = typeof input.room === 'string' ? input.room : '';
  const capacity = ROOMS[room];
  if (capacity === undefined) {
    errors.room = `La salle doit être l'une des suivantes : ${Object.keys(ROOMS).join(', ')}.`;
  }

  const date = typeof input.date === 'string' ? input.date : '';
  if (!isValidDate(date)) {
    errors.date = 'La date doit être au format AAAA-MM-JJ.';
  } else if (date < today) {
    errors.date = 'La date ne peut pas être dans le passé.';
  }

  const startTime = typeof input.startTime === 'string' ? input.startTime : '';
  const endTime = typeof input.endTime === 'string' ? input.endTime : '';
  if (!TIME.test(startTime)) {
    errors.startTime = "L'heure de début doit être au format HH:MM.";
  }
  if (!TIME.test(endTime)) {
    errors.endTime = "L'heure de fin doit être au format HH:MM.";
  } else if (TIME.test(startTime) && endTime <= startTime) {
    errors.endTime = "L'heure de fin doit être postérieure à l'heure de début.";
  }

  const participants = input.participants;
  if (typeof participants !== 'number' || !Number.isInteger(participants) || participants < 1) {
    errors.participants = 'Le nombre de participants doit être un entier positif.';
  } else if (capacity !== undefined && participants > capacity) {
    errors.participants = `La salle ${room} accueille au maximum ${capacity} personnes.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { customerName, email, room, date, startTime, endTime, participants: participants as number },
  };
}

function toReservation(row: Record<string, unknown>): Reservation {
  return {
    id: Number(row.id),
    customerName: String(row.customer_name),
    email: String(row.email),
    room: String(row.room),
    date: String(row.date),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    participants: Number(row.participants),
    status: row.status as ReservationStatus,
    createdAt: String(row.created_at),
  };
}

export type CreateResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; conflict: Reservation };

export class ReservationRepository {
  constructor(private readonly db: Database) {}

  list(): Reservation[] {
    return this.db
      .prepare('SELECT * FROM reservations ORDER BY date, start_time, id')
      .all()
      .map(toReservation);
  }

  findById(id: number): Reservation | undefined {
    const row = this.db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    return row ? toReservation(row) : undefined;
  }

  create(input: NewReservation, status: ReservationStatus = 'confirmed'): CreateResult {
    // Deux créneaux se chevauchent si l'un commence avant la fin de l'autre
    const overlap = this.db
      .prepare(
        `SELECT * FROM reservations
         WHERE room = ? AND date = ? AND status = 'confirmed'
           AND start_time < ? AND end_time > ?
         LIMIT 1`,
      )
      .get(input.room, input.date, input.endTime, input.startTime);
    if (overlap && status === 'confirmed') {
      return { ok: false, conflict: toReservation(overlap) };
    }

    const result = this.db
      .prepare(
        `INSERT INTO reservations (customer_name, email, room, date, start_time, end_time, participants, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.customerName,
        input.email,
        input.room,
        input.date,
        input.startTime,
        input.endTime,
        input.participants,
        status,
      );
    return { ok: true, reservation: this.findById(Number(result.lastInsertRowid))! };
  }

  // Annulation logique : la réservation reste visible avec le statut "cancelled"
  cancel(id: number): boolean {
    const result = this.db
      .prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?")
      .run(id);
    return Number(result.changes) > 0;
  }
}
