/**
 * Identité Vadrouille : « carte postale ensoleillée », néo-brutalisme doux.
 * Contours encre épais + ombres franches décalées, couleurs chaudes, typo grotesque expressive.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  sand: '#FFF4E6',
  sandDeep: '#FBE3C4',
  paper: '#FFFFFF',
  ink: '#231A3A',
  inkSoft: '#544A6B',
  inkMuted: '#8C84A0',
  line: '#E9DCC8',
  sunset: '#FF5B3A',
  sunsetDark: '#D9401F',
  sunsetSoft: '#FFD9CF',
  sun: '#FFC83D',
  sunSoft: '#FFEDB8',
  mint: '#7BE0B4',
  mintSoft: '#D9F7EA',
  lagoon: '#12A594',
  flamingo: '#FF7AB6',
  flamingoSoft: '#FFDDEC',
  sky: '#8CCBFF',
  lavender: '#BBA9FF',
  danger: '#E5484D',
  success: '#17975F',
} as const;

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;

export const space = (n: number) => n * 4;

export const BORDER = 2.5;

/** Ombre « tampon » décalée, identique sur iOS, Android et web (boxShadow RN ≥ 0.76). */
export function hardShadow(offset = 4, color: string = colors.ink): ViewStyle {
  return { boxShadow: `${offset}px ${offset}px 0px ${color}` };
}

export const outlined: ViewStyle = {
  borderWidth: BORDER,
  borderColor: colors.ink,
};

export const text = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: colors.ink, letterSpacing: -1 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, color: colors.ink, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 25, color: colors.ink, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23, color: colors.ink },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

/** Couleurs des 3 options de résultat. */
export const optionTheme = {
  best: { bg: colors.sun, soft: colors.sunSoft, emoji: '🥇', label: 'Best Match' },
  budget: { bg: colors.mint, soft: colors.mintSoft, emoji: '💸', label: 'Budget Match' },
  wild: { bg: colors.flamingo, soft: colors.flamingoSoft, emoji: '🔥', label: 'Wild Card' },
} as const;

/** Largeur max du contenu (web / tablette) : on reste « mobile first ». */
export const CONTENT_MAX_WIDTH = 520;
