/**
 * Grantee redemption view (spec 07 §5) — what the RECIPIENT of a share sees.
 * Fetches GET /api/wallet/share/:grantId and renders the grant, or the
 * expired / revoked / wrong-ID states in a neutral, never-shaming tone.
 *
 * v1 note: opening (decrypting) the shared record requires the wallet's own
 * X25519 identity key, which lands with the identity-key setup (m/core
 * session work). Until then this screen shows the grant details and states.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { grantCopy } from '@/features/vault/copy';
import { expiryDisplay, formatMoney } from '@/features/vault/format';
import { ApiError } from '@/services/api';
import { walletApi, type ShareRedemption } from '@/services/walletApi';
import type { RootStackParamList } from '@/navigation/types';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

type RedeemRoute = RouteProp<RootStackParamList, 'ShareRedeem'>;

type RedeemState =
  | { kind: 'loading' }
  | { kind: 'ok'; share: ShareRedemption }
  | { kind: 'error'; title: string; message: string };

export function ShareRedeemScreen() {
  const route = useRoute<RedeemRoute>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<RedeemState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const share = await walletApi.redeemShare(route.params.grantId);
      setState({ kind: 'ok', share });
    } catch (err) {
      if (err instanceof ApiError) {
        const code = (err.body as { code?: string })?.code;
        if (code === 'GRANT_EXPIRED') {
          setState({
            kind: 'error',
            title: 'Share expired',
            message: grantCopy.expiredGrantee('the owner'),
          });
          return;
        }
        if (code === 'GRANT_REVOKED') {
          setState({ kind: 'error', title: 'Share revoked', message: grantCopy.revokedGrantee });
          return;
        }
        if (code === 'DEVICE_MISMATCH') {
          setState({ kind: 'error', title: 'Not for this ID', message: grantCopy.didMismatch });
          return;
        }
      }
      setState({
        kind: 'error',
        title: 'Share unavailable',
        message: 'Could not open this share. Check your connection and try again.',
      });
    }
  }, [route.params.grantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[2] }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Shared with you</Text>
      </View>

      {state.kind === 'loading' ? (
        <Card>
          <Text style={styles.muted}>Opening share…</Text>
        </Card>
      ) : state.kind === 'error' ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.errorText}>{state.message}</Text>
          <Button title="Retry" variant="secondary" onPress={() => void load()} style={styles.retry} />
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={styles.recordTitle}>{state.share.meta.title ?? 'Shared record'}</Text>
            {state.share.meta.type ? (
              <Text style={styles.recordType}>{state.share.meta.type}</Text>
            ) : null}
            <View style={styles.divider} />
            <InfoRow
              label="Access"
              value={
                state.share.scope === 'full' ? 'Everything in this record' : 'Title & type only'
              }
            />
            <InfoRow label="Expires" value={expiryDisplay(state.share.expiresAt)} />
            {state.share.price.amount > 0 ? (
              <InfoRow
                label="Requested compensation"
                value={formatMoney(state.share.price.amount, state.share.price.currency)}
              />
            ) : null}
          </Card>
          <Card style={styles.noticeCard}>
            <Ionicons name="key" size={18} color={colors.accent} />
            <Text style={styles.noticeText}>
              Opening the encrypted contents requires your wallet identity key — that arrives with
              identity setup in an upcoming update. The share stays locked to your ID until then.
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing[4], paddingBottom: spacing[10] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  backBtn: { padding: spacing[1] },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  errorCard: { borderColor: colors.borderStrong, gap: spacing[2] },
  errorTitle: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  errorText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  retry: { marginTop: spacing[2] },
  card: { gap: spacing[2] },
  recordTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  recordType: { color: colors.textMuted, fontSize: fontSize.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  infoLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  infoValue: { color: colors.text, fontSize: fontSize.sm, flexShrink: 1, textAlign: 'right' },
  noticeCard: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 17 },
});
