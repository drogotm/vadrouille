import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Body, Caption, Display, Heading, Label, Strong } from '@/components/Typography';
import {
  CITIES,
  COMFORT_LABELS,
  formatDuration,
  formatEuros,
  getDestination,
  TRANSPORT_LABELS,
  type Suggestion,
} from '@/engine';
import type { VadrouilleState } from '@/lib/backend';
import { activityUrl, lodgingUrl, placeName, stayDates, transportUrl, type StayDates } from '@/lib/booking';
import { weekendRange } from '@/lib/dates';
import { env } from '@/lib/env';
import { inviteUrl, shareMessage } from '@/lib/links';
import { colors, space } from '@/theme/tokens';

import { OptionCard } from './OptionCard';

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
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => Linking.openURL(url)}
      style={styles.bookLink}
    >
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

/** Destination choisie : le plan du séjour et MON budget prévisionnel. */
export function Plan({ state }: { state: VadrouilleState }) {
  const { vadrouille, options, myDetails, tally } = state;
  const [showAll, setShowAll] = useState(false);
  const winner = options.find((o) => o.id === vadrouille.decidedOptionId) ?? options[0];
  if (!winner) return null;
  const dest = getDestination(winner.destinationId);
  const mine = myDetails[winner.id];
  const data = winner.publicData;
  const votes = tally[winner.id] ?? 0;
  const place = placeName(dest?.name ?? '');
  const dates = stayDates(winner.weekendStart, vadrouille.nights);
  const myCity = CITIES.find((c) => c.id === state.myAnswers?.departureCity)?.name;
  const myTrip = mine?.transport && myCity ? transportUrl(mine.transport.mode, myCity, place, dates) : null;

  return (
    <>
      <View style={{ gap: space(1) }}>
        <Label>{vadrouille.name} · c’est décidé 🎉</Label>
        <Display>On part à {dest?.name ?? ''} !</Display>
        <View style={styles.pills}>
          <Pill label={weekendRange(winner.weekendStart, vadrouille.nights)} emoji="📅" color={colors.sun} />
          <Pill label={`${votes} vote${votes > 1 ? 's' : ''}`} emoji="🗳️" />
        </View>
      </View>

      <OptionCard option={winner} highlighted />

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
              label={`${COMFORT_LABELS[winner.comfort].emoji} Logement ${COMFORT_LABELS[winner.comfort].label.toLowerCase()} · ${data.nights} nuits`}
              value={formatEuros(mine.lodging)}
            />
            <BookLink
              label={`Chercher un logement pour ${state.members.length} sur Booking`}
              url={lodgingUrl(place, dates, state.members.length)}
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
          <Caption>Tu n’avais pas répondu au questionnaire : pas de budget personnalisé pour cette fois.</Caption>
        </Card>
      )}

      <Suggestions title="🎯 À faire sur place" items={data.suggestions.activities} booking={{ place, dates }} />
      <Suggestions title="🍷 Où manger" items={data.suggestions.restaurants} />

      <Card shadow={0}>
        <View style={styles.line}>
          <Heading style={{ flex: 1 }}>Les 3 options proposées</Heading>
          <Button
            title={showAll ? 'Masquer' : 'Revoir'}
            variant="ghost"
            size="sm"
            onPress={() => setShowAll((v) => !v)}
            testID="show-options"
          />
        </View>
        <Caption>Celles calculées à partir de vos réponses, avec le détail pour toi.</Caption>
      </Card>
      {showAll
        ? options.map((o) => {
            const n = tally[o.id] ?? 0;
            return (
              <OptionCard key={o.id} option={o} mine={myDetails[o.id]} highlighted={o.id === winner.id}>
                <Caption>
                  {o.id === winner.id ? '🏆 Choisie · ' : ''}
                  {n} vote{n > 1 ? 's' : ''}
                </Caption>
              </OptionCard>
            );
          })
        : null}

      <Button
        title="Annoncer à la bande"
        emoji="📣"
        variant="secondary"
        onPress={() =>
          shareMessage(
            `C’est décidé : on part à ${dest?.name ?? ''} du ${weekendRange(winner.weekendStart, vadrouille.nights)} 🎉\nLe plan : ${inviteUrl(vadrouille.inviteCode)}`,
          )
        }
      />

      <Card color={colors.flamingoSoft}>
        <Heading>La prochaine, c’est toi qui l’organises ?</Heading>
        <Body>Un anniversaire, un EVG, un week-end entre collègues : 2 minutes pour lancer.</Body>
        <Button title="Créer ma Vadrouille" emoji="🎒" size="md" onPress={() => router.push('/nouvelle')} />
        {Platform.OS === 'web' ? (
          env.appStoreUrl ? (
            <Button
              title="Installer l’app pour suivre la suite"
              variant="dark"
              size="md"
              onPress={() => Linking.openURL(env.appStoreUrl)}
            />
          ) : (
            <Caption>📱 L’app iPhone arrive bientôt sur l’App Store.</Caption>
          )
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space(3) },
  separator: { height: 2, backgroundColor: colors.ink, marginVertical: space(1) },
  suggestion: { gap: 2, marginTop: space(3) },
  bookLink: { alignSelf: 'flex-start', paddingVertical: space(1) },
});
