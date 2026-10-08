import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { BORDER, colors, CONTENT_MAX_WIDTH, fonts, hardShadow, space } from '@/theme/tokens';

interface TopBarProps {
  title?: string;
  /** route de repli si l'historique est vide (lien ouvert directement) */
  fallback?: string;
  onBack?: () => void;
  right?: ReactNode;
  hideBack?: boolean;
}

export function TopBar({ title, fallback = '/', onBack, right, hideBack = false }: TopBarProps) {
  const goBack = () => {
    haptic.tap();
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  };
  return (
    <View style={styles.bar}>
      {hideBack ? (
        <View style={styles.side} />
      ) : (
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={({ pressed }) => [
            styles.back,
            !pressed && hardShadow(2),
            pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
          ]}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(5),
    paddingTop: space(2),
    gap: space(3),
  },
  side: { minWidth: 44 },
  right: { alignItems: 'flex-end' },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: colors.ink, fontFamily: fonts.bodyBold, marginTop: -2 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.ink,
  },
});
