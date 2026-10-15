/**
 * Génère la matrice initiale ville de départ × destination (supabase/functions/_shared/data/routes.ts).
 *
 * C'est un OUTIL D'AMORÇAGE : heuristiques distance → durée/coût par mode, corrigées par des
 * temps de train connus. Une fois généré, routes.ts fait foi et s'édite à la main.
 * Relancer écrase routes.ts : `node scripts/generate-routes.ts --force`
 * Ajouter des villes sans toucher aux lignes existantes (retouchées à la main) :
 * `node scripts/generate-routes.ts --ajouter=rennes,grenoble`
 *
 * Unités : durée aller simple (minutes), coût aller-retour par personne (€).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CITIES } from '../supabase/functions/_shared/data/cities.ts';
import { DESTINATIONS } from '../supabase/functions/_shared/data/destinations.ts';

type Speed = 'lgv' | 'mixed' | 'slow';
interface Access {
  train: { speed: Speed; lastMile?: number; intl?: boolean } | null;
  /** minutes aéroport → destination ; null = pas d'aéroport pertinent */
  air: number | null;
  bus: boolean;
  car: boolean;
  carExtra?: { minutes: number; cost: number };
  /** île : l'avion reste pertinent même sur courte distance (pas d'alternative terrestre) */
  island?: boolean;
}

const ACCESS: Record<string, Access> = {
  paris: { train: { speed: 'lgv' }, air: 35, bus: true, car: true },
  lyon: { train: { speed: 'lgv' }, air: 40, bus: true, car: true },
  marseille: { train: { speed: 'lgv' }, air: 35, bus: true, car: true },
  bordeaux: { train: { speed: 'lgv' }, air: 30, bus: true, car: true },
  lille: { train: { speed: 'lgv' }, air: 30, bus: true, car: true },
  nantes: { train: { speed: 'lgv' }, air: 30, bus: true, car: true },
  toulouse: { train: { speed: 'mixed' }, air: 30, bus: true, car: true },
  strasbourg: { train: { speed: 'lgv' }, air: 30, bus: true, car: true },
  montpellier: { train: { speed: 'lgv' }, air: 30, bus: true, car: true },
  nice: { train: { speed: 'mixed' }, air: 25, bus: true, car: true },
  biarritz: { train: { speed: 'mixed' }, air: 15, bus: true, car: true },
  hossegor: { train: { speed: 'mixed', lastMile: 40 }, air: 45, bus: true, car: true },
  arcachon: { train: { speed: 'mixed' }, air: 60, bus: true, car: true },
  'la-rochelle': { train: { speed: 'mixed' }, air: null, bus: true, car: true },
  'saint-malo': { train: { speed: 'mixed' }, air: null, bus: true, car: true },
  etretat: { train: { speed: 'slow', lastMile: 60 }, air: null, bus: true, car: true },
  deauville: { train: { speed: 'slow' }, air: null, bus: true, car: true },
  annecy: { train: { speed: 'mixed' }, air: 60, bus: true, car: true },
  chamonix: { train: { speed: 'slow', lastMile: 45 }, air: 75, bus: true, car: true },
  gerardmer: { train: { speed: 'slow', lastMile: 50 }, air: null, bus: false, car: true },
  verdon: { train: null, air: null, bus: false, car: true },
  cassis: { train: { speed: 'mixed', lastMile: 30 }, air: 50, bus: true, car: true },
  'aix-en-provence': { train: { speed: 'lgv', lastMile: 20 }, air: 25, bus: true, car: true },
  luberon: { train: { speed: 'mixed', lastMile: 50 }, air: null, bus: false, car: true },
  carcassonne: { train: { speed: 'mixed' }, air: 25, bus: true, car: true },
  collioure: { train: { speed: 'slow', lastMile: 20 }, air: 50, bus: true, car: true },
  sarlat: { train: { speed: 'slow' }, air: null, bus: false, car: true },
  amboise: { train: { speed: 'mixed' }, air: null, bus: false, car: true },
  reims: { train: { speed: 'lgv' }, air: null, bus: true, car: true },
  beaune: { train: { speed: 'mixed' }, air: null, bus: true, car: true },
  colmar: { train: { speed: 'lgv' }, air: 60, bus: true, car: true },
  ajaccio: { train: null, air: 20, bus: false, car: false, island: true },
  bruxelles: { train: { speed: 'lgv', intl: true }, air: 30, bus: true, car: true },
  bruges: { train: { speed: 'mixed', intl: true }, air: null, bus: true, car: true },
  amsterdam: { train: { speed: 'lgv', intl: true }, air: 30, bus: true, car: true },
  londres: {
    train: { speed: 'lgv', intl: true },
    air: 45,
    bus: true,
    car: true,
    carExtra: { minutes: 75, cost: 70 },
  },
  barcelone: { train: { speed: 'lgv', intl: true }, air: 35, bus: true, car: true },
  'saint-sebastien': { train: { speed: 'mixed', intl: true, lastMile: 30 }, air: 30, bus: true, car: true },
  lisbonne: { train: null, air: 30, bus: false, car: true },
  porto: { train: null, air: 30, bus: false, car: true },
};

