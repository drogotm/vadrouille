/**
 * Point d'entrée du moteur côté app. Source de vérité partagée avec l'Edge Function :
 * supabase/functions/_shared (TypeScript pur, compatible Deno).
 */
export * from '../../supabase/functions/_shared/engine/index.ts';
export {
  computePermission,
  runCompute,
  toSavePayload,
  type ComputeInput,
} from '../../supabase/functions/_shared/compute.ts';
