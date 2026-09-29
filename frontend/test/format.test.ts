import { describe, expect, it } from 'vitest';
import { formatDate, formatSlot, versionHue } from '../src/format';

describe('format', () => {
  it('formate une date ISO en français', () => {
    expect(formatDate('2030-01-11')).toBe('ven. 11 janv. 2030');
  });

  it('formate un créneau', () => {
    expect(formatSlot('09:00', '12:00')).toBe('09:00 – 12:00');
  });

  it('associe une teinte stable à chaque version', () => {
    expect(versionHue('1.0.0')).toBe(versionHue('1.0.0'));
    expect(versionHue('1.0.0')).not.toBe(versionHue('1.1.0'));
    expect(versionHue('2.3.4')).toBeGreaterThanOrEqual(0);
    expect(versionHue('2.3.4')).toBeLessThan(360);
  });
});
