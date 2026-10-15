import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Caption, Title } from '@/components/Typography';
import { getDestination } from '@/engine';
import { OptionCard } from '@/features/OptionCard';
import { OptionDetails } from '@/features/OptionDetails';
import { backend } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useVadrouille } from '@/lib/useVadrouille';
import { colors, space } from '@/theme/tokens';

/** Détail d'une des 3 options : mon budget ligne à ligne, les liens de réservation, et le vote. */
export default function OptionDetail() {
  const { code = '', id = '' } = useLocalSearchParams<{ code: string; id: string }>();
  const { data, isLoading, sessionLoading, error, refetch, refresh } = useVadrouille(code);
  const [busy, setBusy] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const back = () => router.replace(`/v/${code}` as never);

  if (sessionLoading || isLoading) return <Screen><LoadingView /></Screen>;
  if (error) return <Screen><ErrorView error={error} onRetry={() => refetch()} /></Screen>;
  const option = data?.options.find((o) => o.id === id);
  if (!data || !option) {
    return (
      <Screen header={<TopBar title="Option" onBack={back} />}>
        <Caption>Cette option n’existe plus (les réponses ont peut-être été rouvertes).</Caption>
      </Screen>
    );
  }

  const name = getDestination(option.destinationId)?.name ?? '';
  const status = data.vadrouille.status;
  const voted = data.myVote === option.id;
  const decided = status === 'decided' && data.vadrouille.decidedOptionId === option.id;
  const votes = data.tally[option.id] ?? 0;

  const vote = async () => {
    setVoteError(null);
    setBusy(true);
    try {
      await backend.vote(option.id);
      haptic.success();
      await refresh();
    } catch (e) {
      setVoteError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<TopBar title={name} onBack={back} />}
      footer={
        status === 'voting' ? (
          <>
            {voteError ? <Caption color={colors.danger}>{voteError}</Caption> : null}
            <Button
              title={voted ? `Tu as voté ${name} ✓` : data.myVote ? `Changer pour ${name}` : `Je vote ${name}`}
              variant={voted ? 'dark' : 'primary'}
              loading={busy}
              onPress={vote}
              testID="detail-vote"
            />
          </>
        ) : undefined
      }
    >
      <View style={{ gap: space(2) }}>
        <Title>{name}</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Pill label={weekendRange(option.weekendStart, data.vadrouille.nights)} emoji="📅" color={colors.sun} />
          <Pill label={`${votes} vote${votes > 1 ? 's' : ''}`} emoji="🗳️" />
          {decided ? <Pill label="Destination choisie" emoji="🏆" color={colors.mint} /> : null}
        </View>
      </View>
      <OptionCard option={option} mine={data.myDetails[option.id]} highlighted={voted || decided} />
      <OptionDetails state={data} option={option} />
    </Screen>
  );
}
