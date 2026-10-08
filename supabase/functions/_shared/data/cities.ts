import type { DepartureCity } from '../engine/types.ts';

/** Villes de départ couvertes par le MVP. */
export const CITIES: readonly DepartureCity[] = [
  { id: 'paris', name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { id: 'lyon', name: 'Lyon', lat: 45.764, lng: 4.8357 },
  { id: 'marseille', name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { id: 'bordeaux', name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  { id: 'lille', name: 'Lille', lat: 50.6292, lng: 3.0573 },
  { id: 'nantes', name: 'Nantes', lat: 47.2184, lng: -1.5536 },
  { id: 'toulouse', name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  { id: 'strasbourg', name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
];
