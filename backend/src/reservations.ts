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

// Dates et heures formatées par PostgreSQL : aucune conversion de fuseau côté Node
const COLUMNS = `
  id, customer_name, email, room,
  to_char(date, 'YYYY-MM-DD') AS date,
  to_char(start_time, 'HH24:MI') AS start_time,
  to_char(end_time, 'HH24:MI') AS end_time,
  participants, status,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`;

interface ReservationRow {
  id: number;
  customer_name: string;
  email: string;
  room: string;
  date: string;
  start_time: string;
  end_time: string;
  participants: number;
  status: ReservationStatus;
  created_at: string;
}

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    customerName: row.customer_name,
    email: row.email,
    room: row.room,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    participants: row.participants,
    status: row.status,
    createdAt: row.created_at,
  };
}

export type CreateResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; conflict: Reservation };

export class ReservationRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Reservation[]> {
    const { rows } = await this.db.query<ReservationRow>(
      `SELECT ${COLUMNS} FROM reservations ORDER BY reservations.date, reservations.start_time, id`,
    );
    return rows.map(toReservation);
  }

  async create(input: NewReservation, status: ReservationStatus = 'confirmed'): Promise<CreateResult> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Sérialise les créations sur une même salle et un même jour
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${input.room}|${input.date}`]);

      if (status === 'confirmed') {
        // Deux créneaux se chevauchent si l'un commence avant la fin de l'autre
        const overlap = await client.query<ReservationRow>(
          `SELECT ${COLUMNS} FROM reservations
           WHERE room = $1 AND reservations.date = $2 AND status = 'confirmed'
             AND reservations.start_time < $3 AND reservations.end_time > $4
           LIMIT 1`,
          [input.room, input.date, input.endTime, input.startTime],
        );
        if (overlap.rows[0]) {
          await client.query('ROLLBACK');
          return { ok: false, conflict: toReservation(overlap.rows[0]) };
        }
      }

      const { rows } = await client.query<ReservationRow>(
        `INSERT INTO reservations (customer_name, email, room, date, start_time, end_time, participants, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUMNS}`,
        [
          input.customerName,
          input.email,
          input.room,
          input.date,
          input.startTime,
          input.endTime,
          input.participants,
          status,
        ],
      );
      await client.query('COMMIT');
      return { ok: true, reservation: toReservation(rows[0]!) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Annulation logique : la réservation reste visible avec le statut "cancelled"
  async cancel(id: number): Promise<boolean> {
    const result = await this.db.query("UPDATE reservations SET status = 'cancelled' WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
