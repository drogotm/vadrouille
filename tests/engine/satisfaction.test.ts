import { describe, expect, it } from 'vitest';

import { satisfaction as s } from '../../supabase/functions/_shared/engine/index.ts';

describe('satisfaction par critère', () => {
  it('budget : 1 dans le budget, 0,5 à +25 %, 0 à +50 %', () => {
    expect(s.budgetSatisfaction(200, 300)).toBe(1);
    expect(s.budgetSatisfaction(375, 300)).toBeCloseTo(0.5);
    expect(s.budgetSatisfaction(450, 300)).toBe(0);
    expect(s.budgetSatisfaction(900, 300)).toBe(0);
  });

  it('trajet : légère préférence pour le court, chute au-delà de la limite', () => {
    expect(s.travelTimeSatisfaction(0, 4)).toBe(1);
    expect(s.travelTimeSatisfaction(240, 4)).toBeCloseTo(0.75);
    expect(s.travelTimeSatisfaction(120, 4)).toBeGreaterThan(s.travelTimeSatisfaction(200, 4));
    expect(s.travelTimeSatisfaction(360, 4)).toBe(0);
  });

  it('facteur rédhibitoire : 1 dans la limite, plancher à +50 %', () => {
    expect(s.dealbreakerGate(100, 200, 0.4)).toBe(1);
    expect(s.dealbreakerGate(250, 200, 0.4)).toBeCloseTo(0.7);
    expect(s.dealbreakerGate(300, 200, 0.4)).toBeCloseTo(0.4);
    expect(s.dealbreakerGate(999, 200, 0.4)).toBeCloseTo(0.4);
  });

  it('cadre et envies : null sans préférence, sinon couverture', () => {
    expect(s.cadreSatisfaction([], ['mer'])).toBeNull();
    expect(s.cadreSatisfaction(['mer', 'ville'], ['ville'])).toBe(1);
    expect(s.cadreSatisfaction(['montagne'], ['mer'])).toBeCloseTo(0.15);
    expect(s.envieSatisfaction([], { fete: 3 })).toBeNull();
    expect(s.envieSatisfaction(['fete'], { fete: 3 })).toBeCloseTo(1);
    expect(s.envieSatisfaction(['fete', 'culture'], { fete: 3 })).toBeCloseTo(0.55);
    expect(s.envieSatisfaction(['sport'], { fete: 3 })).toBeCloseTo(0.1);
  });

  it('confort : mieux que prévu = presque parfait, moins bien = pénalisé', () => {
    expect(s.comfortSatisfaction(1, 1)).toBe(1);
    expect(s.comfortSatisfaction(2, 1)).toBeGreaterThan(s.comfortSatisfaction(0, 1));
    expect(s.comfortSatisfaction(0, 2)).toBeCloseTo(0.1);
  });

  it('météo : ignorée si peu importe, sinon proportionnelle au soleil', () => {
    expect(s.weatherSatisfaction(0, 0.1)).toBeNull();
    expect(s.weatherSatisfaction(3, 0.9)).toBeCloseTo(0.9);
    expect(s.weatherSatisfaction(1, 0.4)).toBeCloseTo(0.8);
  });

  it('ambiance : écart chill ↔ intense', () => {
    expect(s.ambianceSatisfaction(0.5, 0.5)).toBe(1);
    expect(s.ambianceSatisfaction(0, 0.8)).toBe(0);
  });
});
