import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

const VAULT_SECTIONS = [
  {
    key: 'medical',
    icon: 'pulse' as const,
    label: 'Medical records',
    hint: 'Lab results, prescriptions, history — share with time limits, revoke anytime.',
  },
  {
    key: 'financial',
    icon: 'wallet' as const,
    label: 'Financial',
    hint: 'Bank accounts, cards, investments under your control.',
  },
  {
    key: 'documents',
    icon: 'document-text' as const,
    label: 'Documents',
    hint: 'Contracts, certificates, and files — encrypted at rest.',
  },
];

export function VaultScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Data Vault</Text>
      <Text style={styles.subtitle}>
        Encrypted personal data, stored on your device. Every item has granular consent
        controls: who, for how long, at what price. Nothing is shared without your
        explicit permission.
      </Text>

      <SectionHeader title="Your vault" />
      <View style={styles.list}>
        {VAULT_SECTIONS.map((section) => (
          <Card key={section.key} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <Ionicons name={section.icon} size={24} color={colors.accent} />
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>{section.label}</Text>
                <Text style={styles.itemHint}>{section.hint}</Text>
              </View>
            </View>
            <View style={styles.itemFooter}>
              <Badge label="Encrypted" tone="success" />
              <Badge label="Monetization off" tone="neutral" />
            </View>
          </Card>
        ))}
      </View>
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
  list: { gap: spacing[3] },
  itemCard: { gap: spacing[3] },
  itemRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  itemMeta: { flex: 1 },
  itemLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  itemHint: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16, marginTop: 2 },
  itemFooter: { flexDirection: 'row', gap: spacing[2] },
});
