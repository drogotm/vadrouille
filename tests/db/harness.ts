/**
 * Harnais de test SQL : un vrai Postgres (PGlite, WASM) qui imite l'environnement Supabase
 * (rôles anon / authenticated / service_role, auth.uid(), privilèges par défaut), puis
 * applique les migrations du dépôt. Permet de prouver les politiques RLS sans Docker.
 */
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

// Reproduction minimale de ce que Supabase installe avant nos migrations.
const SUPABASE_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    is_anonymous boolean not null default false,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase accorde tout par défaut sur public : nos migrations doivent s'en protéger.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

type Role = 'anon' | 'authenticated' | 'service_role';

export interface SqlClient {
  /** Exécute une requête avec le rôle et les claims JWT de ce client. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Raccourci : première ligne (ou erreur si aucune). */
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T>;
}

export interface TestDb {
  pg: PGlite;
  /** Crée un utilisateur (comme un sign-in anonyme Supabase) et son profil. */
  createUser(firstName?: string): Promise<string>;
  /** Client authentifié comme l'utilisateur donné. */
  as(userId: string): SqlClient;
  anon: SqlClient;
  service: SqlClient;
  close(): Promise<void>;
}

function makeClient(pg: PGlite, role: Role, userId: string | null): SqlClient {
  const run = async <T>(sql: string, params: unknown[] = []) =>
    pg.transaction(async (tx: Transaction) => {
      await tx.exec(`set local role ${role}`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ]);
      const res = await tx.query<T>(sql, params);
      return res.rows;
    });
  return {
    query: run,
    async one<T>(sql: string, params?: unknown[]) {
      const rows = await run<T>(sql, params);
      if (rows.length === 0) throw new Error(`Aucune ligne pour : ${sql}`);
      return rows[0];
    },
  };
}

export async function createTestDb(): Promise<TestDb> {
  const pg = await PGlite.create();
  await pg.exec(SUPABASE_SHIM);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  const db: TestDb = {
    pg,
    async createUser(firstName = 'Testeur') {
      const id = randomUUID();
      await pg.query(`insert into auth.users (id, is_anonymous) values ($1, true)`, [id]);
      await makeClient(pg, 'authenticated', id).query(
        `insert into public.profiles (id, first_name) values ($1, $2)`,
        [id, firstName],
      );
      return id;
    },
    as: (userId) => makeClient(pg, 'authenticated', userId),
    anon: makeClient(pg, 'anon', null),
    service: makeClient(pg, 'service_role', null),
    close: () => pg.close(),
  };
  return db;
}

/** Les n prochains vendredis (format ISO), à partir de la semaine prochaine. */
export function upcomingFridays(n: number, from = new Date()): string[] {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** Réponse valide au questionnaire (forme stockée en base). */
export function sampleAnswers(weekends: string[], overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    availability: Object.fromEntries(weekends.map((w) => [w, 'yes'])),
    departureCity: 'paris',
    budgetMax: 300,
    maxTravelHours: 4,
    transports: ['train', 'car'],
    cadres: ['mer', 'ville'],
    envies: ['gastronomie', 'fete'],
    comfort: 1,
    weather: 2,
    ambiance: 0.5,
    importance: {},
    ...overrides,
  };
}

/** Crée une Vadrouille avec un organisateur et des membres ; renvoie les identifiants utiles. */
export async function setupGroup(db: TestDb, names: string[]) {
  const [orgName, ...others] = names;
  const organizer = await db.createUser(orgName);
  const weekends = upcomingFridays(3);
  const vad = await db.as(organizer).one<{ id: string; invite_code: string }>(
    `select id, invite_code from public.create_vadrouille($1, $2::date[], $3)`,
    ['Week-end test', weekends, Math.max(2, names.length)],
  );
  const members: string[] = [];
  for (const name of others) {
    const uid = await db.createUser(name);
    await db.as(uid).query(`select public.join_vadrouille($1)`, [vad.invite_code]);
    members.push(uid);
  }
  return { organizer, members, vadrouilleId: vad.id, inviteCode: vad.invite_code, weekends };
}
