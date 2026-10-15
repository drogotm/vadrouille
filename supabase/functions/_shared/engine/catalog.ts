/** Catalogue « seed » : implémentation de Catalog à partir des fichiers de data/. */
import { CITIES } from '../data/cities.ts';
import { ACTIVITY_FACTOR, FOOD_PER_DAY, LODGING_PER_NIGHT, SUNSHINE_BY_ZONE } from '../data/costs.ts';
import { DESTINATIONS } from '../data/destinations.ts';
import { ROUTES } from '../data/routes.ts';
import type { Catalog, Destination } from './types.ts';

/** Vélo : seulement pour une destination proche (km de route), à allure de balade chargée. */
export const BIKE_MAX_ROAD_KM = 100;
const BIKE_KMH = 18;

function roadKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  // vol d'oiseau × 1,2 ≈ distance par la route (même hypothèse que scripts/generate-routes.ts)
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1.2;
}

export function createSeedCatalog(): Catalog {
  const cityById = new Map(CITIES.map((c) => [c.id, c]));
  const destById = new Map(DESTINATIONS.map((d) => [d.id, d]));
  return {
    destinations: DESTINATIONS,
    cities: CITIES,
    route(from, destinationId, mode) {
      if (mode === 'bike') {
        const city = cityById.get(from);
        const dest = destById.get(destinationId);
        if (!city || !dest) return null;
        const km = roadKm(city.lat, city.lng, dest.lat, dest.lng);
        if (km > BIKE_MAX_ROAD_KM) return null;
        return { minutes: Math.max(15, Math.round(((km / BIKE_KMH) * 60) / 5) * 5), cost: 0 };
      }
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
