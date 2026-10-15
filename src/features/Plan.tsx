import { router } from 'expo-router';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Body, Caption, Display, Heading, Label } from '@/components/Typography';
import { getDestination } from '@/engine';
import type { VadrouilleState } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { env } from '@/lib/env';
import { inviteUrl, shareMessage } from '@/lib/links';
import { colors, space } from '@/theme/tokens';

import { OptionCard } from './OptionCard';
import { OptionDetails } from './OptionDetails';

/** Destination choisie : le plan du séjour et MON budget prévisionnel. */
export function Plan({ state }: { state: VadrouilleState }) {
  const { vadrouille, options, myDetails, tally } = state;
  const winner = options.find((o) => o.id === vadrouille.decidedOptionId) ?? options[0];
  if (!winner) return null;
  const dest = getDestination(winner.destinationId);
  const votes = tally[winner.id] ?? 0;

  return (
    <>
      <View style={{ gap: space(1) }}>
        <Label>{vadrouille.name} · c’est décidé 🎉</Label>
        <Display>On part à {dest?.name ?? ''} !</Display>
        <View style={styles.pills}>
          <Pill label={weekendRange(winner.weekendStart, vadrouille.nights)} emoji="📅" color={colors.sun} />
          <Pill label={`${votes} vote${votes > 1 ? 's' : ''}`} emoji="🗳️" />
        </View>
      </View>

      <OptionCard option={winner} highlighted />

      <OptionDetails state={state} option={winner} />

      <View style={{ gap: space(1), marginTop: space(4) }}>
        <Heading>Les 3 options proposées</Heading>
        <Caption>Calculées à partir de vos réponses. Touche une option pour revoir ses prix et ses liens.</Caption>
      </View>
      {options.map((o) => {
            const n = tally[o.id] ?? 0;
            return (
              <OptionCard key={o.id} option={o} mine={myDetails[o.id]} highlighted={o.id === winner.id}>
                <Caption>
                  {o.id === winner.id ? '🏆 Choisie · ' : ''}
                  {n} vote{n > 1 ? 's' : ''}
                </Caption>
                <Button
                  title="Voir le détail et les liens"
                  variant="secondary"
                  size="md"
                  onPress={() => router.push(`/v/${vadrouille.inviteCode}/option/${o.id}` as never)}
                />
              </OptionCard>
            );
          })}

      <Button
        title="Annoncer à la bande"
        emoji="📣"
        variant="secondary"
        onPress={() =>
          shareMessage(
            `C’est décidé : on part à ${dest?.name ?? ''} du ${weekendRange(winner.weekendStart, vadrouille.nights)} 🎉\nLe plan : ${inviteUrl(vadrouille.inviteCode)}`,
          )
        }
      />

      <Card color={colors.flamingoSoft}>
        <Heading>La prochaine, c’est toi qui l’organises ?</Heading>
        <Body>Un anniversaire, un EVG, un week-end entre collègues : 2 minutes pour lancer.</Body>
        <Button title="Créer ma Vadrouille" emoji="🎒" size="md" onPress={() => router.push('/nouvelle')} />
        {Platform.OS === 'web' ? (
          env.appStoreUrl ? (
            <Button
              title="Installer l’app pour suivre la suite"
              variant="dark"
              size="md"
              onPress={() => Linking.openURL(env.appStoreUrl)}
            />
          ) : (
            <Caption>📱 L’app iPhone arrive bientôt sur l’App Store.</Caption>
          )
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(3) },
});
