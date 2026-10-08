/** API publique du moteur de décision (TypeScript pur, partagé app / Edge Function / tests). */
export * from './types.ts';
export * from './labels.ts';
export { decide, type EngineInput, type EngineMember } from './decide.ts';
export { DEFAULT_CONFIG, resolveConfig, type EngineConfig } from './config.ts';
export { parseAnswers, CITY_IDS, TRANSPORT_MODES, CADRES, ENVIES, CRITERIA } from './validate.ts';
export { seedCatalog, createSeedCatalog, getDestination } from './catalog.ts';
export { evaluateMember } from './evaluate.ts';
export * as satisfaction from './satisfaction.ts';
export { DESTINATIONS } from '../data/destinations.ts';
export { CITIES } from '../data/cities.ts';
