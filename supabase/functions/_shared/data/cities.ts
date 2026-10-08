import type { City } from './types.ts';

/** Villes de départ couvertes par le MVP. Ajouter une ville = ajouter une ligne ici. */
export const CITIES: City[] = [
  { id: 'paris', name: 'Paris', lat: 48.857, lon: 2.352 },
  { id: 'lyon', name: 'Lyon', lat: 45.764, lon: 4.836 },
  { id: 'marseille', name: 'Marseille', lat: 43.296, lon: 5.37 },
  { id: 'bordeaux', name: 'Bordeaux', lat: 44.838, lon: -0.579 },
  { id: 'lille', name: 'Lille', lat: 50.629, lon: 3.057 },
  { id: 'nantes', name: 'Nantes', lat: 47.218, lon: -1.554 },
  { id: 'toulouse', name: 'Toulouse', lat: 43.605, lon: 1.444 },
  { id: 'strasbourg', name: 'Strasbourg', lat: 48.573, lon: 7.752 },
];
