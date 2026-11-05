import { useState } from 'react';
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
  /** un mois à la fois, avec des flèches (pour les longues fenêtres, ex. 6 mois) */
  paged?: boolean;
}

/**
 * Calendrier mois par mois : seuls les week-ends proposés se touchent, d'un seul geste
 * (vendredi → dimanche). Les autres jours restent visibles mais grisés, pour se repérer.
 */
export function WeekendCalendar({ weekends, mark, onPress, nights = 2, disabled, paged = false }: Props) {
  const fridays = new Set(weekends);
  const months: { year: number; month: number }[] = [];
  for (const w of [...weekends].sort()) {
    const m = monthOf(w);
    if (!months.some((x) => x.year === m.year && x.month === m.month)) months.push(m);
  }

  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, months.length - 1));
  const shown = paged ? months.slice(current, current + 1) : months;
  // en mode paginé, on signale les week-ends déjà choisis dans chaque mois
  const picked = (m: { year: number; month: number }) =>
    weekends.filter((w) => {
      const wm = monthOf(w);
      return wm.year === m.year && wm.month === m.month && mark(w) !== null;
    }).length;

  return (
    <View style={styles.months}>
      {paged && months.length > 1 ? (
        <View style={styles.tabs}>
          {months.map((m, i) => {
            const on = i === current;
            const n = picked(m);
            return (
              <Pressable
                key={`${m.year}-${m.month}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${monthTitle(m.year, m.month)}${n ? `, ${n} choisi${n > 1 ? 's' : ''}` : ''}`}
                onPress={() => {
                  haptic.select();
                  setPage(i);
                }}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={styles.tabLabel}>{monthShort(m.month)}</Text>
                {n > 0 ? <View style={styles.tabDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {shown.map(({ year, month }) => (
        <View key={`${year}-${month}`} style={styles.month}>
          {paged ? (
            <View style={styles.pager}>
              <PagerArrow label="Mois précédent" glyph="‹" hidden={current === 0} onPress={() => setPage(current - 1)} />
              <Text style={[styles.monthTitle, styles.monthTitlePaged]}>{monthTitle(year, month)}</Text>
              <PagerArrow
                label="Mois suivant"
                glyph="›"
                hidden={current >= months.length - 1}
                onPress={() => setPage(current + 1)}
              />
            </View>
          ) : (
            <Text style={styles.monthTitle}>{monthTitle(year, month)}</Text>
          )}
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

const MONTH_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
const monthShort = (month: number) => MONTH_SHORT[month];

function PagerArrow({ label, glyph, hidden, onPress }: { label: string; glyph: string; hidden: boolean; onPress: () => void }) {
  if (hidden) return <View style={styles.arrow} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [styles.arrow, styles.arrowOn, !pressed && hardShadow(2)]}
    >
      <Text style={styles.arrowGlyph}>{glyph}</Text>
    </Pressable>
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
  monthTitlePaged: { flex: 1, textAlign: 'center', marginBottom: 0 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(2) },
  arrow: { width: 40, height: 40 },
  arrowOn: {
    borderRadius: 20,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 26, color: colors.ink, marginTop: -2 },
  tabs: { flexDirection: 'row', gap: space(1) },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
  },
  tabOn: { borderColor: colors.ink, backgroundColor: colors.sun },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sunset, marginTop: 2 },
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
