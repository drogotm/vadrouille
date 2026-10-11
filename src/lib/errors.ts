/** Codes d'erreur métier (levés par les fonctions SQL / l'Edge Function) → messages lisibles. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Ta session a expiré : reconnecte-toi.',
  profile_required: 'Dis-nous d’abord ton prénom.',
  invalid_weekends: 'Choisis entre 2 et 4 week-ends.',
  weekend_in_past: 'Ce week-end est déjà passé.',
  invite_not_found: 'Ce lien d’invitation n’existe pas (ou plus).',
  vadrouille_full: 'Cette Vadrouille est complète (20 personnes max).',
  vote_closed: 'Le vote est terminé.',
  vote_not_open: 'Le vote n’est pas ouvert.',
  organizer_only: 'Seul l’organisateur ou l’organisatrice peut faire ça.',
  option_not_found: 'Option introuvable.',
  already_decided: 'C’est déjà décidé !',
  invalid_answers: 'Certaines réponses sont invalides.',
  not_a_member: 'Tu ne fais pas partie de cette Vadrouille.',
  not_allowed: 'Le calcul se lance quand tout le monde a répondu (ou par l’orga).',
  no_answers: 'Personne n’a encore répondu.',
  invalid_code: 'Code incorrect ou expiré.',
  answers_locked: 'Les réponses sont figées une fois les résultats calculés.',
  'row-level security': 'Les réponses sont figées une fois les résultats calculés.',
  demo_no_email: 'La sauvegarde par email n’existe pas en mode démo.',
  network: 'Connexion impossible. Vérifie ton réseau et réessaie.',
};

export class AppError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

export function errorCode(error: unknown): string | null {
  const raw =
    error instanceof AppError
      ? error.code
      : error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return code;
  }
  if (/network|fetch failed|Failed to fetch/i.test(raw)) return 'network';
  if (/otp|token has expired|invalid token/i.test(raw)) return 'invalid_code';
  return null;
}

export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code) return MESSAGES[code];
  return 'Quelque chose s’est mal passé. Réessaie dans un instant.';
}
