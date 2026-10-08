import { StyleSheet, Text, View } from 'react-native';

import { BORDER, colors, fonts } from '@/theme/tokens';

const PALETTE = [colors.sun, colors.mint, colors.flamingo, colors.sky, colors.lavender, colors.sunsetSoft];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, seed, size = 40 }: { name: string; seed?: string; size?: number }) {
  const bg = PALETTE[hash(seed ?? name) % PALETTE.length];
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: BORDER,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.display, color: colors.ink },
});
