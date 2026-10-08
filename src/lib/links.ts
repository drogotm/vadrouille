import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

import { env } from '@/lib/env';

/**
 * Lien d'invitation. En production : https://<domaine>/i/<code> → ouvre l'app si installée
 * (universal link), sinon la version web. En dev sans domaine : lien profond de l'app.
 */
export function inviteUrl(code: string): string {
  if (env.webUrl) return `${env.webUrl}/i/${code}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/i/${code}`;
  }
  return Linking.createURL(`/i/${code}`);
}

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/** Feuille de partage native (WhatsApp, iMessage…) ; sur le web : partage natif ou copie. */
export async function shareMessage(message: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    await Clipboard.setStringAsync(message);
    return 'copied';
  }
  const res = await Share.share({ message });
  return res.action === Share.sharedAction ? 'shared' : 'dismissed';
}

export async function copyToClipboard(value: string): Promise<boolean> {
  return Clipboard.setStringAsync(value);
}

export function inviteMessage(organizer: string, name: string, url: string): string {
  return `${organizer} t’invite à « ${name} » sur Vadrouille 🎒\nOn part où ? Réponds en 2 minutes (tes réponses restent privées) :\n${url}`;
}

export function nudgeMessage(names: string[], name: string, url: string): string {
  const who =
    names.length === 0
      ? 'Petit rappel'
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  const verb = names.length > 1 ? 'il manque vos réponses' : 'il manque ta réponse';
  return `${who}, ${verb} pour « ${name} » 🙏\n2 minutes, et c’est privé :\n${url}`;
}
