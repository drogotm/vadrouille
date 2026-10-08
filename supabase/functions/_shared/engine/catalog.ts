/** Catalogue « seed » : implémentation de Catalog à partir des fichiers de data/. */
import { CITIES } from '../data/cities.ts';
import { ACTIVITY_FACTOR, FOOD_PER_DAY, LODGING_PER_NIGHT, SUNSHINE_BY_ZONE } from '../data/costs.ts';
import { DESTINATIONS } from '../data/destinations.ts';
import { ROUTES } from '../data/routes.ts';
import type { Catalog, Destination } from './types.ts';

export function createSeedCatalog(): Catalog {
  return {
    destinations: DESTINATIONS,
    cities: CITIES,
    route(from, destinationId, mode) {
      const entry = ROUTES[from]?.[destinationId]?.[mode];
      return entry ? { minutes: entry[0], cost: entry[1] } : null;
    },
    lodgingPerNight: (d, comfort) => LODGING_PER_NIGHT[comfort] * d.costIndex,
    foodPerDay: (d, comfort) => FOOD_PER_DAY[comfort] * d.costIndex,
    activities: (d, comfort) => d.activityCost * ACTIVITY_FACTOR[comfort],
    sunshine: (d, month) => SUNSHINE_BY_ZONE[d.climate][month - 1] ?? 0.5,
  };
}

export const seedCatalog: Catalog = createSeedCatalog();

const BY_ID = new Map(DESTINATIONS.map((d) => [d.id, d]));

export function getDestination(id: string): Destination | undefined {
  return BY_ID.get(id);
}
