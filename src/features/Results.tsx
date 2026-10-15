import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill, ProgressBar } from '@/components/Pill';
import { Body, Caption, Display, Label, Strong } from '@/components/Typography';
import { getDestination } from '@/engine';
import { backend, type VadrouilleState } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';

import { OptionCard } from './OptionCard';

/** Les 3 options + le vote. */
export function Results({ state, refresh }: { state: VadrouilleState; refresh: () => Promise<unknown> }) {
  const { vadrouille, options, result, myDetails, myVote, tally, members, isOrganizer } = state;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totalVotes = Object.values(tally).reduce((s, n) => s + n, 0);

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
      haptic.success();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View style={{ gap: space(1) }}>
        <Label>{vadrouille.name}</Label>
        <Display>Vos 3 options</Display>
        {result?.weekendStart ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) }}>
            <Pill label={weekendRange(result.weekendStart, vadrouille.nights)} emoji="📅" color={colors.sun} />
            {result.summary.weekend ? <Pill label={result.summary.weekend.presence} emoji="🙌" /> : null}
          </View>
        ) : null}
        <Body color={colors.inkSoft} style={{ marginTop: space(2) }}>
          Calculées à partir des réponses de {result?.respondents ?? 0} personne
          {(result?.respondents ?? 0) > 1 ? 's' : ''}. Vote pour ta préférée.
        </Body>
      </View>

      {options.map((option) => {
        const name = getDestination(option.destinationId)?.name ?? '';
        const voted = myVote === option.id;
        const votes = tally[option.id] ?? 0;
        return (
          <OptionCard key={option.id} option={option} mine={myDetails[option.id]} highlighted={voted}>
            {totalVotes > 0 ? (
              <View style={{ gap: space(1) }}>
                <Caption>
                  {votes} vote{votes > 1 ? 's' : ''}
                </Caption>
                <ProgressBar value={votes / Math.max(1, members.length)} color={colors.lagoon} />
              </View>
            ) : null}
            <Button
              title={voted ? `Tu as voté ${name} ✓` : myVote ? `Changer pour ${name}` : `Je vote ${name}`}
              variant={voted ? 'dark' : 'primary'}
              size="md"
              loading={busy === option.id}
              onPress={() => run(option.id, () => backend.vote(option.id))}
              testID={`vote-${option.kind}`}
            />
          </OptionCard>
        );
      })}

      <Card shadow={0} color={colors.sandDeep}>
        <Strong>
          🗳️ {totalVotes}/{members.length} ont voté
        </Strong>
        <Caption>
          Tu peux changer ton vote jusqu’à ce que l’orga clôture. Les votes sont anonymes : seul le décompte est
          visible.
        </Caption>
        {isOrganizer && totalVotes >= members.length ? (
          <Strong color={colors.lagoon}>Tout le monde a voté : tu peux clore le vote.</Strong>
        ) : null}
        {isOrganizer ? (
          <View style={{ gap: space(2), marginTop: space(2) }}>
            <Button
              title="Clore le vote maintenant"
              variant="secondary"
              size="md"
              disabled={totalVotes === 0}
              loading={busy === 'close'}
              onPress={() => run('close', () => backend.closeVote(vadrouille.id))}
              testID="close-vote"
            />
            <Button
              title="Rouvrir les réponses"
              variant="ghost"
              size="sm"
              loading={busy === 'reopen'}
              onPress={() => run('reopen', () => backend.reopen(vadrouille.id))}
            />
          </View>
        ) : null}
      </Card>

      {error ? <Caption color={colors.danger}>{error}</Caption> : null}
      {result?.summary.aggregatesHidden ? (
        <Caption center>
          🔒 Groupe de moins de {result.summary.privacyThreshold} personnes : on masque les décomptes pour qu’aucune
          réponse individuelle ne puisse être devinée.
        </Caption>
      ) : null}
      <Caption center>≈ Prix et durées estimés, pas des tarifs réels.</Caption>
    </>
  );
}
