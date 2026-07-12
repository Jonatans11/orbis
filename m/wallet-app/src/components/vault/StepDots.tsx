import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/** Progress dots for the 4-step consent builder. */
export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current && styles.active, i < current && styles.done]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[2], justifyContent: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
  },
  active: { backgroundColor: colors.primary, width: 20 },
  done: { backgroundColor: colors.primary, opacity: 0.5 },
});
