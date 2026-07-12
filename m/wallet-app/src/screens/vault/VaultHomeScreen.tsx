import React, { useCallback, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { Sheet } from '@/components/Sheet';
import { GrantRow } from '@/components/vault/GrantRow';
import { QuotaMeter } from '@/components/vault/QuotaMeter';
import { CATEGORY_DEFS } from '@/features/vault/categories';
import { grantCopy, vaultCopy } from '@/features/vault/copy';
import { formatMoney, truncateDid } from '@/features/vault/format';
import { needsVaultAuth, runVaultGate } from '@/features/vault/session';
import {
  getRecordMetas,
  isGrantActive,
  walletApi,
  type Grant,
  type VaultCategoryId,
  type WalletStatus,
} from '@/services/walletApi';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

interface CategoryStat {
  count: number;
  hasMore: boolean;
  sharedCount: number;
}

export function VaultHomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [gated, setGated] = useState(needsVaultAuth());
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [stats, setStats] = useState<Partial<Record<VaultCategoryId, CategoryStat>>>({});
  const [grants, setGrants] = useState<Grant[]>([]);
  const [recordTitles, setRecordTitles] = useState<Map<string, string>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [statusRes, grantsRes, ...categoryPages] = await Promise.all([
        walletApi.status(),
        walletApi.listGrants(),
        ...CATEGORY_DEFS.map((c) => walletApi.listRecords(c.id)),
      ]);
      setStatus(statusRes);
      setGrants(grantsRes);

      const nextStats: Partial<Record<VaultCategoryId, CategoryStat>> = {};
      CATEGORY_DEFS.forEach((c, i) => {
        const page = categoryPages[i]!;
        nextStats[c.id] = {
          count: page.items.length,
          hasMore: page.nextCursor !== null,
          sharedCount: page.items.filter((r) => r.grantCount > 0).length,
        };
      });
      setStats(nextStats);

      const activeIds = grantsRes.filter((g) => isGrantActive(g)).map((g) => g.record_id);
      const metas = await getRecordMetas(activeIds);
      setRecordTitles(new Map([...metas].map(([id, m]) => [id, m.title])));
    } catch {
      setLoadError(true);
    }
  }, []);

  // Biometric re-gate on tab entry when last auth >5 min (spec 07 §1.1).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (needsVaultAuth()) {
          setGated(true);
          const ok = await runVaultGate();
          if (cancelled) return;
          setGated(!ok);
          if (!ok) return;
        }
        void load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

  if (gated) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed" size={40} color={colors.textMuted} />
        <Text style={styles.gateTitle}>Vault locked</Text>
        <Text style={styles.gateHint}>
          Your vault holds your most sensitive data. Unlock it to continue.
        </Text>
        <Button
          title="Unlock vault"
          onPress={() => {
            void (async () => {
              const ok = await runVaultGate();
              setGated(!ok);
              if (ok) void load();
            })();
          }}
          style={styles.gateBtn}
        />
      </View>
    );
  }

  const activeGrants = grants.filter((g) => isGrantActive(g));
  const pricedGrants = grants.filter((g) => g.price_amount > 0 && g.revoked !== 1);
  const totalRequestedMinor = pricedGrants.reduce((sum, g) => sum + g.price_amount, 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[2] }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Vault</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End-to-end encrypted. Learn more"
          onPress={() => setInfoOpen(true)}
          style={({ pressed }) => [styles.lockPill, pressed && styles.pressed]}
        >
          <Ionicons name="lock-closed" size={12} color={colors.success} />
          <Text style={styles.lockPillText}>{vaultCopy.encryptedPill}</Text>
        </Pressable>
      </View>

      {loadError ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>Couldn't reach your vault. Pull to retry.</Text>
        </Card>
      ) : null}

      {pricedGrants.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${vaultCopy.compensationLabel}: ${formatMoney(totalRequestedMinor)}. ${vaultCopy.compensationCaption}`}
          onPress={() => navigation.navigate('Compensation' as never)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.compCard}>
            <View style={styles.compHead}>
              <Ionicons name="cash-outline" size={18} color={colors.premium} />
              <Text style={styles.compLabel}>{vaultCopy.compensationLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.compAmount}>{formatMoney(totalRequestedMinor)}</Text>
            <Text style={styles.compCaption}>{vaultCopy.compensationCaption}</Text>
          </Card>
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        {CATEGORY_DEFS.map((cat) => {
          const stat = stats[cat.id];
          const countLabel =
            stat === undefined ? '—' : `${stat.count}${stat.hasMore ? '+' : ''}`;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label}, ${countLabel} records${
                stat && stat.sharedCount > 0 ? `, ${stat.sharedCount} shared` : ''
              }`}
              onPress={() => navigation.navigate('VaultCategory', { category: cat.id })}
              style={({ pressed }) => [
                styles.tile,
                cat.fullWidth && styles.tileWide,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={cat.icon} size={24} color={colors.accent} />
              <View style={styles.tileMeta}>
                <Text style={styles.tileLabel}>{cat.label}</Text>
                <Text style={styles.tileCount}>
                  {countLabel} {stat?.count === 1 ? 'record' : 'records'}
                </Text>
              </View>
              {stat && stat.sharedCount > 0 ? (
                <View style={styles.sharedBadge}>
                  <Text style={styles.sharedBadgeText}>{stat.sharedCount} shared</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {status ? (
        <QuotaMeter usedBytes={status.quotaUsedBytes} limitBytes={status.quotaLimitBytes} />
      ) : null}

      <SectionHeader title="Active shares" />
      {activeGrants.length === 0 ? (
        <Card>
          <Text style={styles.emptyShares}>{vaultCopy.activeSharesEmpty}</Text>
        </Card>
      ) : (
        <Card style={styles.sharesCard}>
          {activeGrants.map((grant, i) => (
            <View key={grant.grant_id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <GrantRow
                grant={grant}
                recordTitle={recordTitles.get(grant.record_id)}
                onRevoke={revoke}
                onPress={(g) => navigation.navigate('VaultRecord', { recordId: g.record_id })}
              />
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={infoOpen} onClose={() => setInfoOpen(false)} title={vaultCopy.encryptedPill}>
        <Text style={styles.infoText}>{vaultCopy.encryptedInfo}</Text>
        <Button title="Got it" variant="secondary" onPress={() => setInfoOpen(false)} style={styles.infoBtn} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  title: { color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  lockPillText: { color: colors.success, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  pressed: { opacity: 0.8 },
  errorCard: { borderColor: colors.danger, marginBottom: spacing[3] },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  compCard: { gap: spacing[1], borderColor: colors.premium, marginBottom: spacing[4] },
  compHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  compLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  compAmount: { color: colors.premium, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold },
  compCaption: { color: colors.textMuted, fontSize: fontSize.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    gap: spacing[3],
    minHeight: 104,
  },
  tileWide: { width: '100%' },
  tileMeta: { gap: 2 },
  tileLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  tileCount: { color: colors.textMuted, fontSize: fontSize.xs },
  sharedBadge: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  sharedBadgeText: { color: colors.success, fontSize: 10, fontWeight: fontWeight.medium },
  emptyShares: { color: colors.textMuted, fontSize: fontSize.sm },
  sharesCard: { paddingVertical: spacing[1] },
  divider: { height: 1, backgroundColor: colors.border },
  infoText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 21 },
  infoBtn: { marginTop: spacing[4] },
  gate: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  gateTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.semibold },
  gateHint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  gateBtn: { alignSelf: 'stretch', marginTop: spacing[2] },
});
