import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { haptic } from '@/lib/haptics';
import { BORDER, colors, fonts, hardShadow, radius, space } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  emoji?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

const PALETTE: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.sunset, fg: colors.paper },
  secondary: { bg: colors.paper, fg: colors.ink },
  dark: { bg: colors.ink, fg: colors.sand },
  ghost: { bg: 'transparent', fg: colors.ink },
  danger: { bg: colors.paper, fg: colors.danger },
};

const SHADOW: Record<Size, number> = { lg: 5, md: 4, sm: 3 };

/** Bouton « tampon » : contour encre + ombre franche qui s'écrase à l'appui. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  emoji,
  loading = false,
  disabled = false,
  style,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const palette = PALETTE[variant];
  const isDisabled = disabled || loading;
  const offset = SHADOW[size];
  const framed = variant !== 'ghost';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        { backgroundColor: palette.bg },
        framed && styles.framed,
        framed && !pressed && !isDisabled && hardShadow(offset),
        framed && pressed && { transform: [{ translateX: offset }, { translateY: offset }] },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {emoji ? <Text style={[styles.emoji, size === 'sm' && styles.emojiSm]}>{emoji}</Text> : null}
          <Text
            numberOfLines={1}
            style={[styles.label, size === 'sm' && styles.labelSm, { color: palette.fg }]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  framed: { borderWidth: BORDER, borderColor: colors.ink },
  lg: { minHeight: 60, paddingHorizontal: space(6) },
  md: { minHeight: 50, paddingHorizontal: space(5) },
  sm: { minHeight: 38, paddingHorizontal: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  label: { fontFamily: fonts.displayBold, fontSize: 18, letterSpacing: -0.2 },
  labelSm: { fontSize: 15 },
  emoji: { fontSize: 20 },
  emojiSm: { fontSize: 15 },
  disabled: { opacity: 0.45 },
});
