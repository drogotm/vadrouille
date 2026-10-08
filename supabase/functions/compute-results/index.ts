/**
 * Edge Function `compute-results` — le calcul des 3 options se fait ICI, côté serveur.
 *
 * 1. authentifie l'appelant (JWT Supabase) ;
 * 2. lit TOUTES les réponses avec la clé service_role (jamais exposée au client) ;
 * 3. vérifie les droits (orga : à tout moment ; membre : quand tout le monde a répondu) ;
 * 4. exécute le moteur déterministe (supabase/functions/_shared/engine) ;
 * 5. (optionnel) fait rédiger les accroches par Claude à partir des seuls agrégats publics ;
 * 6. enregistre les agrégats publics + le détail privé de chaque membre (save_results).
 *
 * Le client ne reçoit qu'un statut : il relit ensuite les tables protégées par RLS.
 */
import { createClient } from '@supabase/supabase-js';

import { computePermission, type ComputeInput, runCompute, toSavePayload } from '../_shared/compute.ts';
import { writePitches } from './pitch.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'not_authenticated' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'not_authenticated' }, 401);

  let vadrouilleId: unknown;
  try {
    vadrouilleId = (await req.json())?.vadrouilleId;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (typeof vadrouilleId !== 'string' || !/^[0-9a-f-]{36}$/i.test(vadrouilleId)) {
    return json({ error: 'invalid_body' }, 400);
  }

  const { data: input, error: inputError } = await admin.rpc('get_compute_input', {
    p_vadrouille_id: vadrouilleId,
  });
  if (inputError) return json({ error: 'read_failed' }, 500);
  // même réponse pour « inconnue » et « pas membre » : on ne confirme pas l'existence
  if (!input) return json({ error: 'not_found' }, 404);

  const compute = input as ComputeInput;
  const permission = computePermission(compute, auth.user.id);
  if (!permission.allowed) {
    if (permission.reason === 'not_a_member') return json({ error: 'not_found' }, 404);
    return json({ error: permission.reason }, 403);
  }

  const { result, invalidResponses } = runCompute(compute);
  if (invalidResponses.length > 0) console.warn(`${invalidResponses.length} réponse(s) invalide(s) ignorée(s)`);

  if (result.status === 'ok') {
    const pitches = await writePitches(
      result.options,
      Deno.env.get('ANTHROPIC_API_KEY'),
      Deno.env.get('CLAUDE_MODEL') || undefined,
    );
    for (const option of result.options) {
      const pitch = pitches[option.kind];
      if (pitch) {
        option.publicData.pitch = pitch;
        option.publicData.pitchByLlm = true;
      }
    }
  }

  const { error: saveError } = await admin.rpc('save_results', {
    p_vadrouille_id: vadrouilleId,
    p_result: toSavePayload(result),
  });
  if (saveError) return json({ error: 'save_failed' }, 500);

  return json({ status: result.status });
});
