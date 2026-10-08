import { Text, type TextProps, type TextStyle } from 'react-native';

import { text } from '@/theme/tokens';

type Props = TextProps & { color?: string; center?: boolean };

function styleFor(base: TextStyle, { color, center }: Props) {
  return [base, color ? { color } : null, center ? { textAlign: 'center' as const } : null];
}

export function Display({ style, ...props }: Props) {
  return <Text accessibilityRole="header" {...props} style={[styleFor(text.display, props), style]} />;
}

export function Title({ style, ...props }: Props) {
  return <Text accessibilityRole="header" {...props} style={[styleFor(text.title, props), style]} />;
}

export function Heading({ style, ...props }: Props) {
  return <Text accessibilityRole="header" {...props} style={[styleFor(text.heading, props), style]} />;
}

export function Body({ style, ...props }: Props) {
  return <Text {...props} style={[styleFor(text.body, props), style]} />;
}

export function Strong({ style, ...props }: Props) {
  return <Text {...props} style={[styleFor(text.bodyStrong, props), style]} />;
}

export function Caption({ style, ...props }: Props) {
  return <Text {...props} style={[styleFor(text.caption, props), style]} />;
}

export function Label({ style, ...props }: Props) {
  return <Text {...props} style={[styleFor(text.label, props), style]} />;
}
