import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/context/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  return (
    <Screen>
      <Text style={styles.greeting}>Hello{user?.name ? `, ${user.name}` : ''}</Text>

      {/* Identity card */}
      <Card style={styles.identityCard}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.accent} />
          </View>
          <View style={styles.identityMeta}>
            <Text style={styles.identityName}>{user?.name ?? 'ORBIS Member'}</Text>
            <Text style={styles.identityDid} numberOfLines={1}>
              {user?.did ?? 'No DID yet — create one to get started'}
            </Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          <Badge label={user?.did ? 'Verified' : 'Unverified'} tone={user?.did ? 'success' : 'warning'} />
          <Badge label="Basic" tone="neutral" />
        </View>
      </Card>

      {/* Quick actions */}
      <SectionHeader title="Quick actions" />
      <View style={styles.actionsRow}>
        <QuickAction icon="scan" label="Scan QR" onPress={() => navigation.navigate('ScanQR')} />
        <QuickAction icon="qr-code" label="Show QR" onPress={() => navigation.navigate('ShowQR', {})} />
        <QuickAction
          icon="chatbubble-ellipses"
          label="Message"
          onPress={() => navigation.navigate('Main', { screen: 'Messages' })}
        />
      </View>

      {/* Recent activity */}
      <SectionHeader title="Recent activity" />
      <Card>
        <Text style={styles.emptyText}>
          No activity yet. Scan a QR code to receive your first credential.
        </Text>
      </Card>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={24} color={colors.accent} />
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greeting: {
    color: colors.text,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  identityCard: { gap: spacing[3] },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityMeta: { flex: 1 },
  identityName: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  identityDid: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: spacing[2] },
  actionsRow: { flexDirection: 'row', gap: spacing[3] },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  quickActionLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
});
