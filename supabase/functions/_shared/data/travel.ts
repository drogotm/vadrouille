import type { City, Destination, Route, TransportMode } from './types.ts';

/**
 * MATRICE VILLE DE DÉPART × DESTINATION — ESTIMATIONS.
 *
 * Deux couches :
 *  1. `MANUAL_ROUTES` : valeurs saisies à la main pour les liaisons connues (prioritaires).
 *  2. un modèle de distance (vol d'oiseau → durée et prix par mode) pour tout le reste.
 *
 * Pour brancher une source réelle (API SNCF, comparateur…), il suffit de fournir un autre
 * `getRoutes` au `Catalog` : le moteur ne connaît que le type `Route`.
 */

/** [minutes, € l'aller] par mode. Clé : `depart>destination`. Symétrique (voir lookupManual). */
type ManualEntry = Partial<Record<TransportMode, [number, number]>>;

export const MANUAL_ROUTES: Record<string, ManualEntry> = {
  // --- Depuis Paris (TGV / Eurostar) ---
  'paris>bordeaux': { train: [128, 55] },
  'paris>lyon': { train: [116, 50] },
  'paris>marseille': { train: [190, 65] },
  'paris>lille': { train: [62, 32] },
  'paris>nantes': { train: [125, 45] },
  'paris>toulouse': { train: [265, 60], plane: [225, 75] },
  'paris>strasbourg': { train: [107, 50] },
  'paris>rennes': { train: [90, 40] },
  'paris>montpellier': { train: [205, 65] },
  'paris>la-rochelle': { train: [175, 48] },
  'paris>saint-malo': { train: [140, 48] },
  'paris>biarritz': { train: [250, 65], plane: [215, 80] },
  'paris>annecy': { train: [225, 62] },
  'paris>nice': { train: [345, 75], plane: [225, 80] },
  'paris>avignon': { train: [160, 58] },
  'paris>aix': { train: [185, 62] },
  'paris>colmar': { train: [140, 55] },
  'paris>reims': { train: [46, 25] },
  'paris>tours': { train: [75, 30] },
  'paris>dijon': { train: [95, 35] },
  'paris>deauville': { train: [130, 28] },
  'paris>grenoble': { train: [180, 55] },
  'paris>bruxelles': { train: [82, 50] },
  'paris>bruges': { train: [155, 62] },
  'paris>amsterdam': { train: [200, 75] },
  'paris>londres': { train: [137, 90] },
  'paris>cologne': { train: [200, 65] },
  'paris>geneve': { train: [190, 70] },
  'paris>barcelone': { train: [400, 85], plane: [240, 85] },
  'paris>turin': { train: [340, 70] },
  // --- Autres liaisons courantes ---
  'lyon>marseille': { train: [100, 35] },
  'lyon>annecy': { train: [115, 25] },
  'lyon>grenoble': { train: [85, 20] },
  'lyon>geneve': { train: [115, 25] },
  'lyon>avignon': { train: [65, 28] },
  'lyon>montpellier': { train: [105, 35] },
  'lyon>dijon': { train: [95, 28] },
  'lyon>turin': { train: [230, 45] },
  'lyon>lille': { train: [180, 60] },
  'lyon>strasbourg': { train: [225, 50] },
  'marseille>nice': { train: [155, 30] },
  'marseille>aix': { train: [35, 9] },
  'marseille>avignon': { train: [35, 18] },
  'marseille>montpellier': { train: [100, 25] },
  'marseille>toulouse': { train: [240, 45] },
  'bordeaux>toulouse': { train: [125, 25] },
  'bordeaux>arcachon': { train: [52, 12] },
  'bordeaux>biarritz': { train: [125, 30] },
  'bordeaux>la-rochelle': { train: [140, 28] },
  'bordeaux>san-sebastian': { train: [195, 38] },
  'bordeaux>nantes': { train: [255, 40] },
  'lille>bruxelles': { train: [35, 25] },
  'lille>bruges': { train: [100, 22] },
  'lille>londres': { train: [85, 80] },
  'lille>amsterdam': { train: [165, 60] },
  'lille>reims': { train: [150, 40] },
  'nantes>la-rochelle': { train: [110, 25] },
  'nantes>rennes': { train: [75, 20] },
  'nantes>quiberon': { train: [165, 30] },
  'nantes>saint-malo': { train: [150, 32] },
  'toulouse>carcassonne': { train: [45, 15] },
  'toulouse>montpellier': { train: [130, 30] },
  'toulouse>collioure': { train: [165, 30] },
  'toulouse>barcelone': { train: [220, 45] },
  'strasbourg>colmar': { train: [30, 12] },
  'strasbourg>dijon': { train: [130, 35] },
  'strasbourg>cologne': { train: [215, 55] },
  'strasbourg>reims': { train: [100, 40] },
};

