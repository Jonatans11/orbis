/**
 * Requested compensation (spec 07 §6) — priced grants with honest v1 copy:
 * "Pending" is the ONLY status; never "earned/paid/balance" until money moves.
 * No payout-method UI is built against nothing — placeholder text only.
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { vaultCopy } from '@/features/vault/copy';
import { formatMoney, truncateDid } from '@/features/vault/format';
import { getRecordMetas, walletApi, type Grant } from '@/services/walletApi';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function CompensationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const all = await walletApi.listGrants();
      const priced = all.filter((g) => g.price_amount > 0 && g.revoked !== 1);
      setGrants(priced);
      const metas = await getRecordMetas(priced.map((g) => g.record_id));
      setTitles(new Map([...metas].map(([id, m]) => [id, m.title])));
    } catch {
      // refetch on next focus
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const total = grants.reduce((sum, g) => sum + g.price_amount, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{vaultCopy.compensationLabel}</Text>
      </View>

      <FlatList
        data={grants}
        keyExtractor={(g) => g.grant_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total requested</Text>
            <Text style={styles.totalAmount}>{formatMoney(total)}</Text>
            <Text style={styles.totalCaption}>{vaultCopy.compensationCaption}</Text>
          </Card>
        }
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('VaultRecord', { recordId: item.record_id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowMeta}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {titles.get(item.record_id) ?? 'Record'}
              </Text>
              <Text style={styles.rowCaption} numberOfLines={1}>
                {truncateDid(item.grantee_did)}
              </Text>
            </View>
            <Text style={styles.rowAmount}>{formatMoney(item.price_amount, item.price_currency)}</Text>
            <Badge label="Pending" tone="premium" />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No compensation requested yet. Add a price when you share a record.
          </Text>
        }
        ListFooterComponent={<Text style={styles.footer}>{vaultCopy.compensationFooter}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  backBtn: { padding: spacing[1] },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], flexGrow: 1 },
  totalCard: { gap: spacing[1], borderColor: colors.premium, marginBottom: spacing[4] },
  totalLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  totalAmount: { color: colors.premium, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold },
  totalCaption: { color: colors.textMuted, fontSize: fontSize.xs },
  divider: { height: 1, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  pressed: { opacity: 0.7 },
  rowMeta: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  rowCaption: { color: colors.textMuted, fontSize: fontSize.xs },
  rowAmount: { color: colors.premium, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingTop: spacing[10],
  },
  footer: { color: colors.textMuted, fontSize: fontSize.xs, paddingTop: spacing[6] },
});
