import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill, ProgressBar } from '@/components/Pill';
import { Body, Caption, Heading, Label, Strong, Title } from '@/components/Typography';
import { backend, type VadrouilleState } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { isDemo } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { copyToClipboard, inviteMessage, inviteUrl, nudgeMessage, shareMessage } from '@/lib/links';
import { colors, fonts, space } from '@/theme/tokens';

/** Phase de collecte : inviter, suivre QUI a répondu (jamais quoi), relancer, lancer le calcul. */
export function Collecting({ state, refresh }: { state: VadrouilleState; refresh: () => Promise<unknown> }) {
  const { vadrouille, members, isOrganizer, myAnswers, result } = state;
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answered = members.filter((m) => m.respondedAt);
  const waiting = members.filter((m) => !m.respondedAt);
  const expected = Math.max(vadrouille.expectedSize, members.length);
  const everyone = waiting.length === 0 && members.length >= vadrouille.expectedSize;
  const url = inviteUrl(vadrouille.inviteCode);
  const organizer = members.find((m) => m.role === 'organizer')?.firstName ?? '';
  const canCompute = answered.length > 0 && (isOrganizer || everyone);

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setNote(null);
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const share = (message: string) =>
    run('share', async () => {
      const outcome = await shareMessage(message);
      if (outcome === 'copied') setNote('Message copié, colle-le dans ton groupe 👌');
    });

  const blocked = result && result.status !== 'ok';

  return (
    <>
      <View style={{ gap: space(1) }}>
        <Label>{isOrganizer ? 'Tu organises' : `Organisé par ${organizer}`}</Label>
        <Title>{vadrouille.name}</Title>
        <View style={styles.pills}>
          {vadrouille.weekends.map((w) => (
            <Pill key={w} label={weekendRange(w, vadrouille.nights)} emoji="📅" color={colors.sunSoft} />
          ))}
        </View>
      </View>

      {blocked ? (
        <Card color={colors.sunsetSoft} testID="diagnostic">
          <Heading>😬 Aucune option ne passe</Heading>
          <Body>{result.summary.message ?? 'Vos critères ne sont pas compatibles pour l’instant.'}</Body>
          {result.summary.blocking.map((b) => (
            <View key={b.criterion} style={styles.blocking}>
              <Strong>{b.message}</Strong>
              <Caption>
                💡 {b.suggestion}
                {b.unlocks > 0 ? ` (${b.unlocks} destination${b.unlocks > 1 ? 's' : ''} en plus)` : ''}
              </Caption>
            </View>
          ))}
          <Caption>On ne dit jamais qui bloque. Chacun peut ajuster ses réponses, puis on relance.</Caption>
        </Card>
      ) : null}

      {!myAnswers ? (
        <Card color={colors.sun}>
          <Heading>À toi de jouer ✍️</Heading>
          <Body>2 minutes, une question par écran. Tes réponses restent privées.</Body>
          <Button
            title="Répondre au questionnaire"
            variant="dark"
            size="md"
            onPress={() => router.push(`/v/${vadrouille.inviteCode}/questions` as never)}
            testID="answer"
          />
        </Card>
      ) : (
        <Card color={colors.mintSoft} shadow={0} padding={space(4)}>
          <View style={styles.rowBetween}>
            <Strong>✅ Tes réponses sont enregistrées</Strong>
            <Button
              title="Modifier"
              variant="ghost"
              size="sm"
              onPress={() => router.push(`/v/${vadrouille.inviteCode}/questions` as never)}
            />
          </View>
        </Card>
      )}

      <Card>
        <View style={styles.rowBetween}>
          <Heading>Qui a répondu ?</Heading>
          <Strong testID="progress">
            {answered.length}/{expected}
          </Strong>
        </View>
        <ProgressBar value={answered.length / expected} color={colors.lagoon} />
        <View style={styles.members}>
          {members.map((m) => (
            <View key={m.userId} style={styles.member}>
              <Avatar name={m.firstName} seed={m.userId} size={36} />
              <Strong style={{ flex: 1 }} numberOfLines={1}>
                {m.firstName}
                {m.userId === state.meId ? ' (toi)' : ''}
              </Strong>
              <Text style={styles.status}>{m.respondedAt ? '✅ a répondu' : '⏳ en attente'}</Text>
            </View>
          ))}
          {expected > members.length ? (
            <Caption>
              + {expected - members.length} {expected - members.length > 1 ? 'personnes n’ont' : 'personne n’a'} pas
              encore ouvert le lien
            </Caption>
          ) : null}
        </View>
        <Caption>🔒 Tu vois qui a répondu, jamais ce qu’ils ont répondu.</Caption>
      </Card>

      <Card color={colors.sandDeep}>
        <Heading>Invite ta bande</Heading>
        <Caption selectable>{url}</Caption>
        <View style={styles.actions}>
          <Button
            title="Partager le lien"
            emoji="💬"
            size="md"
            style={{ flex: 1 }}
            loading={busy === 'share'}
            onPress={() => share(inviteMessage(organizer, vadrouille.name, url))}
            testID="share"
          />
          <Button
            title="Copier"
            variant="secondary"
            size="md"
            onPress={async () => {
              await copyToClipboard(url);
              haptic.success();
              setNote('Lien copié ✅');
            }}
          />
        </View>
        {isOrganizer && waiting.length > 0 && members.length > 1 ? (
          <Button
            title="Relancer les retardataires"
            emoji="🔔"
            variant="secondary"
            size="md"
            onPress={() =>
              share(
                nudgeMessage(
                  waiting.filter((m) => m.userId !== state.meId).map((m) => m.firstName),
                  vadrouille.name,
                  url,
                ),
              )
            }
          />
        ) : null}
        {isDemo && backend.demoAddFriends ? (
          <Button
            title="Démo : simuler la bande"
            emoji="🤖"
            variant="secondary"
            size="md"
            loading={busy === 'friends'}
            onPress={() => run('friends', () => backend.demoAddFriends!(vadrouille.id))}
            testID="demo-friends"
          />
        ) : null}
        {note ? <Caption color={colors.success}>{note}</Caption> : null}
      </Card>

      {error ? <Caption color={colors.danger}>{error}</Caption> : null}

      {canCompute ? (
        <View style={{ gap: space(2) }}>
          <Button
            title={everyone ? 'Voir nos 3 options' : blocked ? 'Régénérer nos options' : 'Générer nos options de week-end'}
            emoji="✨"
            loading={busy === 'compute'}
            onPress={() =>
              run('compute', async () => {
                await backend.compute(vadrouille.id);
                haptic.success();
              })
            }
            testID="compute"
          />
          {!everyone ? (
            <Caption center>
              {answered.length} réponse{answered.length > 1 ? 's' : ''} sur {expected}. Tu peux attendre les autres ou
              générer les options avec ceux qui ont déjà répondu.
            </Caption>
          ) : null}
        </View>
      ) : (
        <Caption center>
          {answered.length === 0
            ? 'Les options de week-end se génèrent dès qu’il y a des réponses.'
            : 'Les 3 options arrivent dès que tout le monde a répondu (ou quand l’orga le décide).'}
        </Caption>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  members: { gap: space(3), marginVertical: space(3) },
  member: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  status: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: space(3), marginTop: space(2) },
  blocking: { gap: 2, marginTop: space(2) },
});
