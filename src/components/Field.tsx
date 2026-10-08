import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Caption, Label } from '@/components/Typography';
import { BORDER, colors, fonts, hardShadow, radius, space } from '@/theme/tokens';

interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  big?: boolean;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, big = false, style, ...props },
  ref,
) {
  return (
    <View style={styles.wrap}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.inkMuted}
        {...props}
        style={[styles.input, big && styles.big, hardShadow(3), error ? styles.inputError : null, style]}
      />
      {error ? <Caption color={colors.danger}>{error}</Caption> : hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space(2) },
  input: {
    borderWidth: BORDER,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    minHeight: 56,
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: colors.ink,
  },
  big: { fontFamily: fonts.displayBold, fontSize: 26, minHeight: 68 },
  inputError: { borderColor: colors.danger },
});
