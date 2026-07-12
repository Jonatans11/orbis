import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
});