function lookupManual(cityId: string, destId: string): ManualEntry | undefined {
  return MANUAL_ROUTES[`${cityId}>${destId}`] ?? MANUAL_ROUTES[`${destId}>${cityId}`];
}

/** Distance à vol d'oiseau en km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Paramètres du modèle de distance — à ajuster ici, pas dans le moteur. */
export const TRAVEL_MODEL = {
  /** Sous cette distance, on est « sur place » : trajet gratuit et instantané. */
  localKm: 15,
  /** Détour moyen route/rail par rapport au vol d'oiseau. */
  detour: 1.25,
  car: { kmh: 95, overheadMin: 15, eurPerKm: 0.09 /* covoiturage à ~3 */ },
  tgv: { kmh: 190, overheadMin: 30, base: 12, eurPerKm: 0.105 },
  ter: { kmh: 95, overheadMin: 25, base: 5, eurPerKm: 0.1 },
  bus: { kmh: 75, overheadMin: 20, base: 5, eurPerKm: 0.045, maxMin: 600 },
  plane: { kmh: 700, overheadMin: 180, base: 45, eurPerKm: 0.06, minKm: 400 },
};

export function estimateRoutes(city: City, dest: Destination): Route[] {
  const km = distanceKm(city, dest);
  const M = TRAVEL_MODEL;
  if (km < M.localKm) {
    return (['train', 'car', 'bus'] as TransportMode[]).map((mode) => ({
      mode,
      minutes: 0,
      cost: 0,
      source: 'model' as const,
    }));
  }
  const ground = km * M.detour;
  const manual = lookupManual(city.id, dest.id) ?? {};
  const routes: Route[] = [];
  const add = (mode: TransportMode, minutes: number, cost: number) => {
    const m = manual[mode];
    routes.push(
      m
        ? { mode, minutes: m[0], cost: m[1], source: 'manual' }
        : { mode, minutes: round5(minutes), cost: Math.round(cost), source: 'model' },
    );
  };

  // La voiture est toujours possible : c'est le temps de trajet max de chacun qui arbitre.
  add('car', (ground / M.car.kmh) * 60 + M.car.overheadMin, ground * M.car.eurPerKm);

  if (dest.rail || manual.train) {
    const r = dest.rail === 'tgv' ? M.tgv : M.ter;
    add('train', (ground / r.kmh) * 60 + r.overheadMin, r.base + km * r.eurPerKm);
  }

  const busMin = (ground / M.bus.kmh) * 60 + M.bus.overheadMin;
  if ((dest.bus && busMin <= M.bus.maxMin) || manual.bus) {
    add('bus', busMin, M.bus.base + km * M.bus.eurPerKm);
  }

  if ((dest.airport && km >= M.plane.minKm) || manual.plane) {
    add('plane', (km / M.plane.kmh) * 60 + M.plane.overheadMin, M.plane.base + km * M.plane.eurPerKm);
  }
  return routes;
}
