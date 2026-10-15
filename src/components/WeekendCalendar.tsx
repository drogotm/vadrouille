import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Caption } from '@/components/Typography';
import { monthOf, monthTitle, monthWeeks, weekendRange } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { BORDER, colors, fonts, hardShadow, radius, space } from '@/theme/tokens';

export type WeekendMark = 'yes' | 'maybe' | 'selected' | null;

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const FILL: Record<Exclude<WeekendMark, null>, string> = {
  yes: colors.mint,
  maybe: colors.sun,
  selected: colors.sun,
};

const SPOKEN: Record<Exclude<WeekendMark, null>, string> = {
  yes: 'dispo',
  maybe: 'peut-être',
  selected: 'choisi',
};

interface Props {
  /** vendredis (ISO) des week-ends qu'on peut toucher ; tout le reste est grisé */
  weekends: readonly string[];
  mark: (friday: string) => WeekendMark;
  onPress: (friday: string) => void;
  /** nuits du séjour (2 = vendredi soir → dimanche) */
  nights?: number;
  /** un week-end qu'on ne peut plus choisir (ex. limite atteinte) reste visible mais inerte */
  disabled?: (friday: string) => boolean;
}

/**
 * Calendrier mois par mois : seuls les week-ends proposés se touchent, d'un seul geste
 * (vendredi → dimanche). Les autres jours restent visibles mais grisés, pour se repérer.
 */
export function WeekendCalendar({ weekends, mark, onPress, nights = 2, disabled }: Props) {
  const fridays = new Set(weekends);
  const months: { year: number; month: number }[] = [];
  for (const w of [...weekends].sort()) {
    const m = monthOf(w);
    if (!months.some((x) => x.year === m.year && x.month === m.month)) months.push(m);
  }

  return (
    <View style={styles.months}>
      {months.map(({ year, month }) => (
        <View key={`${year}-${month}`} style={styles.month}>
          <Text style={styles.monthTitle}>{monthTitle(year, month)}</Text>
          <View style={styles.row}>
            {DAYS.map((d, i) => (
              <Text key={i} style={[styles.dayName, i >= 4 && styles.dayNameWeekend]}>
                {d}
              </Text>
            ))}
          </View>
          {monthWeeks(year, month).map((week) => {
            const friday = week[4];
            // le week-end appartient au mois de son vendredi : pas de doublon d'un mois à l'autre
            const active = fridays.has(friday) && monthOf(friday).month === month;
            const state = active ? mark(friday) : null;
            const off = active && (disabled?.(friday) ?? false) && state === null;
            return (
              <View key={week[0]} style={styles.row}>
                {week.slice(0, 4).map((iso) => (
                  <Day key={iso} iso={iso} month={month} />
                ))}
                {active ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Week-end du ${weekendRange(friday, nights)}${state ? `, ${SPOKEN[state]}` : ''}`}
                    accessibilityState={{ selected: state !== null, disabled: off }}
                    disabled={off}
                    onPress={() => {
                      haptic.select();
                      onPress(friday);
                    }}
                    testID={`weekend-${friday}`}
                    style={({ pressed }) => [
                      styles.weekend,
                      state ? { backgroundColor: FILL[state] } : styles.weekendFree,
                      off && styles.weekendOff,
                      !pressed && !off && hardShadow(state ? 3 : 2),
                      pressed && { transform: [{ translateX: 1 }, { translateY: 1 }] },
                    ]}
                  >
                    {week.slice(4).map((iso) => (
                      <Text key={iso} style={[styles.weekendDay, off && styles.dayOff]}>
                        {Number(iso.slice(8))}
                      </Text>
                    ))}
                  </Pressable>
                ) : (
                  week.slice(4).map((iso) => <Day key={iso} iso={iso} month={month} />)
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Day({ iso, month }: { iso: string; month: number }) {
  const outside = monthOf(iso).month !== month;
  return (
    <View style={styles.cell} importantForAccessibility="no" accessibilityElementsHidden>
      <Text style={[styles.day, outside && styles.dayOutside]}>{Number(iso.slice(8))}</Text>
    </View>
  );
}

/** Légende des états, pour le questionnaire (dispo / peut-être / pas dispo). */
export function AvailabilityLegend() {
  return (
    <View style={styles.legend}>
      <LegendItem color={colors.mint} label="1 toucher : dispo" />
      <LegendItem color={colors.sun} label="2 : peut-être" />
      <LegendItem color={colors.paper} label="3 : pas dispo" />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Caption>{label}</Caption>
    </View>
  );
}

const CELL = 46;

const styles = StyleSheet.create({
  months: { gap: space(6) },
  month: { gap: space(1) },
  monthTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.ink,
    textTransform: 'capitalize',
    marginBottom: space(1),
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: CELL, gap: 0 },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  dayNameWeekend: { color: colors.inkSoft },
  cell: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  day: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkMuted, opacity: 0.55 },
  dayOutside: { opacity: 0.25 },
  weekend: {
    flex: 3,
    height: CELL - 6,
    marginVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER,
    borderColor: colors.ink,
    borderRadius: radius.pill,
  },
  weekendFree: { backgroundColor: colors.paper },
  weekendOff: { borderColor: colors.line, backgroundColor: 'transparent' },
  weekendDay: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  dayOff: { color: colors.inkMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.ink },
});
