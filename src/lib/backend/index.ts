import { isDemo } from '@/lib/env';

import { createDemoBackend } from './demo';
import { createSupabaseBackend } from './supabase';
import type { Backend } from './types';

export * from './types';

/** Un seul point d'accès aux données pour toute l'app (Supabase, ou simulation locale en démo). */
export const backend: Backend = isDemo ? createDemoBackend() : createSupabaseBackend();
