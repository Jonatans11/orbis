import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'premium';

const toneColor: Record<Tone, string> = {
  primary: colors.primary,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  neutral: colors.textMuted,
  premium: colors.premium,
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const color = toneColor[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
