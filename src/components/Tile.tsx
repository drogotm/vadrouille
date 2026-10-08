import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '@/lib/haptics';
import { BORDER, colors, fonts, hardShadow, radius, space } from '@/theme/tokens';

interface TileProps {
  label: string;
  emoji?: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  /** tuile carrée compacte (grilles 2 colonnes) */
  compact?: boolean;
  /** case à cocher (multi-choix) ou bouton radio */
  kind?: 'check' | 'radio';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Gros bouton de choix du questionnaire. */
export function Tile({
  label,
  emoji,
  description,
  selected,
  onPress,
  color = colors.sun,
  compact = false,
  kind = 'radio',
  style,
  testID,
}: TileProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={kind === 'check' ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.tile,
        compact ? styles.compact : styles.wide,
        { backgroundColor: selected ? color : colors.paper },
        !pressed && hardShadow(selected ? 4 : 2),
        pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
        style,
      ]}
    >
      {emoji ? <Text style={compact ? styles.emojiBig : styles.emoji}>{emoji}</Text> : null}
      <View style={compact ? styles.textCompact : styles.text}>
        <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={2}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.description, compact && styles.descriptionCompact]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.check, selected && styles.checkOn, compact && styles.checkCompact]}>
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: BORDER,
    borderColor: colors.ink,
    borderRadius: radius.lg,
  },
  wide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(4),
    paddingHorizontal: space(4),
    minHeight: 68,
  },
  compact: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 112,
    padding: space(4),
    justifyContent: 'space-between',
  },
  emoji: { fontSize: 28 },
  emojiBig: { fontSize: 34 },
  text: { flex: 1, gap: 2 },
  textCompact: { gap: 2, marginTop: space(2) },
  label: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink },
  labelCompact: { fontSize: 17 },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.inkSoft },
  descriptionCompact: { fontSize: 13 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCompact: { position: 'absolute', top: space(3), right: space(3) },
  checkOn: { backgroundColor: colors.ink },
  checkMark: { color: colors.paper, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 16 },
});
