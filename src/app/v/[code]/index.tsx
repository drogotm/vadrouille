import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Body, Caption, Heading } from '@/components/Typography';
import { Collecting } from '@/features/Collecting';
import { Plan } from '@/features/Plan';
import { Results } from '@/features/Results';
import { env } from '@/lib/env';
import { useVadrouille } from '@/lib/useVadrouille';
import { colors, space } from '@/theme/tokens';

/** Écran central d'une Vadrouille : il suit son état (collecte → vote → décidé). */
export default function VadrouilleHub() {
  const { code = '', merci } = useLocalSearchParams<{ code: string; merci?: string }>();
  const { data, isLoading, sessionLoading, error, refetch, refresh } = useVadrouille(code);

  if (sessionLoading || isLoading) return <Screen><LoadingView /></Screen>;
  if (error) return <Screen><ErrorView error={error} onRetry={() => refetch()} /></Screen>;
  // inconnu ou pas encore membre : la page d'invitation sait gérer les deux cas
  if (!data) return <Redirect href={`/i/${code}` as never} />;

  const status = data.vadrouille.status;
  const justAnswered = merci === '1' && status === 'collecting';

  return (
    <Screen header={<TopBar title="Vadrouille" fallback="/" onBack={() => router.replace('/')} />}>
      {justAnswered ? (
        <Card color={colors.mint} testID="thanks">
          <Heading>Merci, c’est noté ! 🙌</Heading>
          <Body>On te prévient ici dès que les 3 options sont prêtes.</Body>
          {Platform.OS === 'web' ? (
            env.appStoreUrl ? (
              <View style={{ marginTop: space(2) }}>
                <Button
                  title="Installer l’app pour suivre le résultat"
                  variant="dark"
                  size="md"
                  onPress={() => Linking.openURL(env.appStoreUrl)}
                />
              </View>
            ) : (
              <Caption>📱 Garde ce lien : tu y retrouveras le résultat. L’app iPhone arrive bientôt.</Caption>
            )
          ) : null}
        </Card>
      ) : null}
      {status === 'collecting' ? <Collecting state={data} refresh={refresh} /> : null}
      {status === 'voting' ? <Results state={data} refresh={refresh} /> : null}
      {status === 'decided' ? <Plan state={data} /> : null}
    </Screen>
  );
}
