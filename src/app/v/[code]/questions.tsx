import { router, useLocalSearchParams } from 'expo-router';
import { Children, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { ProgressBar } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Slider } from '@/components/Slider';
import { Tile } from '@/components/Tile';
import { TopBar } from '@/components/TopBar';
import { AvailabilityLegend, WeekendCalendar } from '@/components/WeekendCalendar';
import { Field } from '@/components/Field';
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
  type CityId,
  type ComfortLevel,
  type CriterionKey,
  type Importance,
  type WeatherImportance,
} from '@/engine';
import { backend } from '@/lib/backend';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useVadrouille } from '@/lib/useVadrouille';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Draft = Omit<Answers, 'availability' | 'departureCity'> & {
  availability: Record<string, Availability | undefined>;
  /** undefined tant que « Autre » est ouvert sans ville reconnue ni choisie */
  departureCity: CityId | undefined;
};

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

/** Grille 2 colonnes : un nombre impair de tuiles garde la dernière à demi-largeur. */
function TileGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <View style={styles.grid}>
      {items}
      {items.length % 2 === 1 ? <View style={styles.gridSpacer} /> : null}
    </View>
  );
}

/** Toucher un week-end : pas dispo → dispo → peut-être → pas dispo. */
const NEXT_AVAILABILITY: Record<Availability, Availability> = { no: 'yes', yes: 'maybe', maybe: 'no' };

/** Les villes affichées d'office ; les autres passent par « Autre ». */
const MAIN_CITIES: CityId[] = ['paris', 'lyon', 'marseille', 'bordeaux', 'lille'];

