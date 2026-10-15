import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Body, Caption, Heading, Strong } from '@/components/Typography';
import {
  CITIES,
  COMFORT_LABELS,
  formatDuration,
  formatEuros,
  getDestination,
  TRANSPORT_LABELS,
  type Suggestion,
} from '@/engine';
import type { OptionInfo, VadrouilleState } from '@/lib/backend';
import { activityUrl, lodgingUrl, placeName, stayDates, transportUrl, type StayDates } from '@/lib/booking';
import { colors, space } from '@/theme/tokens';

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const Value = bold ? Heading : Strong;
  return (
    <View style={styles.line}>
      {bold ? <Heading>{label}</Heading> : <Body style={{ flex: 1 }}>{label}</Body>}
      <Value>{value}</Value>
    </View>
  );
}

/** Lien sortant vers un site de réservation (nouvel onglet sur le web). */
function BookLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url)} style={styles.bookLink}>
      <Strong color={colors.sunset}>{label} ↗</Strong>
    </Pressable>
  );
}

function Suggestions({
  title,
  items,
  booking,
}: {
  title: string;
  items: Suggestion[];
  booking?: { place: string; dates: StayDates };
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <Heading>{title}</Heading>
      {items.map((s) => (
        <View key={s.name} style={styles.suggestion}>
          <View style={styles.line}>
            <Strong style={{ flex: 1 }}>{s.name}</Strong>
            {s.price ? <Caption>{s.price}</Caption> : null}
          </View>
          <Caption>{s.description}</Caption>
          {booking ? (
            <BookLink label="Réserver sur GetYourGuide" url={activityUrl(s.name, booking.place, booking.dates)} />
          ) : null}
        </View>
      ))}
      <Caption>Suggestions indicatives, à vérifier avant d’y aller.</Caption>
    </Card>
  );
}

/**
 * Détail d'une option pour MOI : budget prévisionnel ligne à ligne, liens de réservation
 * (trajet depuis ma ville, logement pour tout le groupe, activités) et restos.
 * Sert au plan du séjour (option gagnante) et à la page de détail de chaque option.
 */
export function OptionDetails({ state, option }: { state: VadrouilleState; option: OptionInfo }) {
  const { vadrouille, myDetails, members } = state;
  const dest = getDestination(option.destinationId);
  const mine = myDetails[option.id];
  const data = option.publicData;
  const place = placeName(dest?.name ?? '');
  const dates = stayDates(option.weekendStart, vadrouille.nights);
  const myCity = CITIES.find((c) => c.id === state.myAnswers?.departureCity)?.name;
  const myTrip = mine?.transport && myCity ? transportUrl(mine.transport.mode, myCity, place, dates) : null;

  return (
    <>
      {mine ? (
        <Card color={colors.sunSoft} testID="my-budget">
          <Heading>Ton budget prévisionnel</Heading>
          <Caption>🔒 Visible par toi uniquement, calculé depuis ta ville.</Caption>
          <View style={{ gap: space(2), marginTop: space(2) }}>
            <Line
              label={
                mine.transport
                  ? `${TRANSPORT_LABELS[mine.transport.mode].emoji} ${TRANSPORT_LABELS[mine.transport.mode].label} aller-retour · ${formatDuration(mine.transport.minutes)} l’aller`
                  : '📍 Transport · tu es sur place'
              }
              value={formatEuros(mine.transport?.cost ?? 0)}
            />
            {myTrip ? <BookLink label={`Réserver mon trajet sur ${myTrip.site}`} url={myTrip.url} /> : null}
            <Line
              label={`${COMFORT_LABELS[option.comfort].emoji} Logement ${COMFORT_LABELS[option.comfort].label.toLowerCase()} · ${data.nights} nuits`}
              value={formatEuros(mine.lodging)}
            />
            <BookLink
              label={`Chercher un logement pour ${members.length} sur Booking`}
              url={lodgingUrl(place, dates, members.length)}
            />
            <Line label="🍽️ Repas" value={formatEuros(mine.food)} />
            <Line label="🎟️ Activités" value={formatEuros(mine.activities)} />
            <View style={styles.separator} />
            <Line label="Total estimé" value={formatEuros(mine.total)} bold />
          </View>
          <Pill
            label={
              mine.withinBudget
                ? `Dans ton budget (${formatEuros(mine.budgetMax)} max)`
                : `${formatEuros(mine.total - mine.budgetMax)} au-dessus de ton max`
            }
            emoji={mine.withinBudget ? '✅' : '⚠️'}
            color={mine.withinBudget ? colors.mint : colors.sunsetSoft}
          />
          <Caption>≈ Estimations : les prix réels dépendront de vos réservations.</Caption>
        </Card>
      ) : (
        <Card shadow={0}>
          <Caption>Tu n’as pas répondu au questionnaire : pas de budget personnalisé pour cette fois.</Caption>
          <BookLink
            label={`Chercher un logement pour ${members.length} sur Booking`}
            url={lodgingUrl(place, dates, members.length)}
          />
        </Card>
      )}

      <Suggestions title="🎯 À faire sur place" items={data.suggestions.activities} booking={{ place, dates }} />
      <Suggestions title="🍷 Où manger" items={data.suggestions.restaurants} />
    </>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(3) },
  separator: { height: 2, backgroundColor: colors.ink, marginVertical: space(1) },
  suggestion: { gap: 2, marginTop: space(3) },
  bookLink: { alignSelf: 'flex-start', paddingVertical: space(1) },
});
