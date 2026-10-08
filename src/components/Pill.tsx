import { StyleSheet, Text, View } from 'react-native';

import { BORDER, colors, fonts, radius, space } from '@/theme/tokens';

export function Pill({ label, emoji, color = colors.paper }: { label: string; emoji?: string; color?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingHorizontal: space(3),
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  emoji: { fontSize: 13 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
});

export function ProgressBar({ value, color = colors.sunset }: { value: number; color?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      style={progress.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[progress.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const progress = StyleSheet.create({
  track: {
    height: 14,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