/** « Saint-Étienne » → « saint etienne » : pour reconnaître une ville tapée à la main. */
const normalize = (x: string) =>
  x
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** 5 grandes villes + « Autre » : ville tapée, reconnue si on la connaît, sinon la grande ville la plus proche. */
function CityStep({ d, set }: { d: Draft; set: SetDraft }) {
  const known = (id: CityId | undefined) => CITIES.find((c) => c.id === id);
  const [other, setOther] = useState(() => d.departureCity !== undefined && !MAIN_CITIES.includes(d.departureCity));
  const [typed, setTyped] = useState(() => (other ? (known(d.departureCity)?.name ?? '') : ''));

  const query = normalize(typed);
  const exact = CITIES.find((c) => normalize(c.name) === query);
  const suggestions = query.length >= 2 && !exact ? CITIES.filter((c) => normalize(c.name).startsWith(query)) : [];
  const unknown = query.length >= 2 && !exact && suggestions.length === 0;

  const onType = (text: string) => {
    setTyped(text);
    const match = CITIES.find((c) => normalize(c.name) === normalize(text));
    set({ departureCity: match?.id });
  };

  return (
    <View style={{ gap: space(4) }}>
      <TileGrid>
        {MAIN_CITIES.map((id) => (
          <Tile
            key={id}
            compact
            style={styles.cityTile}
            label={known(id)?.name ?? id}
            selected={!other && d.departureCity === id}
            onPress={() => {
              setOther(false);
              set({ departureCity: id });
            }}
          />
        ))}
        <Tile
          compact
          style={styles.cityTile}
          label="Autre"
          emoji="✏️"
          selected={other}
          testID="city-other"
          onPress={() => {
            setOther(true);
            set({ departureCity: exact?.id });
          }}
        />
      </TileGrid>

      {other ? (
        <View style={{ gap: space(3) }}>
          <Field
            label="Ta ville"
            placeholder="Ex. : Rennes, Angers, Genève…"
            value={typed}
            onChangeText={onType}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            testID="city-input"
          />
          {exact ? <Caption>✅ On a les trajets depuis {exact.name}.</Caption> : null}
          {suggestions.length > 0 ? (
            <TileGrid>
              {suggestions.map((c) => (
                <Tile key={c.id} compact label={c.name} selected={false} onPress={() => onType(c.name)} />
              ))}
            </TileGrid>
          ) : null}
          {unknown ? (
            <View style={{ gap: space(3) }}>
              <Body>
                On n’a pas encore les trajets depuis « {typed.trim()} ». Quelle grande ville est la plus proche de chez
                toi ? On calculera ton trajet depuis là.
              </Body>
              <TileGrid>
                {CITIES.map((c) => (
                  <Tile
                    key={c.id}
                    compact
                    label={c.name}
                    selected={d.departureCity === c.id}
                    onPress={() => set({ departureCity: c.id })}
                  />
                ))}
              </TileGrid>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Flexibilité, posée en mots simples pour chaque critère. Sous le capot, on garde les trois
 * niveaux du moteur : « très flexible » = négociable, « un peu » = souhaitable (par défaut),
 * « pas du tout » = indispensable (filtre dur).
 */
const FLEX_ORDER: Importance[] = ['negociable', 'souhaitable', 'indispensable'];

const FLEX_COPY: Partial<Record<CriterionKey, { question: string; labels: [string, string, string] }>> = {
  budget: { question: 'Ton budget est-il flexible ?', labels: ['Oui, assez', 'Un peu', 'Non, c’est mon max'] },
  travelTime: { question: 'Et ce temps de trajet, flexible ?', labels: ['Oui, assez', 'Un peu', 'Non, pas plus'] },
  transports: { question: 'Prêt·e à prendre un autre transport ?', labels: ['Oui, sans souci', 'Si besoin', 'Non, que ceux-là'] },
  cadres: { question: 'Prêt·e à changer de décor ?', labels: ['Oui, sans souci', 'Pourquoi pas', 'Non, j’y tiens'] },
  envies: { question: 'Et si le programme était un peu différent ?', labels: ['Ça me va', 'Pourquoi pas', 'Non, j’y tiens'] },
  comfort: { question: 'Prêt·e à faire une concession sur le confort ?', labels: ['Oui, sans souci', 'Un peu', 'Non, j’y tiens'] },
  ambiance: { question: 'Et si l’ambiance était différente ?', labels: ['Ça me va', 'Pourquoi pas', 'Non, j’y tiens'] },
};

/** Réglage discret : par défaut « un peu » (souhaitable), on n'y touche que si on y tient. */
function FlexibilityPicker({
  criterion,
  value,
  onChange,
}: {
  criterion: CriterionKey;
  value: Importance;
  onChange: (v: Importance) => void;
}) {
  const copy = FLEX_COPY[criterion];
  if (!copy) return null;
  return (
    <View style={styles.importance}>
      <Caption>{copy.question}</Caption>
      <View style={styles.importanceRow}>
        {FLEX_ORDER.map((level, i) => {
          const on = level === value;
          const strict = level === 'indispensable';
          return (
            <Pressable
              key={level}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${copy.question} ${copy.labels[i]}`}
              onPress={() => {
                haptic.select();
                onChange(level);
              }}
              style={[styles.importanceChip, on && (strict ? styles.importanceMust : styles.importanceOn)]}
            >
              <Text style={[styles.importanceLabel, on && strict && { color: colors.paper }]}>{copy.labels[i]}</Text>
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
    title: 'T’es dispo quand ?',
    hint: 'Touche les week-ends où tu peux venir.',
    valid: () => true,
    render: (d, set, { weekends, nights }) => {
      const none = weekends.every((w) => (d.availability[w] ?? 'no') === 'no');
      return (
        <View style={{ gap: space(4) }}>
          <AvailabilityLegend />
          <WeekendCalendar
            weekends={weekends}
            nights={nights}
            mark={(w) => {
              const a = d.availability[w];
              return a === 'yes' ? 'yes' : a === 'maybe' ? 'maybe' : null;
            }}
            onPress={(w) =>
              set((cur) => ({ availability: { ...cur.availability, [w]: NEXT_AVAILABILITY[cur.availability[w] ?? 'no'] } }))
            }
          />
          {none ? <Caption>Aucun week-end touché : tu seras compté comme pas dispo.</Caption> : null}
        </View>
      );
    },
  },
  {
    key: 'city',
    emoji: '📍',
    title: 'De quelle ville pars-tu ?',
    hint: 'Ton trajet et ton budget sont calculés depuis ta ville.',
    valid: (d) => d.departureCity !== undefined,
    render: (d, set) => <CityStep d={d} set={set} />,
  },
  {
    key: 'budget',
    emoji: '💰',
    title: 'Ton budget max, tout compris ?',
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
    title: 'Combien de temps de trajet, max ?',
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
    key: 'cadres',
    emoji: '🌊',
    title: 'Plutôt quel décor ?',
    hint: 'Coche au moins 2 décors, ou « Peu importe ».',
    criterion: 'cadres',
    valid: (d) => d.cadres.length !== 1,
    render: (d, set) => (
      <View style={{ gap: space(3) }}>
        <TileGrid>
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
          <Tile
            compact
            label="Peu importe"
            emoji="🤷"
            selected={d.cadres.length === 0}
            onPress={() => set({ cadres: [] })}
            color={colors.mint}
            testID="cadres-any"
          />
        </TileGrid>
        {d.cadres.length === 1 ? (
          <Caption color={colors.sunsetDark}>Ajoute un 2e décor pour continuer, ou choisis « Peu importe ».</Caption>
        ) : null}
      </View>
    ),
  },
  {
    key: 'envies',
    emoji: '🎯',
    title: 'T’as envie de quoi ?',
    hint: 'Plusieurs choix possibles. Rien de coché = peu importe.',
    criterion: 'envies',
    valid: () => true,
    render: (d, set) => (
      <TileGrid>
        {ENVIES.map((e) => (
          <Tile
            key={e}
            compact
            kind="check"
            label={ENVIE_LABELS[e].label}
            emoji={ENVIE_LABELS[e].emoji}
            selected={d.envies.includes(e)}
            onPress={() =>
              set((cur) => {
                const envies = toggle(cur.envies, e);
                // plus de sport : le vélo disparaît des transports
                return envies.includes('sport') ? { envies } : { envies, transports: cur.transports.filter((m) => m !== 'bike') };
              })
            }
            color={colors.flamingo}
          />
        ))}
      </TileGrid>
    ),
  },
  {
    key: 'transports',
    emoji: '🚆',
    title: 'Tu voyages comment ?',
    hint: 'Coche tout ce qui te va. Le vélo apparaît si tu as coché Sport.',
    criterion: 'transports',
    valid: (d) => d.transports.length > 0,
    render: (d, set) => (
      <TileGrid>
        {TRANSPORT_MODES.filter((m) => m !== 'bike' || d.envies.includes('sport')).map((m) => (
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
      </TileGrid>
    ),
  },
  {
    key: 'comfort',
    emoji: '🛏️',
    title: 'Niveau confort ?',
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
    title: 'Le beau temps, ça compte ?',
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
              // 3 niveaux, aucun n'est éliminatoire (l'ancien « grand soleil obligé » l'était)
              const { weather: _w, ...rest } = d.importance;
              set({ weather: level as WeatherImportance, importance: rest });
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
    title: 'Quelle ambiance ?',
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
    if (!data || draft) return;
    const fresh = blank(data.vadrouille.weekends);
    if (data.isOrganizer) fresh.availability = Object.fromEntries(data.vadrouille.weekends.map((w) => [w, 'yes']));
    setDraft(data.myAnswers ?? fresh);
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
  // l'orga a donné ses dispos en choisissant les week-ends : on ne les redemande pas
  const steps = data.isOrganizer ? STEPS.filter((s) => s.key !== 'availability') : STEPS;
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const set: SetDraft = (patch) =>
    setDraft((d) => (d ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d));
  const importance = step.criterion ? (draft.importance[step.criterion] ?? 'souhaitable') : 'souhaitable';

  const setImportance = (value: Importance) => {
    if (!step.criterion) return;
    const { [step.criterion]: _removed, ...rest } = draft.importance;
    set({ importance: value === 'souhaitable' ? rest : { ...rest, [step.criterion]: value } });
  };

  // à la 1re question, retour à la page de la Vadrouille (on peut y arriver directement depuis la création)
  const back = () => (index > 0 ? setIndex(index - 1) : router.replace(`/v/${code}` as never));

  const next = async () => {
    setSaveError(null);
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    try {
      // un week-end jamais touché dans le calendrier = pas dispo
      const availability = Object.fromEntries(weekends.map((w) => [w, draft.availability[w] ?? 'no']));
      await backend.saveAnswers(data.vadrouille.id, { ...draft, availability } as Answers);
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
      header={<TopBar title={`${index + 1} / ${steps.length}`} onBack={back} />}
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
      <ProgressBar value={(index + 1) / steps.length} />
      <View style={{ gap: space(1) }}>
        <Text style={styles.stepEmoji}>{step.emoji}</Text>
        <Title>{step.title}</Title>
        <Body color={colors.inkSoft}>{step.hint}</Body>
      </View>
      {step.render(draft, set, { weekends, nights })}
      {step.criterion ? (
        <FlexibilityPicker criterion={step.criterion} value={importance} onChange={setImportance} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepEmoji: { fontSize: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  gridSpacer: { flexGrow: 1, flexBasis: '45%' },
  cityTile: { minHeight: 72 },
  bigValue: { alignItems: 'center', paddingVertical: space(5), gap: space(1) },
  bigValueText: { fontSize: 64, lineHeight: 68 },
  ambianceEmoji: { fontSize: 64 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  importance: { gap: space(2), marginTop: space(2), paddingTop: space(4), borderTopWidth: 2, borderTopColor: colors.line },
  importanceRow: { flexDirection: 'row', gap: space(2) },
  importanceChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(1),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
  importanceOn: { borderColor: colors.ink, backgroundColor: colors.paper },
  importanceMust: { borderColor: colors.ink, backgroundColor: colors.ink },
  importanceLabel: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 15, color: colors.ink, textAlign: 'center' },
});
