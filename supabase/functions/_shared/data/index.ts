import { CITIES } from './cities.ts';
import { DESTINATIONS } from './destinations.ts';
import { estimateRoutes } from './travel.ts';
import type { Catalog, City, Destination, Route } from './types.ts';

export * from './types.ts';
export { CITIES } from './cities.ts';
export { DESTINATIONS } from './destinations.ts';
export { distanceKm, estimateRoutes, MANUAL_ROUTES, TRAVEL_MODEL } from './travel.ts';

/** Construit un catalogue (matrice de trajets mise en cache) à partir de listes brutes. */
export function buildCatalog(cities: City[], destinations: Destination[]): Catalog {
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const cache = new Map<string, Route[]>();
  return {
    cities,
    destinations,
    getRoutes(cityId, destinationId) {
      const key = `${cityId}>${destinationId}`;
      let routes = cache.get(key);
      if (!routes) {
        const city = cityById.get(cityId);
        const dest = destById.get(destinationId);
        routes = city && dest ? estimateRoutes(city, dest) : [];
        cache.set(key, routes);
      }
      return routes;
    },
  };
}

/** Catalogue seed du MVP (toutes les valeurs sont des estimations). */
export const SEED_CATALOG: Catalog = buildCatalog(CITIES, DESTINATIONS);
