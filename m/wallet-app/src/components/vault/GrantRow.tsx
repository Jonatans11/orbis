import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import {
  countdownLabel,
  expiredLabel,
  formatMoney,
  truncateDid,
} from '@/features/vault/format';
import { isGrantActive, type Grant } from '@/services/walletApi';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

interface GrantRowProps {
  grant: Grant;
  /** Record title for context (omitted when rendered inside that record's detail). */
  recordTitle?: string;
  onRevoke?: (grant: Grant) => void;
  onShareAgain?: (grant: Grant) => void;
  onPress?: (grant: Grant) => void;
}

/** A sharing grant row: grantee, record, expiry state, price chip, inline revoke (spec 07 §1.6/§5). */
export function GrantRow({ grant, recordTitle, onRevoke, onShareAgain, onPress }: GrantRowProps) {
  const active = isGrantActive(grant);
  const revoked = grant.revoked === 1;
  const expired = !revoked && !active;

  const stateLabel = revoked
    ? 'Revoked'
    : expired
      ? expiredLabel(grant.expires_at)
      : countdownLabel(grant.expires_at);

  const body = (
    <>
      <View style={styles.main}>
        <Text style={styles.grantee} numberOfLines={1}>
          {truncateDid(grant.grantee_did)}
        </Text>
        {recordTitle ? (
          <Text style={styles.record} numberOfLines={1}>
            {recordTitle}
          </Text>
        ) : null}
        <Text style={styles.scope}>
          {grant.scope === 'full' ? 'Everything in this record' : 'Title & type only'}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text
          style={[
            styles.state,
            active && styles.stateActive,
            (expired || revoked) && styles.stateMuted,
            revoked && styles.stateStruck,
          ]}
        >
          {stateLabel}
        </Text>
        {grant.price_amount > 0 ? (
          <Badge label={formatMoney(grant.price_amount, grant.price_currency)} tone="premium" />
        ) : null}
        {active && onRevoke ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Revoke access for ${truncateDid(grant.grantee_did)}`}
            onPress={() => onRevoke(grant)}
            style={({ pressed }) => [styles.revokeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.revokeText}>Revoke</Text>
          </Pressable>
        ) : null}
        {expired && onShareAgain ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share again"
            onPress={() => onShareAgain(grant)}
            style={({ pressed }) => [styles.againBtn, pressed && styles.pressed]}
          >
            <Text style={styles.againText}>Share again</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress(grant)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={styles.row}>{body}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  main: { flex: 1, gap: 2 },
  grantee: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  record: { color: colors.textSecondary, fontSize: fontSize.xs },
  scope: { color: colors.textMuted, fontSize: fontSize.xs },
  trailing: { alignItems: 'flex-end', gap: spacing[1] },
  state: { fontSize: fontSize.xs },
  stateActive: { color: colors.accent },
  stateMuted: { color: colors.textMuted },
  stateStruck: { textDecorationLine: 'line-through' },
  revokeBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  revokeText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  againBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  againText: { color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  pressed: { opacity: 0.7 },
});
