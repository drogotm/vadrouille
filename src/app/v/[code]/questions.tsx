import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { ProgressBar } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Slider } from '@/components/Slider';
import { Tile } from '@/components/Tile';
import { TopBar } from '@/components/TopBar';
import { Body, Caption, Display, Strong, Title } from '@/components/Typography';
import {
  ambianceLabel,
  CADRE_LABELS,
  CADRES,
  CITIES,
  COMFORT_IDS,
  COMFORT_LABELS,
  ENVIE_LABELS,
  ENVIES,
  TRANSPORT_LABELS,
  TRANSPORT_MODES,
  WEATHER_LABELS,
  type Answers,
  type Availability,
  type ComfortLevel,
  type CriterionKey,
  type Importance,
  type WeatherImportance,
} from '@/engine';
import { backend } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useVadrouille } from '@/lib/useVadrouille';
import { BORDER, colors, fonts, hardShadow, radius, space } from '@/theme/tokens';

type Draft = Omit<Answers, 'availability'> & { availability: Record<string, Availability | undefined> };

const blank = (weekends: string[]): Draft => ({
  version: 1,
  availability: Object.fromEntries(weekends.map((w) => [w, undefined])),
  departureCity: 'paris',
  budgetMax: 300,
  maxTravelHours: 4,
  transports: ['train', 'car'],
  cadres: [],
  envies: [],
  comfort: 1,
  weather: 1,
  ambiance: 0.5,
  importance: {},
});

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

const AVAILABILITY: { value: Availability; label: string; emoji: string; color: string }[] = [
  { value: 'yes', label: 'Dispo', emoji: '✅', color: colors.mint },
  { value: 'maybe', label: 'Peut-être', emoji: '🤔', color: colors.sun },
  { value: 'no', label: 'Pas dispo', emoji: '❌', color: colors.sunsetSoft },
];

const IMPORTANCE: { value: Importance; label: string; emoji: string }[] = [
  { value: 'negociable', label: 'Négociable', emoji: '🤷' },
  { value: 'souhaitable', label: 'Souhaitable', emoji: '👍' },
  { value: 'indispensable', label: 'Indispensable', emoji: '🔒' },
];

