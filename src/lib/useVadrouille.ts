import { useQuery, useQueryClient } from '@tanstack/react-query';

import { backend } from '@/lib/backend';
import { useSession } from '@/lib/session';

export const vadrouilleKey = (code: string) => ['vadrouille', code.toLowerCase()];

/**
 * État d'une Vadrouille vu par le membre courant. Rafraîchi toutes les 4 s tant que l'écran
 * est ouvert : c'est ce qui fait apparaître les réponses et les votes des autres.
 */
export function useVadrouille(code: string) {
  const { session, loading } = useSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...vadrouilleKey(code), session?.userId ?? null],
    queryFn: () => backend.getState(code),
    enabled: !loading && code.length > 0,
    refetchInterval: (q) => (q.state.data?.vadrouille.status === 'decided' ? false : 4_000),
  });
  return {
    ...query,
    sessionLoading: loading,
    refresh: () => client.invalidateQueries({ queryKey: vadrouilleKey(code) }),
  };
}
