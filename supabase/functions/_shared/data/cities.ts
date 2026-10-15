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
  { id: 'montpellier', name: 'Montpellier', lat: 43.6108, lng: 3.8767 },
  { id: 'nice', name: 'Nice', lat: 43.7102, lng: 7.262 },
  { id: 'rennes', name: 'Rennes', lat: 48.1173, lng: -1.6778 },
  { id: 'grenoble', name: 'Grenoble', lat: 45.1885, lng: 5.7245 },
];
