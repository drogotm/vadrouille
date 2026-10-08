/** Intégrité des données seed (éditées à la main : ces tests attrapent les fautes de frappe). */
import { describe, expect, it } from 'vitest';

import {
  CADRES,
  CITIES,
  CITY_IDS,
  DESTINATIONS,
  ENVIES,
  seedCatalog,
  TRANSPORT_MODES,
} from '../../supabase/functions/_shared/engine/index.ts';
import { ROUTES } from '../../supabase/functions/_shared/data/routes.ts';

describe('données seed', () => {
  it('~40 destinations aux identifiants uniques', () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(38);
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(DESTINATIONS.length);
  });

  it('les 8 villes de départ du brief', () => {
    expect(CITIES.map((c) => c.id).sort()).toEqual([...CITY_IDS].sort());
    expect(CITIES).toHaveLength(8);
  });

  it('chaque destination est complète et ses tags sont valides', () => {
    for (const d of DESTINATIONS) {
      expect(d.name, d.id).not.toBe('');
      expect(d.cadres.length, d.id).toBeGreaterThan(0);
      for (const c of d.cadres) expect(CADRES, d.id).toContain(c);
      expect(Object.keys(d.envies).length, d.id).toBeGreaterThan(0);
      for (const e of Object.keys(d.envies)) expect(ENVIES, d.id).toContain(e);
      expect(d.ambiance).toBeGreaterThanOrEqual(0);
      expect(d.ambiance).toBeLessThanOrEqual(1);
      expect(d.activities.length, d.id).toBeGreaterThanOrEqual(3);
      expect(d.restaurants.length, d.id).toBeGreaterThanOrEqual(2);
      for (const color of d.colors) expect(color, d.id).toMatch(/^#[0-9A-F]{6}$/i);
      expect(d.pitch.length, d.id).toBeGreaterThan(10);
    }
  });

  it('la matrice couvre chaque ville × destination avec des valeurs plausibles', () => {
    for (const city of CITIES) {
      for (const d of DESTINATIONS) {
        if (d.homeCity === city.id) continue;
        const row = ROUTES[city.id][d.id];
        expect(row, `${city.id} → ${d.id}`).toBeDefined();
        const modes = Object.keys(row);
        expect(modes.length, `${city.id} → ${d.id}`).toBeGreaterThan(0);
        for (const m of modes) {
          expect(TRANSPORT_MODES).toContain(m);
          const [minutes, cost] = row[m as keyof typeof row]!;
          expect(minutes).toBeGreaterThan(0);
          expect(minutes).toBeLessThan(24 * 60);
          expect(cost).toBeGreaterThan(0);
          expect(cost).toBeLessThan(600);
        }
      }
    }
  });

  it('quelques repères réalistes (estimations)', () => {
    expect(seedCatalog.route('paris', 'bordeaux', 'train')?.minutes).toBe(125);
    expect(seedCatalog.route('lille', 'bruxelles', 'train')?.minutes).toBe(35);
    expect(seedCatalog.route('paris', 'ajaccio', 'train')).toBeNull();
    // loi Climat : pas d'avion quand le train fait moins de 2h30
    expect(seedCatalog.route('paris', 'lyon', 'plane')).toBeNull();
  });
});
