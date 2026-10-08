import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDemo } from '@/lib/env';
import { colors, CONTENT_MAX_WIDTH, fonts, space } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** barre du haut (TopBar) */
  header?: ReactNode;
  /** action principale collée en bas (une action principale par écran) */
  footer?: ReactNode;
  scroll?: boolean;
  background?: string;
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  background = colors.sand,
  keyboard = false,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
  );

  const inner = (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {isDemo ? <DemoBanner /> : null}
      {header}
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space(4)) }]}>
          {footer}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: background }]}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

export function DemoBanner() {
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={styles.bannerText}>Mode démo · données locales, rien n’est envoyé</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: space(5),
    paddingBottom: space(8),
    gap: space(4),
  },
  footer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space(5),
    paddingTop: space(3),
    gap: space(3),
  },
  banner: {
    alignSelf: 'center',
    marginTop: space(1),
    paddingHorizontal: space(3),
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  bannerText: { color: colors.sun, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.4 },
});
