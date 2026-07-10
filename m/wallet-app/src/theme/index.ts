import type { Theme } from '@react-navigation/native';
import { DarkTheme } from '@react-navigation/native';

import { colors, fontSize, fontWeight, radius, spacing } from './tokens';

export { colors, fontSize, fontWeight, radius, spacing };

/** React Navigation theme aligned with ORBIS.ID dark design system. */
export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};
