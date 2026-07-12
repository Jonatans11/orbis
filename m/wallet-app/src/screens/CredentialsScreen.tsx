import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

const CATEGORIES = [
  { key: 'identity', label: 'Identity', icon: 'person-circle' as const, hint: 'Passports, licenses, memberships' },
  { key: 'medical', label: 'Medical', icon: 'medkit' as const, hint: 'Records you control and monetize' },
  { key: 'financial', label: 'Financial', icon: 'card' as const, hint: 'Accounts, proofs of funds' },
  { key: 'assets', label: 'Assets', icon: 'business' as const, hint: 'Property, vehicles, digital assets' },
];

export function CredentialsScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Credentials</Text>
      <Text style={styles.subtitle}>
        Verifiable credentials stored encrypted on this device. Share only what you
        choose — prove claims without revealing data.
      </Text>

      <SectionHeader title="Categories" />
      <View style={styles.grid}>
        {CATEGORIES.map((cat) => (
          <Card key={cat.key} style={styles.categoryCard}>
            <Ionicons name={cat.icon} size={26} color={colors.accent} />
            <Text style={styles.categoryLabel}>{cat.label}</Text>
            <Text style={styles.categoryHint}>{cat.hint}</Text>
            <Text style={styles.categoryCount}>0 credentials</Text>
          </Card>
        ))}
      </View>

      <SectionHeader title="All credentials" />
      <Card>
        <Text style={styles.emptyText}>
          No credentials yet. Receive your first credential by scanning an issuer's QR
          code from the Home tab.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing[4],
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing[2],
    lineHeight: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  categoryCard: { width: '47%', flexGrow: 1, gap: spacing[1] },
  categoryLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  categoryHint: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
  categoryCount: { color: colors.accent, fontSize: fontSize.xs, marginTop: spacing[1] },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
});
