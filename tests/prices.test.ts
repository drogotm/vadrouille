import { describe, expect, it } from 'vitest';

import { DESTINATIONS } from '../supabase/functions/_shared/engine/index.ts';
import { priceRange } from '../src/lib/prices.ts';

describe('fourchettes de prix estimées', () => {
  it('donne une fourchette pour chaque suggestion du seed qui a un niveau de prix', () => {
    for (const d of DESTINATIONS) {
      for (const a of d.activities) if (a.price) expect(priceRange(a.price, 'activity')).toMatch(/€$/);
      for (const r of d.restaurants) if (r.price) expect(priceRange(r.price, 'restaurant')).toMatch(/€$/);
    }
  });

  it('distingue activités et restos', () => {
    expect(priceRange('€', 'activity')).toBe('gratuit à 15 €');
    expect(priceRange('€€€', 'restaurant')).toBe('env. 40 à 80 €');
  });
});
