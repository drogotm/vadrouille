import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { BORDER, colors, hardShadow, radius, space } from '@/theme/tokens';

interface CardProps extends ViewProps {
  color?: string;
  shadow?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export function Card({ color = colors.paper, shadow = 4, padding = space(5), style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[styles.card, { backgroundColor: color, padding }, shadow > 0 && hardShadow(shadow), style]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: BORDER,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    gap: space(2),
  },
});
