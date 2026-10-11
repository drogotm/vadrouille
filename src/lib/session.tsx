import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { backend, type Session } from './backend';

interface SessionContext {
  session: Session | null;
  loading: boolean;
  /** Crée le compte léger si besoin et enregistre le prénom. */
  signIn(firstName: string): Promise<Session>;
  setSession(session: Session | null): void;
}

const Ctx = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    backend
      .getSession()
      .then((s) => alive && setSession(s))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const signIn = async (firstName: string) => {
    const s = await backend.signIn(firstName);
    setSession(s);
    return s;
  };

  return <Ctx.Provider value={{ session, loading, signIn, setSession }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return ctx;
}
