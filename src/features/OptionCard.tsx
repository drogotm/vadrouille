import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/Pill';
import { Body, Caption, Strong } from '@/components/Typography';
import {
  CADRE_LABELS,
  COMFORT_LABELS,
  formatDuration,
  formatEuros,
  getDestination,
  TRANSPORT_LABELS,
  type MemberOptionDetails,
} from '@/engine';
import type { OptionInfo } from '@/lib/backend';
import { BORDER, colors, fonts, hardShadow, optionTheme, radius, space } from '@/theme/tokens';

/** « Pour toi » : le budget et le trajet du membre connecté — jamais ceux des autres. */
export function MineLine({ details }: { details: MemberOptionDetails }) {
  const t = details.transport;
  return (
    <View style={styles.mine}>
      <Caption color={colors.ink}>
        🔒 Pour toi : <Strong>{formatEuros(details.total)}</Strong>
        {t ? ` · ${TRANSPORT_LABELS[t.mode].emoji} ${formatDuration(t.minutes)}` : ' · tu es sur place'}
      </Caption>
      <Pill
        label={details.withinBudget ? 'Dans ton budget' : `+${formatEuros(details.total - details.budgetMax)}`}
        color={details.withinBudget ? colors.mint : colors.sunsetSoft}
      />
    </View>
  );
}

/** Les noms longs (« Montpellier », « Amboise & les châteaux ») ne doivent pas être coupés en plein mot. */
const nameSize = (name: string) => {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  if (longest >= 11 || name.length > 18) return { fontSize: 25, lineHeight: 28 };
  if (longest >= 9 || name.length > 12) return { fontSize: 29, lineHeight: 32 };
  return null;
};

/** Carte d'une option : le moment « waouh » — lisible en 3 secondes. */
export function OptionCard({
  option,
  mine,
  children,
  highlighted,
}: {
  option: OptionInfo;
  mine?: MemberOptionDetails;
  children?: ReactNode;
  highlighted?: boolean;
}) {
  const dest = getDestination(option.destinationId);
  const theme = optionTheme[option.kind];
  const data = option.publicData;
  const name = dest?.name ?? data.headline.split(' — ')[0];
  const gradient = dest?.colors ?? [theme.bg, theme.soft];

  return (
    <View style={[styles.card, hardShadow(highlighted ? 8 : 6)]} testID={`option-${option.kind}`}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.kind, { backgroundColor: theme.bg }]}>
          <Text style={styles.kindText}>
            {theme.emoji} {theme.label}
          </Text>
        </View>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.emoji}>{dest?.emoji ?? '📍'}</Text>
            <Text style={[styles.name, nameSize(name)]} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.region} numberOfLines={1}>
              {dest ? `${dest.region} · ${dest.country}` : ''}
            </Text>
          </View>
          <View
            style={styles.score}
            accessibilityRole="text"
            accessibilityLabel={`${option.matchScore} pour cent de match`}
          >
            <Text style={styles.scoreValue}>{option.matchScore}</Text>
            <Text style={styles.scoreUnit}>% MATCH</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Caption color={colors.sunsetDark} style={styles.reason}>
          {data.reason}
        </Caption>
        {data.statsLine ? <Strong>{data.statsLine}</Strong> : null}
        {data.highlights.length > 0 ? (
          <View style={styles.highlights}>
            {data.highlights.map((h) => (
              <View key={h} style={styles.highlight}>
                <Text style={styles.tick}>✓</Text>
                <Body style={{ flex: 1 }}>{h}</Body>
              </View>
            ))}
          </View>
        ) : null}
        <Body color={colors.inkSoft}>{data.pitch}</Body>
        <View style={styles.tags}>
          {dest?.cadres.map((c) => <Pill key={c} label={CADRE_LABELS[c].label} emoji={CADRE_LABELS[c].emoji} />)}
          <Pill label={COMFORT_LABELS[option.comfort].label} emoji={COMFORT_LABELS[option.comfort].emoji} />
          <Pill label={`${Math.round(data.sunshine * 100)} % de soleil`} emoji="☀️" />
        </View>
        {mine ? <MineLine details={mine} /> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: BORDER,
    borderColor: colors.ink,
    borderRadius: radius.xl,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  hero: { padding: space(5), paddingTop: space(4), gap: space(3), borderBottomWidth: BORDER, borderBottomColor: colors.ink },
  kind: {
    alignSelf: 'flex-start',
    paddingHorizontal: space(3),
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.ink,
    transform: [{ rotate: '-2deg' }],
  },
  kindText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(3) },
  emoji: { fontSize: 40 },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink, letterSpacing: -0.8 },
  region: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, opacity: 0.75 },
  score: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '6deg' }],
    ...hardShadow(4),
  },
  scoreValue: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.ink, letterSpacing: -1.5 },
  scoreUnit: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: colors.sunset, marginTop: -2 },
  body: { padding: space(5), gap: space(3) },
  reason: { fontFamily: fonts.bodyBold },
  highlights: { gap: space(1) },
  highlight: { flexDirection: 'row', gap: space(2), alignItems: 'flex-start' },
  tick: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: colors.success },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  mine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(2),
    padding: space(3),
    borderRadius: radius.md,
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.line,
  },
});
