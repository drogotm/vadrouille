/**
 * Grille du calendrier des week-ends.
 */
import { describe, expect, it } from 'vitest';

import { monthWeeks } from '../src/lib/dates.ts';

describe('monthWeeks', () => {
  it('couvre le mois en semaines complètes, du lundi au dimanche', () => {
    const weeks = monthWeeks(2026, 10); // novembre 2026 : commence un dimanche
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[0][6]).toBe('2026-11-01');
    expect(weeks.at(-1)![6]).toBe('2026-12-06');
    for (const w of weeks) expect(w).toHaveLength(7);
  });

  it('vendredi, samedi et dimanche restent sur la même ligne, même à cheval sur deux mois', () => {
    const weeks = monthWeeks(2026, 9); // octobre 2026
    const row = weeks.find((w) => w[4] === '2026-10-30')!;
    expect(row.slice(4)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});
