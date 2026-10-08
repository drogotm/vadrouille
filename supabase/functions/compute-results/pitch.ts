/**
 * Rédaction des accroches par l'API Claude — UNIQUEMENT de la mise en mots.
 * Le LLM ne reçoit que des données publiques déjà agrégées et filtrées (jamais une réponse
 * individuelle) et ne touche ni au score ni au classement. Toute erreur est silencieuse :
 * l'app affiche alors l'accroche du seed.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { getDestination } from '../_shared/engine/catalog.ts';
import { CADRE_LABELS, ENVIE_LABELS } from '../_shared/engine/labels.ts';
import type { EngineOption } from '../_shared/engine/types.ts';

const PitchSchema = z.object({
  pitches: z.array(z.object({ kind: z.enum(['best', 'budget', 'wild']), pitch: z.string() })),
});

const SYSTEM = `Tu écris pour Vadrouille, une app qui aide une bande d'amis à choisir où partir en week-end.
Pour chaque option fournie, écris UNE phrase d'accroche en français (140 caractères max), chaleureuse et
concrète, tutoiement collectif (« vous »), qui donne envie et s'appuie sur les données fournies.
N'invente aucun chiffre, aucun prix, aucun lieu précis absent des données. Pas d'emoji, pas de guillemets.`;

export async function writePitches(
  options: EngineOption[],
  apiKey: string | undefined,
  model = 'claude-opus-5-5',
): Promise<Record<string, string>> {
  if (!apiKey || options.length === 0) return {};
  try {
    const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
    // uniquement des données publiques (destination + agrégats déjà filtrés)
    const payload = options.map((o) => {
      const d = getDestination(o.destinationId);
      return {
        kind: o.kind,
        destination: d?.name ?? o.destinationId,
        pays: d?.country,
        matchScore: o.matchScore,
        raison: o.publicData.reason,
        cadres: d?.cadres.map((c) => CADRE_LABELS[c].label),
        envies: d ? Object.keys(d.envies).map((e) => ENVIE_LABELS[e as keyof typeof ENVIE_LABELS].label) : [],
        agregats: o.publicData.highlights,
        activites: o.publicData.suggestions.activities.map((a) => a.name),
      };
    });
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 8000,
      // repli automatique côté serveur si le modèle décline (routé par catégorie de refus)
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // tâche de pure rédaction : l'effort minimal suffit
      output_config: { effort: 'low', format: betaZodOutputFormat(PitchSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    if (response.stop_reason === 'refusal') {
      console.warn(`Accroches refusées (${response.stop_details?.category ?? 'sans catégorie'})`);
      return {};
    }
    if (response.stop_reason !== 'end_turn' || !response.parsed_output) return {};
    const out: Record<string, string> = {};
    for (const p of response.parsed_output.pitches) {
      const text = p.pitch.trim();
      if (text.length > 0 && text.length <= 220) out[p.kind] = text;
    }
    return out;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude API ${error.status}: ${error.message}`);
    } else {
      console.error('Rédaction des accroches impossible', error);
    }
    return {};
  }
}
