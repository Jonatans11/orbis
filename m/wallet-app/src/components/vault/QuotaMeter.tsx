import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { vaultCopy } from '@/features/vault/copy';
import { formatBytes } from '@/features/vault/format';
import { colors, fontSize, radius, spacing } from '@/theme';

interface QuotaMeterProps {
  usedBytes: number;
  limitBytes: number;
  onFreeUpSpace?: () => void;
}

/** Thin storage bar under the category grid (spec 07 §1.5). Warning ≥80%, danger ≥95%. */
export function QuotaMeter({ usedBytes, limitBytes, onFreeUpSpace }: QuotaMeterProps) {
  const pct = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  const barColor = pct >= 95 ? colors.danger : pct >= 80 ? colors.warning : colors.accent;
  const label = `${formatBytes(usedBytes)} of ${formatBytes(limitBytes)} used`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Vault storage: ${label}`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={styles.wrap}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(pct, 1)}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {pct >= 80 ? (
          <Text style={[styles.warn, { color: barColor }]}>
            {vaultCopy.quotaWarning(pct)}
            {pct >= 95 && onFreeUpSpace ? (
              <Text style={styles.link} onPress={onFreeUpSpace}>
                {'  Free up space'}
              </Text>
            ) : null}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[1], marginTop: spacing[3] },
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: radius.full },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  label: { color: colors.textMuted, fontSize: fontSize.xs },
  warn: { fontSize: fontSize.xs },
  link: { color: colors.accent, fontSize: fontSize.xs },
});
