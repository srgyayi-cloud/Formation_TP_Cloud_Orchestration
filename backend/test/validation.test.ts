import { describe, expect, it } from 'vitest';
import { validateReservation } from '../src/reservations.js';

// Tests unitaires : aucune base de données nécessaire
const TODAY = '2030-01-10';

const valid = {
  customerName: 'Ada Test',
  email: 'Ada@Example.com',
  room: 'Hopper',
  date: '2030-01-20',
  startTime: '09:00',
  endTime: '10:00',
  participants: 3,
};

describe('validateReservation', () => {
  it('accepte une réservation valide et normalise les champs', () => {
    const result = validateReservation({ ...valid, customerName: '  Ada Test  ' }, TODAY);
    expect(result).toEqual({ ok: true, value: { ...valid, customerName: 'Ada Test', email: 'ada@example.com' } });
  });

  it('signale chaque champ invalide', () => {
    const result = validateReservation(
      { customerName: 'A', email: 'pas-un-email', room: 'Inconnue', date: '2030-02-30', startTime: '10:00', endTime: '09:00', participants: 0 },
      TODAY,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ['customerName', 'date', 'email', 'endTime', 'participants', 'room'].sort(),
      );
    }
  });

  it('refuse une date passée', () => {
    const result = validateReservation({ ...valid, date: '2030-01-09' }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.date).toMatch(/passé/);
  });

  it('accepte une réservation le jour même', () => {
    expect(validateReservation({ ...valid, date: TODAY }, TODAY).ok).toBe(true);
  });

  it('refuse un nombre de participants supérieur à la capacité de la salle', () => {
    const result = validateReservation({ ...valid, participants: 9 }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.participants).toMatch(/8 personnes/);
  });

  it('refuse un corps absent ou non objet', () => {
    expect(validateReservation(null, TODAY).ok).toBe(false);
    expect(validateReservation('texte', TODAY).ok).toBe(false);
  });
});
