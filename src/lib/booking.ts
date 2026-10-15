/**
 * Liens de réservation du plan du séjour.
 *
 * Ce sont des liens de RECHERCHE pré-remplis (destination, dates, nombre de personnes, ville de
 * départ) vers des sites publics : ils ne meurent pas quand une offre disparaît et ne demandent
 * aucune clé d'API. Rien n'est réservé par l'app, et aucune donnée privée ne quitte l'appareil
 * à part ce que la personne voit dans l'adresse.
 * TypeScript pur (aucune dépendance React Native) pour être testé par vitest.
 */
import type { TransportMode } from '../../supabase/functions/_shared/engine/types.ts';
import { shiftIso } from './dates.ts';

export interface StayDates {
  /** vendredi d'arrivée (AAAA-MM-JJ) */
  checkin: string;
  /** jour de départ (AAAA-MM-JJ) */
  checkout: string;
}

export function stayDates(fridayIso: string, nights: number): StayDates {
  return { checkin: fridayIso, checkout: shiftIso(fridayIso, nights) };
}

/** « Amboise & les châteaux » → « Amboise » : le lieu que comprennent les moteurs de recherche. */
export function placeName(destinationName: string): string {
  return destinationName.split(' & ')[0].trim();
}

const q = (params: Record<string, string | number>) =>
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

/** « Saint-Sébastien » → « saint-sebastien » */
function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Logement : Booking, toute la bande sur les dates du séjour (2 personnes par chambre). */
export function lodgingUrl(place: string, dates: StayDates, people: number): string {
  const adults = Math.max(1, people);
  return `https://www.booking.com/searchresults.fr.html?${q({
    ss: place,
    checkin: dates.checkin,
    checkout: dates.checkout,
    group_adults: adults,
    no_rooms: Math.ceil(adults / 2),
    group_children: 0,
  })}`;
}

/** Activité : recherche GetYourGuide sur le nom de l'activité et le lieu, aux dates du séjour. */
export function activityUrl(activity: string, place: string, dates: StayDates): string {
  return `https://www.getyourguide.fr/s/?${q({
    q: `${activity} ${place}`,
    date_from: dates.checkin,
    date_to: dates.checkout,
  })}`;
}

/** Trajet aller depuis MA ville, selon le mode retenu par le moteur pour moi. */
export function transportUrl(
  mode: TransportMode,
  fromCity: string,
  place: string,
  dates: StayDates,
): { url: string; site: string } {
  switch (mode) {
    case 'train':
      return {
        site: 'Trainline',
        url: `https://www.trainline.fr/search/${slug(fromCity)}/${slug(place)}/${dates.checkin}-17:00`,
      };
    case 'bus':
      return {
        site: 'BlaBlaCar',
        url: `https://www.blablacar.fr/search?${q({ fn: fromCity, tn: place, db: dates.checkin, seats: 1 })}`,
      };
    case 'plane':
      return {
        site: 'Google Vols',
        url: `https://www.google.com/travel/flights?${q({
          q: `Vols de ${fromCity} à ${place} le ${dates.checkin} retour ${dates.checkout}`,
          hl: 'fr',
        })}`,
      };
    case 'car':
      return {
        site: 'Google Maps',
        url: `https://www.google.com/maps/dir/?${q({
          api: 1,
          origin: fromCity,
          destination: place,
          travelmode: 'driving',
        })}`,
      };
    case 'bike':
      return {
        site: 'Google Maps',
        url: `https://www.google.com/maps/dir/?${q({
          api: 1,
          origin: fromCity,
          destination: place,
          travelmode: 'bicycling',
        })}`,
      };
  }
}