/** Réglage discret : par défaut « souhaitable », on n'y touche que si on y tient. */
function ImportancePicker({ value, onChange }: { value: Importance; onChange: (v: Importance) => void }) {
  return (
    <View style={styles.importance}>
      <Caption>À quel point ça compte pour toi ?</Caption>
      <View style={styles.importanceRow}>
        {IMPORTANCE.map((opt) => {
          const on = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={opt.label}
              onPress={() => {
                haptic.select();
                onChange(opt.value);
              }}
              style={[styles.importanceChip, on && (opt.value === 'indispensable' ? styles.importanceMust : styles.importanceOn)]}
            >
              <Text style={[styles.importanceLabel, on && opt.value === 'indispensable' && { color: colors.paper }]}>
                {opt.emoji} {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Accepte un patch, ou une fonction du brouillon courant (taps rapprochés sur les multi-choix). */
type SetDraft = (patch: Partial<Draft> | ((current: Draft) => Partial<Draft>)) => void;

interface StepDef {
  key: string;
  emoji: string;
  title: string;
  hint: string;
  criterion?: CriterionKey;
  valid: (d: Draft, weekends: string[]) => boolean;
  render: (d: Draft, set: SetDraft, ctx: { weekends: string[]; nights: number }) => ReactNode;
}

const STEPS: StepDef[] = [
  {
    key: 'availability',
    emoji: '📅',
    title: 'T’es dispo quand ?',
    hint: 'Réponds pour chaque week-end.',
    valid: (d, weekends) => weekends.every((w) => d.availability[w] !== undefined),
    render: (d, set, { weekends, nights }) => (
      <View style={{ gap: space(4) }}>
        {weekends.map((w) => (
          <View key={w} style={{ gap: space(2) }}>
            <Strong>{weekendRange(w, nights)}</Strong>
            <View style={styles.availabilityRow}>
              {AVAILABILITY.map((a) => {
                const on = d.availability[w] === a.value;
                return (
                  <Pressable
                    key={a.value}
                    testID={`avail-${a.value}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${a.label}, ${weekendRange(w, nights)}`}
                    onPress={() => {
                      haptic.select();
                      set((cur) => ({ availability: { ...cur.availability, [w]: a.value } }));
                    }}
                    style={[styles.availability, on && { backgroundColor: a.color }, hardShadow(on ? 3 : 1)]}
                  >
                    <Text style={styles.availabilityEmoji}>{a.emoji}</Text>
                    <Text style={styles.availabilityLabel}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    ),
  },
  {
    key: 'city',
    emoji: '📍',
    title: 'Tu pars d’où ?',
    hint: 'Ton trajet et ton budget sont calculés depuis ta ville.',
    valid: () => true,
    render: (d, set) => (
      <View style={styles.grid}>
        {CITIES.map((c) => (
          <Tile
            key={c.id}
            compact
            style={styles.cityTile}
            label={c.name}
            selected={d.departureCity === c.id}
            onPress={() => set({ departureCity: c.id })}
          />
        ))}
      </View>
    ),
  },
  {
    key: 'budget',
    emoji: '💰',
    title: 'Ton budget max, tout compris ?',
    hint: 'Transport + logement + bouffe + activités. Personne ne le verra.',
    criterion: 'budget',
    valid: () => true,
    render: (d, set) => (
      <View>
        <View style={styles.bigValue}>
          <Display style={styles.bigValueText}>{d.budgetMax} €</Display>
          <Caption>par personne, pour le week-end</Caption>
        </View>
        <Slider
          value={d.budgetMax}
          min={100}
          max={1000}
          step={10}
          onChange={(v) => set({ budgetMax: v })}
          accessibilityLabel="Budget maximum"
          formatValue={(v) => `${v} euros`}
          testID="budget-slider"
        />
        <View style={styles.scale}>
          <Caption>100 €</Caption>
          <Caption>1 000 €</Caption>
        </View>
      </View>
    ),
  },
  {
    key: 'travel',
    emoji: '⏱️',
    title: 'Combien de temps de trajet, max ?',
    hint: 'Pour l’aller, porte à porte.',
    criterion: 'travelTime',
    valid: () => true,
    render: (d, set) => (
      <View>
        <View style={styles.bigValue}>
          <Display style={styles.bigValueText}>
            {Math.floor(d.maxTravelHours)}h{d.maxTravelHours % 1 ? '30' : ''}
          </Display>
          <Caption>l’aller</Caption>
        </View>
        <Slider
          value={d.maxTravelHours}
          min={1}
          max={8}
          step={0.5}
          onChange={(v) => set({ maxTravelHours: v })}
          color={colors.lagoon}
          accessibilityLabel="Temps de trajet maximum"
          formatValue={(v) => `${v} heures`}
        />
        <View style={styles.scale}>
          <Caption>1h</Caption>
          <Caption>8h</Caption>
        </View>
      </View>
    ),
  },
  {
    key: 'transports',
    emoji: '🚆',
    title: 'Tu voyages comment ?',
    hint: 'Coche tout ce qui te va.',
    criterion: 'transports',
    valid: (d) => d.transports.length > 0,
    render: (d, set) => (
      <View style={styles.grid}>
        {TRANSPORT_MODES.map((m) => (
          <Tile
            key={m}
            compact
            kind="check"
            label={TRANSPORT_LABELS[m].label}
            emoji={TRANSPORT_LABELS[m].emoji}
            selected={d.transports.includes(m)}
            onPress={() => set((cur) => ({ transports: toggle(cur.transports, m) }))}
            color={colors.sky}
          />
        ))}
      </View>
    ),
  },
  {
    key: 'cadres',
    emoji: '🌊',
    title: 'Plutôt quel décor ?',
    hint: 'Plusieurs choix possibles. Rien de coché = peu importe.',
    criterion: 'cadres',
    valid: () => true,
    render: (d, set) => (
      <View style={styles.grid}>
        {CADRES.map((c) => (
          <Tile
            key={c}
            compact
            kind="check"
            label={CADRE_LABELS[c].label}
            emoji={CADRE_LABELS[c].emoji}
            selected={d.cadres.includes(c)}
            onPress={() => set((cur) => ({ cadres: toggle(cur.cadres, c) }))}
            color={colors.mint}
          />
        ))}
      </View>
    ),
  },
  {
    key: 'envies',
    emoji: '🎯',
    title: 'T’as envie de quoi ?',
    hint: 'Plusieurs choix possibles. Rien de coché = peu importe.',
    criterion: 'envies',
    valid: () => true,
    render: (d, set) => (
      <View style={styles.grid}>
        {ENVIES.map((e) => (
          <Tile
            key={e}
            compact
            kind="check"
            label={ENVIE_LABELS[e].label}
            emoji={ENVIE_LABELS[e].emoji}
            selected={d.envies.includes(e)}
            onPress={() => set((cur) => ({ envies: toggle(cur.envies, e) }))}
            color={colors.flamingo}
          />
        ))}
      </View>
    ),
  },
  {
    key: 'comfort',
    emoji: '🛏️',
    title: 'Niveau confort ?',
    hint: 'Pour le logement.',
    criterion: 'comfort',
    valid: () => true,
    render: (d, set) => (
      <View style={{ gap: space(3) }}>
        {COMFORT_IDS.map((id, level) => (
          <Tile
            key={id}
            label={COMFORT_LABELS[id].label}
            emoji={COMFORT_LABELS[id].emoji}
            description={COMFORT_LABELS[id].description}
            selected={d.comfort === level}
            onPress={() => set({ comfort: level as ComfortLevel })}
            color={colors.lavender}
          />
        ))}
      </View>
    ),
  },
  {
    key: 'weather',
    emoji: '☀️',
    title: 'Le beau temps, ça compte ?',
    hint: 'On regarde l’ensoleillement habituel à ces dates.',
    valid: () => true,
    render: (d, set) => (
      <View style={{ gap: space(3) }}>
        {WEATHER_LABELS.map((w, level) => (
          <Tile
            key={w.label}
            label={w.label}
            emoji={w.emoji}
            selected={d.weather === level}
            onPress={() => {
              // « grand soleil obligé » = critère indispensable ; les autres niveaux le relâchent
              const { weather: _w, ...rest } = d.importance;
              set({
                weather: level as WeatherImportance,
                importance: level === 3 ? { ...rest, weather: 'indispensable' } : rest,
              });
            }}
            color={colors.sun}
          />
        ))}
      </View>
    ),
  },
  {
    key: 'ambiance',
    emoji: '🌙',
    title: 'Quelle ambiance ?',
    hint: 'De la sieste au marathon de bars.',
    criterion: 'ambiance',
    valid: () => true,
    render: (d, set) => (
      <View>
        <View style={styles.bigValue}>
          <Text style={styles.ambianceEmoji}>{d.ambiance < 0.35 ? '🧘' : d.ambiance <= 0.65 ? '🍹' : '🔥'}</Text>
          <Title center>{ambianceLabel(d.ambiance)}</Title>
        </View>
        <Slider
          value={d.ambiance}
          min={0}
          max={1}
          step={0.1}
          onChange={(v) => set({ ambiance: v })}
          color={colors.flamingo}
          accessibilityLabel="Ambiance, de chill à intense"
          formatValue={ambianceLabel}
        />
        <View style={styles.scale}>
          <Caption>Chill</Caption>
          <Caption>Intense</Caption>
        </View>
      </View>
    ),
  },
];

export default function Questions() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { data, isLoading, sessionLoading, error, refetch, refresh } = useVadrouille(code);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // on initialise le brouillon une seule fois, à partir de mes réponses existantes s'il y en a
  useEffect(() => {
    if (data && !draft) setDraft(data.myAnswers ?? blank(data.vadrouille.weekends));
  }, [data, draft]);

  if (sessionLoading || isLoading) return <Screen><LoadingView /></Screen>;
  if (error) return <Screen><ErrorView error={error} onRetry={() => refetch()} /></Screen>;
  if (!data) {
    // pas (encore) membre : on repasse par l'invitation
    return (
      <Screen footer={<Button title="Voir l’invitation" onPress={() => router.replace(`/i/${code}` as never)} />}>
        <View style={styles.bigValue}>
          <Title center>Rejoins d’abord la Vadrouille</Title>
        </View>
      </Screen>
    );
  }
  if (!draft) return <Screen><LoadingView /></Screen>;

  const { weekends, nights } = data.vadrouille;
  const locked = data.vadrouille.status !== 'collecting';
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const set: SetDraft = (patch) =>
    setDraft((d) => (d ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d));
  const importance = step.criterion ? (draft.importance[step.criterion] ?? 'souhaitable') : 'souhaitable';

  const setImportance = (value: Importance) => {
    if (!step.criterion) return;
    const { [step.criterion]: _removed, ...rest } = draft.importance;
    set({ importance: value === 'souhaitable' ? rest : { ...rest, [step.criterion]: value } });
  };

  const back = () => (index > 0 ? setIndex(index - 1) : router.canGoBack() ? router.back() : router.replace(`/v/${code}` as never));

  const next = async () => {
    setSaveError(null);
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    try {
      await backend.saveAnswers(data.vadrouille.id, draft as Answers);
      haptic.success();
      await refresh();
      router.replace(`/v/${code}?merci=1` as never);
    } catch (e) {
      setSaveError(errorMessage(e));
      setBusy(false);
    }
  };

  if (locked) {
    return (
      <Screen
        header={<TopBar title={data.vadrouille.name} fallback={`/v/${code}`} />}
        footer={<Button title="Voir les résultats" onPress={() => router.replace(`/v/${code}` as never)} />}
      >
        <View style={styles.bigValue}>
          <Text style={styles.ambianceEmoji}>🔐</Text>
          <Title center>Les réponses sont figées</Title>
          <Body center color={colors.inkSoft}>
            Le calcul a été lancé. Pour modifier, l’orga doit rouvrir les réponses.
          </Body>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={<TopBar title={`${index + 1} / ${STEPS.length}`} onBack={back} />}
      footer={
        <>
          {saveError ? <Caption color={colors.danger}>{saveError}</Caption> : null}
          <Button
            title={isLast ? 'Envoyer mes réponses' : 'Suivant'}
            emoji={isLast ? '🔒' : undefined}
            onPress={next}
            disabled={!step.valid(draft, weekends)}
            loading={busy}
            testID="next"
          />
        </>
      }
    >
      <ProgressBar value={(index + 1) / STEPS.length} />
      <View style={{ gap: space(1) }}>
        <Text style={styles.stepEmoji}>{step.emoji}</Text>
        <Title>{step.title}</Title>
        <Body color={colors.inkSoft}>{step.hint}</Body>
      </View>
      {step.render(draft, set, { weekends, nights })}
      {step.criterion ? <ImportancePicker value={importance} onChange={setImportance} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepEmoji: { fontSize: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  cityTile: { minHeight: 72 },
  bigValue: { alignItems: 'center', paddingVertical: space(5), gap: space(1) },
  bigValueText: { fontSize: 64, lineHeight: 68 },
  ambianceEmoji: { fontSize: 64 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  availabilityRow: { flexDirection: 'row', gap: space(2) },
  availability: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(3),
    borderRadius: radius.md,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    gap: 2,
  },
  availabilityEmoji: { fontSize: 20 },
  availabilityLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  importance: { gap: space(2), marginTop: space(2), paddingTop: space(4), borderTopWidth: 2, borderTopColor: colors.line },
  importanceRow: { flexDirection: 'row', gap: space(2) },
  importanceChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
  importanceOn: { borderColor: colors.ink, backgroundColor: colors.paper },
  importanceMust: { borderColor: colors.ink, backgroundColor: colors.ink },
  importanceLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
});
