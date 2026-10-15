/**
 * Liens de réservation : dates du séjour, nombre de personnes, encodage.
 */
import { describe, expect, it } from 'vitest';

import { activityUrl, lodgingUrl, placeName, stayDates, transportUrl } from '../src/lib/booking.ts';

const dates = stayDates('2027-05-14', 2);

describe('liens de réservation', () => {
  it('le séjour va du vendredi au dimanche, même à cheval sur deux mois', () => {
    expect(dates).toEqual({ checkin: '2027-05-14', checkout: '2027-05-16' });
    expect(stayDates('2027-04-30', 2)).toEqual({ checkin: '2027-04-30', checkout: '2027-05-02' });
  });

  it('garde le lieu principal d’un nom de destination composé', () => {
    expect(placeName('Amboise & les châteaux')).toBe('Amboise');
    expect(placeName('Annecy')).toBe('Annecy');
  });

  it('Booking : toute la bande, deux personnes par chambre', () => {
    const url = new URL(lodgingUrl('Annecy', dates, 15));
    expect(url.hostname).toBe('www.booking.com');
    expect(url.searchParams.get('ss')).toBe('Annecy');
    expect(url.searchParams.get('checkin')).toBe('2027-05-14');
    expect(url.searchParams.get('checkout')).toBe('2027-05-16');
    expect(url.searchParams.get('group_adults')).toBe('15');
    expect(url.searchParams.get('no_rooms')).toBe('8');
  });

  it('activité : recherche sur le nom et le lieu, aux dates du séjour', () => {
    const url = new URL(activityUrl('Musée d’Orsay', 'Paris', dates));
    expect(url.searchParams.get('q')).toBe('Musée d’Orsay Paris');
    expect(url.searchParams.get('date_from')).toBe('2027-05-14');
  });

  it('trajet : un site par mode, depuis ma ville', () => {
    expect(transportUrl('train', 'Paris', 'Saint-Sébastien', dates).url).toBe(
      'https://www.trainline.fr/search/paris/saint-sebastien/2027-05-14-17:00',
    );
    expect(new URL(transportUrl('bus', 'Lyon', 'Annecy', dates).url).searchParams.get('fn')).toBe('Lyon');
    expect(transportUrl('plane', 'Paris', 'Ajaccio', dates).site).toBe('Google Vols');
    expect(new URL(transportUrl('car', 'Lille', 'Bruges', dates).url).searchParams.get('travelmode')).toBe('driving');
  });
});
