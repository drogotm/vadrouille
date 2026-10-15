import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Body, Caption, Display, Heading, Label, Strong } from '@/components/Typography';
import { backend, type Vadrouille } from '@/lib/backend';
import { weekendRange } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { colors, fonts, hardShadow, space } from '@/theme/tokens';

const STATUS: Record<Vadrouille['status'], { label: string; emoji: string; color: string }> = {
  collecting: { label: 'Réponses en cours', emoji: '✍️', color: colors.sunSoft },
  voting: { label: 'Vote ouvert', emoji: '🗳️', color: colors.flamingoSoft },
  decided: { label: 'C’est décidé', emoji: '🎉', color: colors.mintSoft },
};

export default function Home() {
  const { session, loading } = useSession();
  const mine = useQuery({
    queryKey: ['mine', session?.userId ?? null],
    queryFn: () => backend.listMine(),
    enabled: !loading && !!session,
  });
  const list = mine.data ?? [];

  return (
    <Screen
      footer={
        <Button title="Créer une Vadrouille" emoji="🎒" onPress={() => router.push('/nouvelle')} testID="create" />
      }
    >
      <View style={styles.hero}>
        <View style={styles.stamp}>
          <Text style={styles.stampEmoji}>🧭</Text>
        </View>
        <Display>Vadrouille</Display>
        <Heading color={colors.sunset}>On part où ?</Heading>
        <Body color={colors.inkSoft}>
          Le week-end qui met toute la bande d’accord. Chacun répond en privé, on vous sort 3 options
          qui marchent vraiment, vous votez.
        </Body>
      </View>

      {list.length > 0 ? (
        <View style={styles.list}>
          <Label>Tes Vadrouilles</Label>
          {list.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir ${v.name}`}
              onPress={() => router.push(`/v/${v.inviteCode}` as never)}
            >
              <Card padding={space(4)} style={styles.row}>
                <View style={{ flex: 1, gap: space(1) }}>
                  <Strong numberOfLines={1}>{v.name}</Strong>
                  <Caption>
                    {v.weekends.length} week-ends en lice · dès le {weekendRange(v.weekends[0], v.nights)}
                  </Caption>
                  <Pill label={STATUS[v.status].label} emoji={STATUS[v.status].emoji} color={STATUS[v.status].color} />
                </View>
                <Text style={styles.chevron}>→</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.steps}>
          {[
            ['1', 'Crée ta Vadrouille', '2 à 4 week-ends possibles, c’est tout.', colors.sun],
            ['2', 'Partage le lien', 'Tes potes répondent en 2 min, sans installer l’app.', colors.mint],
            ['3', 'Votez parmi 3 options', 'Best Match, Budget Match, Wild Card.', colors.flamingo],
          ].map(([n, title, text, color]) => (
            <Card key={n} padding={space(4)} shadow={3} style={styles.row}>
              <View style={[styles.number, { backgroundColor: color }]}>
                <Text style={styles.numberText}>{n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Strong>{title}</Strong>
                <Caption>{text}</Caption>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Caption center>🔒 Tes réponses restent privées : personne ne voit ton budget, même l’orga.</Caption>
      {session ? (
        <Button
          title={`${session.firstName ?? 'Mon compte'} · mon compte`}
          variant="ghost"
          size="sm"
          onPress={() => router.push('/compte')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space(2), paddingTop: space(4) },
  stamp: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    marginBottom: space(2),
    ...hardShadow(4),
  },
  stampEmoji: { fontSize: 36 },
  list: { gap: space(3) },
  steps: { gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  chevron: { fontSize: 24, color: colors.ink },
  number: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
});
