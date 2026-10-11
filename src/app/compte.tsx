import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Body, Caption, Heading, Strong, Title } from '@/components/Typography';
import { backend } from '@/lib/backend';
import { isDemo } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

/**
 * Compte léger : un prénom suffit. Ajouter un email (code à 6 chiffres, sans mot de passe)
 * permet de retrouver ses Vadrouilles sur un autre appareil.
 */
export default function Compte() {
  const { session, signIn, setSession } = useSession();
  const client = useQueryClient();
  const [firstName, setFirstName] = useState(session?.firstName ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<'link' | 'login' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setNote(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const mode: 'link' | 'login' = session ? 'link' : 'login';
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Screen keyboard header={<TopBar title="Mon compte" />}>
      <Title>{session?.firstName ? `Salut ${session.firstName} 👋` : 'Mon compte'}</Title>

      {session ? (
        <Card>
          <Heading>Ton prénom</Heading>
          <Field value={firstName} onChangeText={setFirstName} maxLength={40} autoCapitalize="words" />
          <Button
            title="Enregistrer"
            variant="secondary"
            size="md"
            disabled={firstName.trim().length === 0 || firstName.trim() === session.firstName}
            loading={busy === 'name'}
            onPress={() =>
              run('name', async () => {
                await signIn(firstName);
                await client.invalidateQueries();
                setNote('Prénom mis à jour ✅');
              })
            }
          />
        </Card>
      ) : null}

      {isDemo ? (
        <Card shadow={0} color={colors.sandDeep}>
          <Strong>Mode démo</Strong>
          <Caption>Tout est stocké sur cet appareil. La sauvegarde par email sera active avec le vrai backend.</Caption>
        </Card>
      ) : session?.email && !session.isAnonymous ? (
        <Card color={colors.mintSoft}>
          <Strong>✅ Compte sauvegardé</Strong>
          <Caption>{session.email}</Caption>
        </Card>
      ) : (
        <Card color={colors.sunSoft}>
          <Heading>{session ? 'Sauvegarde ton compte' : 'Retrouver mon compte'}</Heading>
          <Body>
            {session
              ? 'Ajoute ton email pour retrouver tes Vadrouilles sur un autre appareil. Pas de mot de passe.'
              : 'Entre l’email que tu avais ajouté : on t’envoie un code.'}
          </Body>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="toi@exemple.fr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!sent}
          />
          {sent ? (
            <>
              <Field
                label="Code reçu par email"
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
              />
              <Button
                title="Valider le code"
                size="md"
                disabled={code.trim().length < 6}
                loading={busy === 'verify'}
                onPress={() =>
                  run('verify', async () => {
                    setSession(await backend.verifyEmailCode(email.trim(), code.trim(), sent));
                    await client.invalidateQueries();
                    setSent(null);
                    setNote('C’est bon, ton compte est sauvegardé ✅');
                  })
                }
              />
            </>
          ) : (
            <Button
              title="Recevoir un code"
              size="md"
              disabled={!emailOk}
              loading={busy === 'send'}
              onPress={() =>
                run('send', async () => {
                  await backend.sendEmailCode(email.trim(), mode);
                  setSent(mode);
                })
              }
            />
          )}
        </Card>
      )}

      {note ? <Caption color={colors.success}>{note}</Caption> : null}
      {error ? <Caption color={colors.danger}>{error}</Caption> : null}

      {/* un compte anonyme non sauvegardé serait perdu : pas de déconnexion tant qu'il n'y a pas d'email */}
      {session && (isDemo || !session.isAnonymous) ? (
        <Button
          title={isDemo ? 'Effacer les données de démo' : 'Me déconnecter'}
          variant="danger"
          size="md"
          loading={busy === 'out'}
          onPress={() =>
            run('out', async () => {
              await backend.signOut();
              setSession(null);
              client.clear();
              router.replace('/');
            })
          }
        />
      ) : null}
    </Screen>
  );
}
