import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ProgressBar } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Slider } from '@/components/Slider';
import { TopBar } from '@/components/TopBar';
import { WeekendCalendar } from '@/components/WeekendCalendar';
import { Body, Caption, Display, Title } from '@/components/Typography';
import { backend } from '@/lib/backend';
import { upcomingWeekends } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { colors, space } from '@/theme/tokens';

type Step = 'me' | 'name' | 'weekends' | 'size';

/** Création d'une Vadrouille : une question par écran. */
export default function Nouvelle() {
  const { session, signIn } = useSession();
  const client = useQueryClient();
  const steps: Step[] = session?.firstName ? ['name', 'weekends', 'size'] : ['me', 'name', 'weekends', 'size'];
  const [index, setIndex] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [name, setName] = useState('');
  const [weekends, setWeekends] = useState<string[]>([]);
  const [size, setSize] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates] = useState(() => upcomingWeekends(12));

  // la liste d'étapes raccourcit quand le prénom est enregistré : on borne l'index
  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = step === 'size';
  const valid =
    step === 'me'
      ? firstName.trim().length > 0
      : step === 'name'
        ? name.trim().length > 0
        : step === 'weekends'
          ? weekends.length >= 2 && weekends.length <= 4
          : true;

  const toggleWeekend = (w: string) => {
    setWeekends((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : cur.length >= 4 ? cur : [...cur, w]));
  };

  const next = async () => {
    setError(null);
    if (!isLast) {
      if (step === 'me') {
        setBusy(true);
        try {
          await signIn(firstName);
          // l'étape « prénom » disparaît de la liste : on reste sur le même index
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
        return;
      }
      setIndex((i) => i + 1);
      return;
    }
    setBusy(true);
    try {
      const v = await backend.create({ name, weekends, expectedSize: size });
      haptic.success();
      await client.invalidateQueries({ queryKey: ['mine'] });
      // on enchaîne directement sur le questionnaire (les dates choisies valent dispos de l’orga)
      router.replace(`/v/${v.inviteCode}/questions` as never);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const back = () => (index > 0 && step !== 'me' ? setIndex((i) => i - 1) : router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      keyboard
      header={<TopBar title="Nouvelle Vadrouille" onBack={back} />}
      footer={
        <>
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button
            title={isLast ? 'Créer et inviter la bande' : 'Continuer'}
            emoji={isLast ? '🚀' : undefined}
            onPress={next}
            disabled={!valid}
            loading={busy}
            testID="next"
          />
        </>
      }
    >
      <ProgressBar value={(steps.indexOf(step) + 1) / steps.length} />

      {step === 'me' ? (
        <>
          <Title>D’abord, c’est quoi ton prénom ?</Title>
          <Body color={colors.inkSoft}>C’est ce que ta bande verra. Pas de mot de passe, pas d’email.</Body>
          <Field
            big
            autoFocus
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ton prénom"
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => valid && next()}
            testID="first-name"
          />
        </>
      ) : null}

      {step === 'name' ? (
        <>
          <Title>Elle s’appelle comment, cette Vadrouille ?</Title>
          <Body color={colors.inkSoft}>Un nom qui parle à la bande.</Body>
          <Field
            big
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Les 30 ans de Max"
            maxLength={80}
            returnKeyType="next"
            onSubmitEditing={() => valid && next()}
            testID="name"
          />
        </>
      ) : null}

      {step === 'weekends' ? (
        <>
          <Title>Quels week-ends te vont ?</Title>
          <Body color={colors.inkSoft}>
            Choisis-en 2 à 4 : ce sont tes dispos. On retiendra celui où le groupe est le plus nombreux.
          </Body>
          <WeekendCalendar
            weekends={candidates}
            mark={(w) => (weekends.includes(w) ? 'selected' : null)}
            onPress={toggleWeekend}
            disabled={() => weekends.length >= 4}
          />
          <Caption>{weekends.length}/4 sélectionnés · du vendredi soir au dimanche</Caption>
        </>
      ) : null}

      {step === 'size' ? (
        <>
          <Title>Vous serez combien, à peu près ?</Title>
          <Body color={colors.inkSoft}>Toi compris. C’est juste pour suivre qui a répondu.</Body>
          <View style={styles.sizeBox}>
            <Display style={styles.sizeValue}>{size}</Display>
            <Caption>personnes</Caption>
          </View>
          <Slider
            value={size}
            min={2}
            max={15}
            step={1}
            onChange={setSize}
            accessibilityLabel="Taille du groupe"
            formatValue={(v) => `${v} personnes`}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sizeBox: { alignItems: 'center', paddingVertical: space(4) },
  sizeValue: { fontSize: 88, lineHeight: 92 },
});
