import type {
  Answers,
  ComfortId,
  DecisionStatus,
  MemberOptionDetails,
  OptionKind,
  OptionPublicData,
  PublicSummary,
} from '@/engine';

export interface Session {
  userId: string;
  firstName: string | null;
  email: string | null;
  isAnonymous: boolean;
}

export type VadrouilleStatus = 'collecting' | 'voting' | 'decided';

export interface Vadrouille {
  id: string;
  name: string;
  organizerId: string;
  /** Vendredis candidats (YYYY-MM-DD). */
  weekends: string[];
  nights: number;
  expectedSize: number;
  inviteCode: string;
  status: VadrouilleStatus;
  decidedOptionId: string | null;
}

export interface Member {
  userId: string;
  firstName: string;
  role: 'organizer' | 'member';
  /** Seul signal public du questionnaire : a répondu ou non. */
  respondedAt: string | null;
}

export interface ResultInfo {
  status: DecisionStatus;
  respondents: number;
  weekendStart: string | null;
  summary: PublicSummary;
}

export interface OptionInfo {
  id: string;
  kind: OptionKind;
  position: number;
  destinationId: string;
  weekendStart: string;
  comfort: ComfortId;
  matchScore: number;
  publicData: OptionPublicData;
}

/** Tout ce qu'un membre a le droit de voir d'une Vadrouille. */
export interface VadrouilleState {
  vadrouille: Vadrouille;
  members: Member[];
  meId: string;
  isOrganizer: boolean;
  /** Mes réponses (les seules lisibles). */
  myAnswers: Answers | null;
  result: ResultInfo | null;
  options: OptionInfo[];
  /** Mon budget prévisionnel par option (privé). */
  myDetails: Record<string, MemberOptionDetails>;
  myVote: string | null;
  /** Décompte anonyme des votes par option. */
  tally: Record<string, number>;
}

export interface InvitePreview {
  vadrouilleId: string;
  name: string;
  organizerFirstName: string;
  weekends: string[];
  nights: number;
  memberCount: number;
  status: VadrouilleStatus;
  isMember: boolean;
}

export interface Backend {
  mode: 'supabase' | 'demo';
  getSession(): Promise<Session | null>;
  /** Crée (si besoin) un compte léger anonyme et enregistre le prénom. */
  signIn(firstName: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Envoie un code à 6 chiffres : `link` rattache l'email au compte courant, `login` retrouve un compte. */
  sendEmailCode(email: string, mode: 'link' | 'login'): Promise<void>;
  verifyEmailCode(email: string, code: string, mode: 'link' | 'login'): Promise<Session>;

  listMine(): Promise<Vadrouille[]>;
  create(input: { name: string; weekends: string[]; expectedSize: number }): Promise<Vadrouille>;
  getInvite(code: string): Promise<InvitePreview | null>;
  join(code: string): Promise<void>;
  /** `null` si la Vadrouille n'existe pas ou si je n'en suis pas membre. */
  getState(code: string): Promise<VadrouilleState | null>;
  saveAnswers(vadrouilleId: string, answers: Answers): Promise<void>;
  /** Lance le calcul côté serveur ; renvoie le statut du résultat. */
  compute(vadrouilleId: string): Promise<DecisionStatus>;
  vote(optionId: string): Promise<void>;
  closeVote(vadrouilleId: string): Promise<void>;
  reopen(vadrouilleId: string): Promise<void>;

  /** Mode démo uniquement : fait répondre (et voter) une bande d'amis fictifs. */
  demoAddFriends?(vadrouilleId: string): Promise<void>;
}
