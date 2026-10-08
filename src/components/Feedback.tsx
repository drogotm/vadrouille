import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Heading } from '@/components/Typography';
import { errorMessage } from '@/lib/errors';
import { colors, space } from '@/theme/tokens';

export function LoadingView({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.sunset} />
      <Body color={colors.inkSoft}>{label}</Body>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>🙈</Text>
      <Heading center>Oups, petit souci</Heading>
      <Body center color={colors.inkSoft}>
        {errorMessage(error)}
      </Body>
      {onRetry ? <Button title="Réessayer" variant="secondary" size="md" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(3),
    padding: space(6),
  },
  emoji: { fontSize: 48 },
});
