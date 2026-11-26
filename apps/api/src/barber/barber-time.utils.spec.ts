import { describe, expect, it } from 'vitest';
import {
  instantToLocalDateTime,
  localDateTimeToInstant,
  weekday,
} from './barber-time.utils.js';

describe('organization local date and time conversion', () => {
  it('round trips Lisbon winter and summer local times', () => {
    for (const [date, time] of [
      ['2025-01-15', '10:30'],
      ['2025-07-15', '10:30'],
    ]) {
      const instant = localDateTimeToInstant(date, time, 'Europe/Lisbon');
      expect(instantToLocalDateTime(instant, 'Europe/Lisbon')).toEqual({
        date,
        time,
      });
    }
  });

  it('rejects nonexistent and ambiguous local times at DST transitions', () => {
    expect(() =>
      localDateTimeToInstant('2025-03-30', '01:30', 'Europe/Lisbon'),
    ).toThrow(/does not exist/);
    expect(() =>
      localDateTimeToInstant('2025-10-26', '01:30', 'Europe/Lisbon'),
    ).toThrow(/ambiguous/);
  });

  it('validates calendar dates and returns the weekday in local calendar terms', () => {
    expect(() =>
      localDateTimeToInstant('2025-02-30', '10:00', 'Europe/Lisbon'),
    ).toThrow(/date does not exist/);
    expect(weekday('2025-10-26')).toBe(0);
  });
});