/** Temps de train connus (minutes, aller simple, dernier kilomètre inclus). Symétriques. */
const TRAIN_KNOWN: Record<string, Record<string, number>> = {
  paris: {
    lyon: 120, marseille: 190, bordeaux: 125, lille: 62, nantes: 125, toulouse: 260,
    strasbourg: 110, montpellier: 210, nice: 345, biarritz: 250, hossegor: 290, arcachon: 195,
    'la-rochelle': 175, 'saint-malo': 140, etretat: 190, deauville: 125, annecy: 225,
    chamonix: 345, gerardmer: 190, cassis: 225, 'aix-en-provence': 200, luberon: 210,
    carcassonne: 330, collioure: 340, sarlat: 320, amboise: 105, reims: 46, beaune: 140,
    colmar: 140, bruxelles: 82, bruges: 150, amsterdam: 200, londres: 140, barcelone: 400,
    'saint-sebastien': 330,
  },
  lyon: {
    marseille: 100, montpellier: 105, lille: 180, strasbourg: 230, nantes: 290, bordeaux: 300,
    toulouse: 270, nice: 270, annecy: 120, chamonix: 210, 'aix-en-provence': 90, cassis: 135,
    luberon: 120, beaune: 90, colmar: 230, bruxelles: 230, barcelone: 300, carcassonne: 210,
    collioure: 250, gerardmer: 300, reims: 220, amsterdam: 420, londres: 300,
  },
  marseille: {
    nice: 160, cassis: 25, 'aix-en-provence': 40, montpellier: 100, toulouse: 230, bordeaux: 360,
    carcassonne: 190, collioure: 220, luberon: 80, lille: 300, strasbourg: 330, nantes: 400,
    barcelone: 270, annecy: 270,
  },
  bordeaux: {
    arcachon: 50, biarritz: 125, hossegor: 120, toulouse: 125, 'la-rochelle': 140, sarlat: 165,
    nantes: 240, 'saint-sebastien': 200, lille: 280, montpellier: 250, carcassonne: 175,
    collioure: 290, amboise: 160,
  },
  lille: {
    bruxelles: 35, bruges: 90, londres: 82, amsterdam: 160, reims: 100, strasbourg: 200,
    nantes: 240,
  },
  nantes: { 'la-rochelle': 110, 'saint-malo': 180, amboise: 120 },
  toulouse: {
    carcassonne: 45, montpellier: 130, collioure: 170, biarritz: 230, sarlat: 210,
    barcelone: 200, 'saint-sebastien': 270,
  },
  strasbourg: { colmar: 30, gerardmer: 140, reims: 110, bruxelles: 280, amsterdam: 340, beaune: 170, annecy: 280 },
  montpellier: {
    carcassonne: 75, collioure: 115, nice: 260, barcelone: 175, 'aix-en-provence': 75, cassis: 140,
    luberon: 110, lille: 285,
  },
  nice: { cassis: 190, 'aix-en-provence': 185 },
  rennes: { paris: 90, 'saint-malo': 55, nantes: 75, lille: 200, lyon: 235, 'la-rochelle': 190 },
  grenoble: { paris: 180, lyon: 80, annecy: 115, chamonix: 200, marseille: 180, 'aix-en-provence': 170 },
};

function knownTrain(a: string, b: string): number | undefined {
  return TRAIN_KNOWN[a]?.[b] ?? TRAIN_KNOWN[b]?.[a];
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);
const round1 = (x: number) => Math.round(x);

function trainMinutes(from: string, to: string, d: number, acc: Access): number | null {
  if (!acc.train) return null;
  const known = knownTrain(from, to);
  if (known !== undefined) return known;
  const { speed, lastMile = 0 } = acc.train;
  const originIsParis = from === 'paris';
  const base =
    speed === 'lgv'
      ? originIsParis
        ? (d / 200) * 60 + 15
        : (d / 120) * 60 + 45
      : speed === 'mixed'
        ? originIsParis
          ? (d / 150) * 60 + 25
          : (d / 105) * 60 + 50
        : originIsParis
          ? (d / 95) * 60 + 30
          : (d / 85) * 60 + 55;
  return base + lastMile;
}

type Row = Partial<Record<'train' | 'car' | 'plane' | 'bus', [number, number]>>;

