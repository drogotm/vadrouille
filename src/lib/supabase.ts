import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isDemo } from '@/lib/env';

let client: SupabaseClient | null = null;

/** Client Supabase (clé publique uniquement). N'existe pas en mode démo. */
export function getSupabase(): SupabaseClient {
  if (isDemo) throw new Error('Supabase non configuré (mode démo)');
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    });
    if (Platform.OS !== 'web') {
      // Rafraîchit la session seulement quand l'app est au premier plan (recommandation Supabase).
      AppState.addEventListener('change', (state) => {
        if (state === 'active') client?.auth.startAutoRefresh();
        else client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}
