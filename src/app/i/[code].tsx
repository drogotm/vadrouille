import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { Field } from '@/components/Field';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Body, Caption, Heading, Label, Strong, Title } from '@/components/Typography';
import { backend } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { colors, space } from '@/theme/tokens';

/**
 * Atterrissage d'un lien d'invitation (app ou web). Objectif : répondre en 2 minutes, sans
 * installer l'app ni créer de mot de passe — juste un prénom.
 */
export default function Invitation() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { session, loading, signIn } = useSession();
  const client = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useQuery({
    queryKey: ['invite', code, session?.userId ?? null],
    queryFn: () => backend.getInvite(code),
    enabled: !loading && code.length > 0,
  });

  if (loading || invite.isLoading) return <Screen><LoadingView label="On ouvre l’invitation…" /></Screen>;
  if (invite.error) return <Screen><ErrorView error={invite.error} onRetry={() => invite.refetch()} /></Screen>;

  const data = invite.data;
  if (!data) {
    return (
      <Screen footer={<Button title="Créer ma Vadrouille" emoji="🎒" onPress={() => router.replace('/')} />}>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🕵️</Text>
          <Title center>Invitation introuvable</Title>
          <Body center color={colors.inkSoft}>
            Ce lien n’existe pas (ou plus). Redemande-le à la personne qui organise.
          </Body>
        </View>
      </Screen>
    );
  }
  if (data.isMember) return <Redirect href={`/v/${code}` as never} />;

  const name = session?.firstName ?? firstName;
  const join = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!session?.firstName) await signIn(firstName);
      await backend.join(code);
      haptic.success();
      await client.invalidateQueries();
      // on enchaîne directement sur le questionnaire : c'est le but du lien
      router.replace(`/v/${code}/questions` as never);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      keyboard
      footer={
        <>
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button
            title="Je réponds (2 min)"
            emoji="✍️"
            onPress={join}
            loading={busy}
            disabled={name.trim().length === 0}
            testID="join"
          />
        </>
      }
    >
      <View style={styles.header}>
        <Avatar name={data.organizerFirstName} size={64} />
        <Label>{data.organizerFirstName} t’invite à</Label>
        <Title center>{data.name}</Title>
        <Heading center color={colors.sunset}>On part où ?</Heading>
      </View>

      <Card color={colors.sunSoft}>
        <Strong>Week-ends en lice</Strong>
        <View style={styles.pills}>
          {data.weekends.map((w) => (
            <Pill key={w} label={weekendRange(w, data.nights)} emoji="📅" />
          ))}
        </View>
        <Caption style={{ marginTop: space(2) }}>
          {data.memberCount} {data.memberCount > 1 ? 'personnes ont' : 'personne a'} déjà rejoint.
        </Caption>
      </Card>

      {session?.firstName ? (
        <Body center>Tu réponds en tant que <Strong>{session.firstName}</Strong>.</Body>
      ) : (
        <Field
          label="Ton prénom"
          big
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Ton prénom"
          maxLength={40}
          autoCapitalize="words"
          returnKeyType="go"
          onSubmitEditing={() => name.trim() && join()}
          hint="Pas de mot de passe, pas d’app à installer."
          testID="first-name"
        />
      )}

      <Card color={colors.mintSoft} shadow={0}>
        <Strong>🔒 Tes réponses sont privées</Strong>
        <Caption>
          Budget, dispos, envies : personne ne les voit, pas même {data.organizerFirstName}. Le groupe ne
          reçoit que le résultat.
        </Caption>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space(3), paddingTop: space(12) },
  bigEmoji: { fontSize: 64 },
  header: { alignItems: 'center', gap: space(2), paddingTop: space(4) },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
});