function route(from: (typeof CITIES)[number], dest: (typeof DESTINATIONS)[number]): Row {
  const acc = ACCESS[dest.id];
  if (!acc) throw new Error(`ACCESS manquant pour ${dest.id}`);
  const d = distanceKm(from.lat, from.lng, dest.lat, dest.lng);
  const road = d * 1.2;
  const row: Row = {};

  const train = trainMinutes(from.id, dest.id, d, acc);
  if (train !== null && d < 1300) {
    const railKm = d * 1.15;
    const intl = acc.train?.intl ? 1.35 : 1;
    const cost = Math.min(260, 2 * (8 + 0.1 * railKm) * intl);
    row.train = [round5(train), round1(cost)];
  }

  if (acc.car) {
    let minutes = road < 120 ? (road / 70) * 60 + 10 : (road / 100) * 60 + 15;
    // coût partagé à 3 : carburant (0,09 €/km) + péages (0,065 €/km), aller-retour
    let cost = (road * 2 * 0.155) / 3;
    if (acc.carExtra) {
      minutes += acc.carExtra.minutes;
      cost += acc.carExtra.cost;
    }
    row.car = [round5(minutes), round1(cost)];
  }

  if (acc.bus && d < 1100) {
    const minutes = (road / 72) * 60 + 30;
    const cost = 2 * (6 + 0.035 * road);
    row.bus = [round5(minutes), round1(cost)];
  }

  // Avion : seulement si utile (> 400 km) et pas de train de moins de 2h30 (loi Climat).
  if (acc.air !== null && (d > 400 || acc.island) && (train === null || train > 150)) {
    const minutes = 135 + (d / 750) * 60 + acc.air;
    const cost = 2 * (30 + 0.075 * d);
    row.plane = [round5(minutes), round1(cost)];
  }
  return row;
}

const out = join(process.cwd(), 'supabase/functions/_shared/data/routes.ts');

function cityLines(city: (typeof CITIES)[number]): string[] {
  const lines = [`  ${/^[a-z]+$/.test(city.id) ? city.id : `'${city.id}'`}: {`];
  for (const dest of DESTINATIONS) {
    if (dest.homeCity === city.id) continue;
    const row = route(city, dest);
    const parts = (['train', 'car', 'bus', 'plane'] as const)
      .filter((m) => row[m])
      .map((m) => `${m}: [${row[m]![0]}, ${row[m]![1]}]`);
    const key = /^[a-z]+$/.test(dest.id) ? dest.id : `'${dest.id}'`;
    lines.push(`    ${key}: { ${parts.join(', ')} },`);
  }
  lines.push('  },');
  return lines;
}

const addArg = process.argv.find((a) => a.startsWith('--ajouter='));
if (addArg) {
  const ids = addArg.slice('--ajouter='.length).split(',').filter(Boolean);
  let current = readFileSync(out, 'utf8');
  for (const id of ids) {
    const city = CITIES.find((c) => c.id === id);
    if (!city) throw new Error(`Ville inconnue dans cities.ts : ${id}`);
    if (new RegExp(`^  '?${id}'?: \\{`, 'm').test(current)) throw new Error(`${id} est déjà dans routes.ts`);
    const end = current.lastIndexOf('};');
    current = current.slice(0, end) + cityLines(city).join('\n') + '\n' + current.slice(end);
  }
  writeFileSync(out, current);
  console.log(`✅ ${ids.join(', ')} ajouté(s) à ${out}`);
  process.exit(0);
}
if (existsSync(out) && !process.argv.includes('--force')) {
  console.error('routes.ts existe déjà (il fait foi). Utilise --force pour l’écraser.');
  process.exit(1);
}

const lines: string[] = [];
lines.push(`/**
 * Matrice ville de départ × destination — ESTIMATIONS, ÉDITABLES À LA MAIN.
 *
 * Format : mode → [durée aller simple en minutes, coût aller-retour par personne en €]
 * - voiture : carburant + péages partagés à 3 par véhicule
 * - avion : inclut ~2h15 d'aéroport (trajets, contrôles, embarquement)
 * - un mode absent = non pertinent (pas de gare, île, trop loin…)
 *
 * Amorcée par scripts/generate-routes.ts (heuristiques + temps de train connus) ;
 * ce fichier fait désormais foi. Pour brancher des prix réels plus tard, implémenter
 * l'interface Catalog (engine/types.ts) sans toucher au moteur.
 */
import type { CityId, TransportMode } from '../engine/types.ts';

export type RouteTable = Record<
  CityId,
  Record<string, Partial<Record<TransportMode, readonly [number, number]>>>
>;

// prettier-ignore
export const ROUTES: RouteTable = {`);
for (const city of CITIES) lines.push(...cityLines(city));
lines.push('};');
writeFileSync(out, lines.join('\n') + '\n');
console.log(`✅ ${out} généré (${CITIES.length} villes × ${DESTINATIONS.length} destinations)`);
