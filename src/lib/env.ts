/**
 * Variables publiques (EXPO_PUBLIC_*), inlinées au build. Aucune n'est secrète.
 * Accès en notation pointée obligatoire pour que Expo les remplace.
 */
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export const env = {
  supabaseUrl,
  supabaseKey,
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL ?? '').trim().replace(/\/$/, ''),
  appStoreUrl: (process.env.EXPO_PUBLIC_APP_STORE_URL ?? '').trim(),
};

/** Mode démo : backend local simulé (aucune donnée envoyée). */
export const isDemo =
  process.env.EXPO_PUBLIC_DEMO_MODE === '1' || supabaseUrl === '' || supabaseKey === '';
