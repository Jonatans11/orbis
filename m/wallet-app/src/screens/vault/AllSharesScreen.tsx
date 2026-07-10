/** Settings → Privacy & data → "All shares" — full consent history (spec 07 §5.3). */
import React, { useCallback, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { grantCopy } from '@/features/vault/copy';
import { truncateDid } from '@/features/vault/format';
import { GrantRow } from '@/components/vault/GrantRow';
import {
  getRecordMetas,
  isGrantActive,
  walletApi,
  type Grant,
} from '@/services/walletApi';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type Filter = 'active' | 'expired' | 'revoked' | 'paid';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'expired', label: 'Expired' },
  { id: 'revoked', label: 'Revoked' },
  { id: 'paid', label: 'Paid' },
];

export function AllSharesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>('active');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await walletApi.listGrants();
      setGrants(all);
      const metas = await getRecordMetas(all.map((g) => g.record_id));
      setTitles(new Map([...metas].map(([id, m]) => [id, m.title])));
    } catch {
      // pull-to-refresh retries
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = grants.filter((g) => {
    switch (filter) {
      case 'active':
        return isGrantActive(g);
      case 'expired':
        return g.revoked !== 1 && !isGrantActive(g);
      case 'revoked':
        return g.revoked === 1;
      case 'paid':
        return g.price_amount > 0;
    }
  });

  const revoke = useCallback((grant: Grant) => {
    Alert.alert('Revoke access', grantCopy.revokeConfirm(truncateDid(grant.grantee_did)), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await walletApi.revokeGrant(grant.grant_id);
              setGrants((prev) =>
                prev.map((g) => (g.grant_id === grant.grant_id ? { ...g, revoked: 1 } : g)),
              );
              AccessibilityInfo.announceForAccessibility('Access revoked');
            } catch {
              Alert.alert('Revoke failed', 'Please check your connection and try again.');
            }
          })();
        },
      },
    ]);
  }, []);

  const shareAgain = useCallback(
    (grant: Grant) => {
      navigation.navigate('VaultShare', {
        recordId: grant.record_id,
        recordTitle: titles.get(grant.record_id),
        granteeDid: grant.grantee_did,
      });
    },
    [navigation, titles],
  );

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
        <Text style={styles.title}>All shares</Text>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const selected = filter === f.id;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(g) => g.grant_id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load().finally(() => setRefreshing(false));
        }}
        renderItem={({ item }) => (
          <GrantRow
            grant={item}
            recordTitle={titles.get(item.record_id)}
            onRevoke={revoke}
            onShareAgain={shareAgain}
            onPress={(g) => navigation.navigate('VaultRecord', { recordId: g.record_id })}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'active'
              ? 'Nothing is shared right now. Your data is private.'
              : `No ${filter} shares.`}
          </Text>
        }
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
  filters: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceSunken },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm },
  chipTextSelected: { color: colors.text, fontWeight: fontWeight.semibold },
  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingTop: spacing[16],
  },
});
