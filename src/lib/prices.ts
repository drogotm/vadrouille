import type { Suggestion } from '@/engine';

type Level = NonNullable<Suggestion['price']>;

/**
 * Fourchettes ESTIMÉES par personne pour un niveau de prix du seed (€, €€, €€€).
 * Ce sont des ordres de grandeur génériques, pas le tarif réel du lieu : à remplacer par une
 * vraie source de prix le jour où le catalogue en a une.
 */
const RANGES: Record<'activity' | 'restaurant', Record<Level, string>> = {
  activity: { '€': 'gratuit à 15 €', '€€': 'env. 15 à 40 €', '€€€': 'env. 40 à 90 €' },
  restaurant: { '€': 'env. 10 à 20 €', '€€': 'env. 20 à 40 €', '€€€': 'env. 40 à 80 €' },
};

export function priceRange(level: Level, kind: 'activity' | 'restaurant'): string {
  return RANGES[kind][level];
}
